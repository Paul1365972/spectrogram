import { PitchDetector } from 'pitchy'
import { MAX_HISTORY, type AudioManager } from '../audio'
import { findFundamentalFrequency, findMaximumFrequencies } from './custom_estimator'
import { type SpectrogramSettings } from '../settings'
import { computeLPCCoefficients, computeLPCFormants } from './lpc'

export class EstimatorManager {
	private results: EstimatorResult[] = []
	private pitchDetector: PitchDetector<Float32Array> | null = null

	constructor(private audioManager: AudioManager) {}

	async initialize() {}

	update(settings: SpectrogramSettings) {
		const timeBuffer = this.audioManager.getTimeBuffer()
		const sampleRate = this.audioManager.getSampleRate()

		const { frequency: fundamentalFrequency, confidence: fundamentalConfidence } =
			findFundamentalFrequency(this.audioManager, 8)
		const frequencyMaximas = findMaximumFrequencies(this.audioManager, 3, settings)

		if (!this.pitchDetector || this.pitchDetector.inputLength != timeBuffer.length) {
			this.pitchDetector = PitchDetector.forFloat32Array(timeBuffer.length)
		}
		let [pitchyFrequency, pitchyConfidence] = this.pitchDetector.findPitch(timeBuffer, sampleRate)

		let lpcCoefficients = computeLPCCoefficients(timeBuffer, 10)
		// let formants = computeLPCFormants(lpcCoefficients, sampleRate)

		if (this.results.length >= MAX_HISTORY) {
			this.results.pop()
		}
		this.results.unshift(
			new EstimatorResult(
				fundamentalFrequency,
				fundamentalConfidence,
				frequencyMaximas,
				pitchyFrequency,
				pitchyConfidence,
				lpcCoefficients,
			),
		)
	}

	getResult() {
		return this.results[0]
	}

	getResults() {
		return this.results
	}
}

export class EstimatorResult {
	constructor(
		public fundamentalFrequency: number,
		public fundamentalConfidence: number,
		public frequencyMaximas: number[],
		public pitchyFrequency: number,
		public pitchyConfidence: number,
		public lpcCoefficients: Float32Array,
	) {}

	isPitchyValid() {
		return this.pitchyFrequency > 60 && this.pitchyFrequency > 0.1
	}
}
