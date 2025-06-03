import type { AnalyzerResult } from './analyzer/analyzer'
import type { SpectrogramSettings } from './settings'

export class PitchTracker {
	private momentum: number = 0

	private smoothPitches(results: AnalyzerResult[]): number | null {
		const MIN_FREQ = 50
		const MAX_FREQ = 1500
		const WINDOW_SIZE = 30
		const MIN_VALID_SAMPLES = 5
		const MAX_OCTAVE_JUMP = 1.5
		const EXTREME_OUTLIER_RATIO = 3

		const window = results
			.slice(0, Math.min(WINDOW_SIZE, results.length))
			.map((item) => (item.isPitchyValid() ? item.pitchyFrequency : null))

		const filteredPitches = window.map((pitch, i) => {
			if (pitch === null || pitch < MIN_FREQ || pitch > MAX_FREQ) {
				return null
			}

			const nextPitch = i < window.length - 1 ? window[i + 1] : null
			if (nextPitch !== null) {
				const ratio = pitch / nextPitch
				if (ratio > EXTREME_OUTLIER_RATIO || ratio < 1 / EXTREME_OUTLIER_RATIO) {
					return null
				}
			}

			return pitch
		})

		let stablePitchStart = -1
		let stablePitchEnd = -1
		let currentSegmentStart = -1

		for (let i = 0; i < filteredPitches.length - 1; i++) {
			const current = filteredPitches[i]
			const next = filteredPitches[i + 1]

			if (current === null || next === null) {
				currentSegmentStart = -1
				continue
			}

			const ratio = current / next
			if (ratio > MAX_OCTAVE_JUMP || ratio < 1 / MAX_OCTAVE_JUMP) {
				currentSegmentStart = -1
				continue
			}

			if (currentSegmentStart === -1) {
				currentSegmentStart = i
			}

			if (i - currentSegmentStart + 1 >= MIN_VALID_SAMPLES) {
				stablePitchStart = currentSegmentStart
				stablePitchEnd = i + 1
			}
		}

		if (stablePitchStart === -1 || stablePitchEnd === -1) {
			return null
		}

		const stableSegment = filteredPitches
			.slice(stablePitchStart, stablePitchEnd + 1)
			.filter((p): p is number => p !== null)

		if (stableSegment.length < MIN_VALID_SAMPLES) {
			return null
		}

		const weightedPitches: number[] = []
		stableSegment.forEach((pitch, i) => {
			const weight = Math.ceil(Math.exp(-i * 0.5) * 10)
			for (let j = 0; j < weight; j++) {
				weightedPitches.push(pitch)
			}
		})

		if (weightedPitches.length === 0) {
			return null
		}

		weightedPitches.sort((a, b) => a - b)
		const medianIndex = Math.floor(weightedPitches.length / 2)
		return weightedPitches[medianIndex]
	}

	updateFrequencyWindow(
		analyzerResults: AnalyzerResult[],
		settings: SpectrogramSettings,
		toneEnabled: boolean,
	): { lowerFrequency?: number; upperFrequency?: number } | null {
		const FREQUENCY_WINDOW_TARGET = Math.pow(2, 13 / 12)
		const FREQUENCY_DEVIATION_THRESHOLD = 1.12
		const SPREAD_DEVIATION_THRESHOLD = 1.1
		const SMOOTHING_FACTOR = 0.9
		const MOMENTUM_THRESHOLD = 0.05

		if (!settings.followPitch || toneEnabled) {
			return null
		}

		const frequency = this.smoothPitches(analyzerResults)
		if (!frequency) {
			return null
		}

		const freqWindowFactor = Math.sqrt(FREQUENCY_WINDOW_TARGET)
		const currentMiddle =
			(settings.lowerFrequency * freqWindowFactor + settings.upperFrequency / freqWindowFactor) / 2
		const currentRatio = currentMiddle / frequency
		const currentSpread =
			settings.upperFrequency / settings.lowerFrequency / FREQUENCY_WINDOW_TARGET

		if (
			currentRatio > FREQUENCY_DEVIATION_THRESHOLD ||
			currentRatio < 1.0 / FREQUENCY_DEVIATION_THRESHOLD ||
			currentSpread > SPREAD_DEVIATION_THRESHOLD ||
			currentSpread < 1.0 / SPREAD_DEVIATION_THRESHOLD ||
			this.momentum > MOMENTUM_THRESHOLD
		) {
			const newLowerFrequency =
				settings.lowerFrequency * SMOOTHING_FACTOR +
				(frequency / freqWindowFactor) * (1.0 - SMOOTHING_FACTOR)
			const newUpperFrequency =
				settings.upperFrequency * SMOOTHING_FACTOR +
				frequency * freqWindowFactor * (1.0 - SMOOTHING_FACTOR)

			this.momentum =
				this.momentum * SMOOTHING_FACTOR + Math.abs(currentRatio - 1) * (1.0 - SMOOTHING_FACTOR)

			return {
				lowerFrequency: newLowerFrequency,
				upperFrequency: newUpperFrequency,
			}
		}

		return null
	}
}
