import type { SpectrogramSettings } from './types'
import { AudioManager } from './audio'
import { decibelToColor, getTextColor } from './color_maps'
import { scale, inverseLogScale, NOTES } from './utils'
import { averagingInterpolation, linearInterpolation, maximumInterpolation } from './interpolation'
import type { EstimatorManager } from './estimator'

export class SpectrogramRenderer {
	private bgCanvas: HTMLCanvasElement
	private width: number
	private height: number

	constructor(
		private canvas: HTMLCanvasElement,
		private audioManager: AudioManager,
		private estimatorManager: EstimatorManager,
	) {
		this.bgCanvas = document.createElement('canvas')
		this.width = window.innerWidth
		this.height = window.innerHeight
		this.handleResize()
	}

	handleResize() {
		if (this.canvas.width !== this.width || this.canvas.height !== this.height) {
			this.width = window.innerWidth
			this.height = window.innerHeight
			this.canvas.width = this.width
			this.canvas.height = this.height
			this.bgCanvas.width = this.width
			this.bgCanvas.height = this.height
			const ctx = this.bgCanvas.getContext('2d')!
			ctx.fillStyle = 'gray'
			ctx.fillRect(0, 0, this.width, this.height)
		}
	}

	renderSpectrogram(settings: SpectrogramSettings, bgCtx: CanvasRenderingContext2D) {
		const freqBuffer = this.audioManager.getFreqBuffer()

		for (let i = 0; i < this.height; i++) {
			const freq = scale(
				1.0 - (1.0 * i) / this.height,
				settings.scala,
				settings.lowerFrequency,
				settings.upperFrequency,
			)
			const lowFreq = scale(
				1.0 - (i + 0.5) / this.height,
				settings.scala,
				settings.lowerFrequency,
				settings.upperFrequency,
			)
			const highFreq = scale(
				1.0 - (i - 0.5) / this.height,
				settings.scala,
				settings.lowerFrequency,
				settings.upperFrequency,
			)

			let value
			if (settings.interpolation === 'nearest') {
				value = freqBuffer[Math.round(this.audioManager.freqToIndex(freq))]
			} else if (settings.interpolation === 'linear') {
				value = linearInterpolation(freqBuffer, this.audioManager.freqToIndex(freq))
			} else if (settings.interpolation === 'maximum') {
				value = maximumInterpolation(
					freqBuffer,
					this.audioManager.freqToIndex(lowFreq),
					this.audioManager.freqToIndex(highFreq),
				)
			} else if (settings.interpolation === 'averaging') {
				value = averagingInterpolation(
					freqBuffer,
					this.audioManager.freqToIndex(lowFreq),
					this.audioManager.freqToIndex(highFreq),
				)
			} else {
				value = 0
			}

			const [r, g, b] = decibelToColor(value, settings.colorMap)
			bgCtx.fillStyle = `rgb(${r},${g},${b})`
			bgCtx.fillRect(this.width - settings.speed, i, settings.speed, 1)
		}
	}

	renderPresetTicks(ctx: CanvasRenderingContext2D, settings: SpectrogramSettings) {
		const freqs = [20, 30, 50, 100, 200, 261.6, 300, 440, 500, 1000, 2000, 3000, 5000, 10000]

		for (const freq of freqs) {
			this.drawTick(ctx, settings, this.width - 20, freq, `${freq.toFixed(0)} Hz`, 18)
		}
	}

	renderNoteTicks(ctx: CanvasRenderingContext2D, settings: SpectrogramSettings) {
		for (const { frequency, fullName } of NOTES) {
			if (frequency > settings.lowerFrequency && frequency < settings.upperFrequency) {
				this.drawTick(ctx, settings, this.width - 20, frequency, fullName, 12)
			}
		}
	}

	drawTick(
		ctx: CanvasRenderingContext2D,
		settings: SpectrogramSettings,
		x: number,
		frequency: number,
		text: string | null,
		size: number,
	) {
		if (!text) {
			text = `${frequency.toFixed(1)} Hz`
		}
		const [r, g, b] = getTextColor(settings.colorMap)
		ctx.fillStyle = `rgb(${r},${g},${b})`

		const percentage = inverseLogScale(frequency, settings.lowerFrequency, settings.upperFrequency)
		const y = Math.round((1.0 - percentage) * this.height)
		ctx.fillRect(x, y - 1, 20, 2)
		ctx.textAlign = 'right'
		ctx.font = `${size}px Inconsolata`
		ctx.fillText(text, x - 5, y + 5)
	}

	drawPoint(
		bgCtx: CanvasRenderingContext2D,
		settings: SpectrogramSettings,
		frequency: number,
		color: string,
	) {
		bgCtx.fillStyle = color
		const percentage = inverseLogScale(frequency, settings.lowerFrequency, settings.upperFrequency)
		const y = Math.round((1.0 - percentage) * this.height)
		bgCtx.fillRect(this.width - settings.speed, y - 1, settings.speed, 3)
	}

	renderNoteGuidelines(ctx: CanvasRenderingContext2D, settings: SpectrogramSettings) {
		const [r, g, b] = getTextColor(settings.colorMap)
		ctx.fillStyle = `rgba(${r},${g},${b},0.25)`
		for (const { frequency } of NOTES) {
			if (frequency > settings.lowerFrequency && frequency < settings.upperFrequency) {
				const percentage = inverseLogScale(
					frequency,
					settings.lowerFrequency,
					settings.upperFrequency,
				)
				const y = Math.round((1.0 - percentage) * this.height)
				ctx.fillRect(0, y - 1, this.width, 2)
			}
		}
	}

	renderMouse(
		ctx: CanvasRenderingContext2D,
		mousePosition: [number, number],
		settings: SpectrogramSettings,
	) {
		ctx.font = '20px Inconsolata'
		const [r, g, b] = getTextColor(settings.colorMap)
		ctx.fillStyle = `rgb(${r},${g},${b})`

		const percentage = 1.0 - (1.0 * mousePosition[1]) / this.height
		const freq = scale(percentage, settings.scala, settings.lowerFrequency, settings.upperFrequency)

		ctx.textAlign = 'left'
		ctx.fillText(`${freq.toFixed(1)} Hz`, mousePosition[0] + 10, mousePosition[1] - 10)

		ctx.fillStyle = `rgba(${r},${g},${b},0.5)`
		ctx.fillRect(0, mousePosition[1] - 1, this.width, 3)
	}

	render(settings: SpectrogramSettings, mousePosition: [number, number], paused: boolean) {
		this.handleResize()

		const estimators = this.estimatorManager.getResult()

		// Background
		const bgCtx = this.bgCanvas.getContext('2d')!
		if (!paused) {
			bgCtx.drawImage(this.bgCanvas, -settings.speed, 0)
		}
		this.renderSpectrogram(settings, bgCtx)

		if (estimators.pitchyFrequency > 20 && estimators.pitchyConfidence > 0.5) {
			this.drawPoint(bgCtx, settings, estimators.pitchyFrequency, `limegreen`)
		}

		// Foreground
		const ctx = this.canvas.getContext('2d')!
		ctx.drawImage(this.bgCanvas, 0, 0)

		if (settings.noteGuidelines) {
			this.renderNoteGuidelines(ctx, settings)
		}

		if (settings.tickVariant === 'preset') {
			this.renderPresetTicks(ctx, settings)
		} else if (settings.tickVariant === 'notes') {
			this.renderNoteTicks(ctx, settings)
		}

		for (const frequency of estimators.frequencyMaximas) {
			this.drawTick(ctx, settings, this.width - 120, frequency, null, 18)
		}
		this.drawTick(ctx, settings, this.width - 220, estimators.fundamentalFrequency, null, 18)
		this.drawTick(ctx, settings, this.width - 320, estimators.pitchyFrequency, null, 18)

		this.renderMouse(ctx, mousePosition, settings)
	}
}
