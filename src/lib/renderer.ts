import { SpectrogramRenderer } from './spectrogram_renderer'
import type { SpectrogramSettings } from './settings'
import { AudioManager } from './audio'
import { getTextColor } from './color_maps'
import { inverseLogScale, scale, NOTES } from './utils'
import type { EstimatorManager } from './estimator'

export class Renderer {
	private webglSpectrogram: SpectrogramRenderer
	private width: number
	private height: number

	constructor(
		private canvas: HTMLCanvasElement,
		private audioManager: AudioManager,
		private estimatorManager: EstimatorManager,
	) {
		this.webglSpectrogram = new SpectrogramRenderer(audioManager)

		this.width = canvas.width
		this.height = canvas.height
		this.handleResize()
	}

	handleResize() {
		if (this.width !== window.innerHeight || this.height !== window.innerHeight) {
			this.width = window.innerWidth
			this.height = window.innerHeight
			this.canvas.width = this.width
			this.canvas.height = this.height
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
		ctx: CanvasRenderingContext2D,
		settings: SpectrogramSettings,
		frequency: number,
		color: string,
	) {
		ctx.fillStyle = color
		const percentage = inverseLogScale(frequency, settings.lowerFrequency, settings.upperFrequency)
		const y = Math.round((1.0 - percentage) * this.height)
		ctx.fillRect(this.width - settings.speed, y - 1, settings.speed, 3)
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

		// Update and render WebGL spectrogram
		const freqBuffer = this.audioManager.getFreqBuffer()
		if (!paused) {
			this.webglSpectrogram.update(freqBuffer)
		}
		this.webglSpectrogram.render(settings, this.width, this.height)

		// Get 2D context for overlay
		const ctx = this.canvas.getContext('2d')!

		// TODO Readd note path

		// Clear overlay canvas
		ctx.clearRect(0, 0, this.width, this.height)

		// Copy WebGL canvas to overlay canvas
		ctx.drawImage(this.webglSpectrogram.getCanvas(), 0, 0)

		const estimators = this.estimatorManager.getResult()

		// Render overlay elements
		if (settings.noteGuidelines) {
			this.renderNoteGuidelines(ctx, settings)
		}

		if (settings.tickVariant === 'preset') {
			this.renderPresetTicks(ctx, settings)
		} else if (settings.tickVariant === 'notes') {
			this.renderNoteTicks(ctx, settings)
		}

		// Render estimator results
		for (const frequency of estimators.frequencyMaximas) {
			this.drawTick(ctx, settings, this.width - 120, frequency, null, 18)
		}
		this.drawTick(ctx, settings, this.width - 220, estimators.fundamentalFrequency, null, 18)
		this.drawTick(ctx, settings, this.width - 320, estimators.pitchyFrequency, null, 18)

		this.renderMouse(ctx, mousePosition, settings)
	}
}
