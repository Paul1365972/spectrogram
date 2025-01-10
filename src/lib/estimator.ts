import { PitchDetector } from 'pitchy'
import type { AudioManager } from './audio'
import { findFundamentalFrequency, findMaximumFrequencies } from './basic_estimator'
import type { SpectrogramSettings } from './settings'

const MAX_ESTIMATOR_RESULTS = 2048

export class EstimatorManager {
	private results: EstimatorResult[] = []
	private pitchDetector: PitchDetector<Float32Array> | null = null

	constructor(private audioManager: AudioManager) {}

	async initialize() {}

	update(settings: SpectrogramSettings) {
		const fundamentalFrequency = findFundamentalFrequency(this.audioManager, 8)
		const frequencyMaximas = findMaximumFrequencies(this.audioManager, 3, settings)

		const timeBuffer = this.audioManager.getTimeBuffer()
		if (!this.pitchDetector || this.pitchDetector.inputLength != timeBuffer.length) {
			this.pitchDetector = PitchDetector.forFloat32Array(timeBuffer.length)
		}
		let [pitchyFrequency, pitchyConfidence] = this.pitchDetector.findPitch(
			timeBuffer,
			this.audioManager.getSampleRate(),
		)

		if (this.results.length >= MAX_ESTIMATOR_RESULTS) {
			this.results.pop()
		}
		this.results.unshift({
			fundamentalFrequency,
			frequencyMaximas,
			pitchyFrequency,
			pitchyConfidence,
		} as EstimatorResult)
	}

	getResult() {
		return this.results[0]
	}

	getResults() {
		return this.results
	}
}

export type EstimatorResult = {
	fundamentalFrequency: number
	frequencyMaximas: number[]
	pitchyFrequency: number
	pitchyConfidence: number
}
