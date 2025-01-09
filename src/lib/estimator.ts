import { PitchDetector } from 'pitchy'
import type { AudioManager } from './audio'
import { findFundamentalFrequency, findMaximumFrequencies } from './basic_estimator'
import type { SpectrogramSettings } from './types'

export class EstimatorManager {
	private latestResult: EstimatorResult | null = null
	private pitchDetector: PitchDetector<Float32Array> | null = null

	constructor(private audioManager: AudioManager) {}

	async initialize() {}

	update(settings: SpectrogramSettings) {
		const timeBuffer = this.audioManager.getTimeBuffer()
		const freqBuffer = this.audioManager.getFreqBuffer()

		const fundamentalFrequency = findFundamentalFrequency(this.audioManager, 8)
		const frequencyMaximas = findMaximumFrequencies(this.audioManager, 3, settings)

		if (!this.pitchDetector || this.pitchDetector.inputLength != timeBuffer.length) {
			this.pitchDetector = PitchDetector.forFloat32Array(timeBuffer.length)
		}
		let [pitchyFrequency, pitchyConfidence] = this.pitchDetector.findPitch(
			timeBuffer,
			this.audioManager.getSampleRate(),
		)

		this.latestResult = {
			fundamentalFrequency,
			frequencyMaximas,
			pitchyFrequency,
			pitchyConfidence,
		} as EstimatorResult
	}

	getResult() {
		return this.latestResult!
	}
}

export type EstimatorResult = {
	fundamentalFrequency: number
	frequencyMaximas: number[]
	pitchyFrequency: number
	pitchyConfidence: number
}
