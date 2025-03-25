import { PitchDetector } from 'pitchy'
import { MAX_HISTORY, type AudioManager } from '../audio'
import { findFundamentalFrequency, findMaximumFrequencies } from './custom_estimator'
import { type SpectrogramSettings } from '../settings'
import { computeLPCCoefficients, computeLPCFormants } from './lpc'
import { EfficientFormant } from './efficient_formant'

export class EstimatorManager {
	private results: EstimatorResult[] = []
	private pitchDetector: PitchDetector<Float32Array> | null = null
	private efficientFormant: EfficientFormant | null = null

	constructor(private audioManager: AudioManager) {}

	async initialize() {}

	update(settings: SpectrogramSettings) {
		const audioBuffer = this.audioManager.getAnalysisBuffer()
		if (!audioBuffer) {
			return
		}
		const timeBuffer = audioBuffer.time
		const sampleRate = this.audioManager.getSampleRate()

		const { frequency: fundamentalFrequency, confidence: fundamentalConfidence } =
			findFundamentalFrequency(this.audioManager, audioBuffer, 8)
		const frequencyMaximas = findMaximumFrequencies(this.audioManager, audioBuffer, 3)

		if (!this.pitchDetector || this.pitchDetector.inputLength !== timeBuffer.length) {
			this.pitchDetector = PitchDetector.forFloat32Array(timeBuffer.length)
		}
		const [pitchyFrequency, pitchyConfidence] = this.pitchDetector.findPitch(
			timeBuffer.slice(),
			sampleRate,
		)

		// if (!this.efficientFormant || this.efficientFormant.sampleRate !== sampleRate) {
		// 	 this.efficientFormant = new EfficientFormant(sampleRate)
		// }
		// const formants = this.efficientFormant.estimate(timeBuffer.slice(), 4)
		// console.log(formants)

		// const lpcCoefficients = computeLPCCoefficients(timeBuffer.slice(), sampleRate, 8)
		// const formants = computeLPCFormants(lpcCoefficients, sampleRate)
		// console.log(formants)
		const lpcCoefficients = new Float32Array()

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

	getResult(): EstimatorResult | null {
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
