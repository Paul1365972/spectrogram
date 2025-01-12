import { SpectrogramRenderer } from './spectrogram_renderer'
import type { SpectrogramSettings } from './settings'
import { AudioManager } from './audio'
import { getTextColor } from './color_maps'
import { inverseScale, scale, NOTES, nearestNote } from './scales'
import { MAX_ESTIMATOR_RESULTS, type EstimatorManager } from './estimator'
import { trackPitch } from './pitch_tracker'

export class Renderer {
	private webglSpectrogram: SpectrogramRenderer
	private width: number
	private height: number
	private test: (number | null)[] = []

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

		const percentage = inverseScale(
			frequency,
			settings.scala,
			settings.lowerFrequency,
			settings.upperFrequency,
		)
		const y = Math.round((1.0 - percentage) * this.height)
		ctx.fillRect(x, y - 1, 20, 2)
		ctx.textAlign = 'right'
		ctx.font = `${size}px Inconsolata`
		ctx.fillText(text, x - 5, y + 5)
	}

	drawTracker(
		ctx: CanvasRenderingContext2D,
		settings: SpectrogramSettings,
		frequency: number,
		color: string,
	) {
		ctx.fillStyle = color

		ctx.beginPath()
		const y =
			(1.0 -
				inverseScale(frequency, settings.scala, settings.lowerFrequency, settings.upperFrequency)) *
			this.height
		ctx.arc(this.width - 5, y, 5, 0, 2 * Math.PI, false)
		ctx.fill()
		ctx.lineWidth = 3
		ctx.strokeStyle = 'black'
		ctx.stroke()
	}

	drawLine(
		ctx: CanvasRenderingContext2D,
		settings: SpectrogramSettings,
		color: string,
		values: ({ frequency: number; strength: number } | null)[],
	) {
		ctx.strokeStyle = color
		ctx.lineCap = 'round'
		ctx.lineJoin = 'round'
		ctx.lineWidth = 4
		ctx.beginPath()

		const segmentWidth = (settings.speed * this.width) / MAX_ESTIMATOR_RESULTS

		for (let i = 1; i < Math.min(values.length, MAX_ESTIMATOR_RESULTS / settings.speed); i++) {
			const curr = values[i]
			const prev = values[i - 1]
			if (!curr || !prev) continue

			const prevX = this.width - (i - 1) * segmentWidth
			const currX = this.width - i * segmentWidth
			const currY =
				(1.0 -
					inverseScale(
						curr.frequency,
						settings.scala,
						settings.lowerFrequency,
						settings.upperFrequency,
					)) *
				this.height
			const prevY =
				(1.0 -
					inverseScale(
						prev.frequency,
						settings.scala,
						settings.lowerFrequency,
						settings.upperFrequency,
					)) *
				this.height

			ctx.moveTo(prevX, prevY)
			ctx.lineTo(currX, currY)
		}
		ctx.stroke()
	}

	renderNoteGuidelines(ctx: CanvasRenderingContext2D, settings: SpectrogramSettings) {
		const [r, g, b] = getTextColor(settings.colorMap)
		ctx.fillStyle = `rgba(${r},${g},${b},0.25)`
		for (const { frequency } of NOTES) {
			if (frequency > settings.lowerFrequency && frequency < settings.upperFrequency) {
				const percentage = inverseScale(
					frequency,
					settings.scala,
					settings.lowerFrequency,
					settings.upperFrequency,
				)
				const y = Math.round((1.0 - percentage) * this.height)
				ctx.fillRect(0, y - 1, this.width, 2)
			}
		}
	}

	renderNoteFeedback(ctx: CanvasRenderingContext2D, frequency: number | null) {
		// Constants for the feedback box
		const boxWidth = 200
		const boxHeight = 120
		const x = this.width - 60 - boxWidth
		const y = 10

		// Draw background
		ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
		ctx.beginPath()
		ctx.roundRect(x, y, boxWidth, boxHeight, 5)
		ctx.fill()

		if (frequency) {
			const closestNote = nearestNote(frequency)
			const cents = 1200 * Math.log2(frequency / closestNote.frequency)

			let grade: string
			let gradeColor: string
			const absCents = Math.abs(cents)
			if (absCents < 10) {
				grade = 'Perfect!'
				gradeColor = 'rgb(64, 224, 64)'
			} else if (absCents < 20) {
				grade = 'Great'
				gradeColor = 'rgb(150, 224, 64)'
			} else if (absCents < 30) {
				grade = 'Good'
				gradeColor = 'rgb(224, 224, 64)'
			} else if (absCents < 40) {
				grade = 'Off'
				gradeColor = 'rgb(224, 150, 64)'
			} else {
				grade = 'Way Off'
				gradeColor = 'rgb(224, 64, 64)'
			}
			// Draw note name
			ctx.font = 'bold 36px Inconsolata'
			ctx.fillStyle = 'white'
			ctx.textAlign = 'center'
			ctx.fillText(closestNote.fullName, x + boxWidth / 2, y + 40)

			// Draw grade
			ctx.font = 'bold 24px Inconsolata'
			ctx.fillStyle = gradeColor
			ctx.fillText(grade, x + boxWidth / 2, y + 70)

			// Draw cents off
			ctx.font = '18px Courier New'
			ctx.fillStyle = 'white'
			const centsText =
				cents >= 0 ? `+${cents.toFixed(1).padStart(4)}¢` : `-${(-cents).toFixed(1).padStart(4)}¢`
			ctx.fillText(centsText, x + boxWidth / 2, y + 95)

			// Draw pitch indicator
			const indicatorWidth = 140
			const indicatorHeight = 4
			const indicatorY = y + 105
			const indicatorX = x + (boxWidth - indicatorWidth) / 2

			// Draw background line
			ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
			ctx.fillRect(indicatorX, indicatorY, indicatorWidth, indicatorHeight)

			// Draw center marker
			ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
			ctx.fillRect(indicatorX + indicatorWidth / 2 - 1, indicatorY - 3, 2, indicatorHeight + 6)

			// Draw pitch position
			const position = Math.max(-50, Math.min(50, cents)) / 50
			const markerX = indicatorX + indicatorWidth / 2 + (position * indicatorWidth) / 2
			ctx.fillStyle = gradeColor
			ctx.beginPath()
			ctx.arc(markerX, indicatorY + indicatorHeight / 2, 6, 0, 2 * Math.PI)
			ctx.fill()
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

		const freqBuffer = this.audioManager.getFreqBuffer()
		if (!paused) {
			this.webglSpectrogram.update(freqBuffer)
		}
		this.webglSpectrogram.render(settings, this.width, this.height)

		const ctx = this.canvas.getContext('2d')!
		ctx.clearRect(0, 0, this.width, this.height)
		ctx.drawImage(this.webglSpectrogram.getCanvas(), 0, 0)

		const estimator = this.estimatorManager.getResult()
		const estimators = this.estimatorManager.getResults()

		let pitchyLine = estimators.map((result) => {
			return result.isPitchyValid()
				? {
						frequency: result.pitchyFrequency,
						strength: ((result.pitchyConfidence - 0.1) / 0.9) * 4,
					}
				: null
		})
		this.drawLine(ctx, settings, 'rgb(64, 224, 64)', pitchyLine)

		if (settings.noteGuidelines) {
			this.renderNoteGuidelines(ctx, settings)
		}

		if (settings.tickVariant === 'preset') {
			this.renderPresetTicks(ctx, settings)
		} else if (settings.tickVariant === 'notes') {
			this.renderNoteTicks(ctx, settings)
		}

		// Render estimator results
		for (const frequency of estimator.frequencyMaximas) {
			this.drawTick(ctx, settings, this.width - 120, frequency, null, 18)
		}
		this.drawTick(ctx, settings, this.width - 220, estimator.fundamentalFrequency, null, 18)
		if (estimator.isPitchyValid()) {
			this.drawTracker(ctx, settings, estimator.pitchyFrequency, 'rgb(64, 224, 64)')
		}
		this.renderMouse(ctx, mousePosition, settings)

		this.renderNoteFeedback(ctx, estimator.isPitchyValid() ? estimator.pitchyFrequency : null)
	}
}
