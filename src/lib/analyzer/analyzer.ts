import { PitchDetector } from 'pitchy'
import { MAX_HISTORY, type AudioManager } from '../audio'
import { findFundamentalFrequency, findLoudestFrequencies } from './basic_analyzer'
import { type SpectrogramSettings } from '../settings'

export class AnalyzerManager {
	private results: AnalyzerResult[] = []
	private pitchDetector: PitchDetector<Float32Array> | null = null

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
		const frequencyMaximas = findLoudestFrequencies(this.audioManager, audioBuffer, 3)

		if (!this.pitchDetector || this.pitchDetector.inputLength !== timeBuffer.length) {
			this.pitchDetector = PitchDetector.forFloat32Array(timeBuffer.length)
		}
		const [pitchyFrequency, pitchyConfidence] = this.pitchDetector.findPitch(
			timeBuffer.slice(),
			sampleRate,
		)

		if (this.results.length >= MAX_HISTORY) {
			this.results.pop()
		}
		this.results.unshift(
			new AnalyzerResult(
				fundamentalFrequency,
				fundamentalConfidence,
				frequencyMaximas,
				pitchyFrequency,
				pitchyConfidence,
			),
		)
	}

	getResult(): AnalyzerResult | null {
		return this.results[0]
	}

	getResults() {
		return this.results
	}
}

export class AnalyzerResult {
	constructor(
		public fundamentalFrequency: number,
		public fundamentalConfidence: number,
		public frequencyMaximas: number[],
		public pitchyFrequency: number,
		public pitchyConfidence: number,
	) {}

	isPitchyValid() {
		return this.pitchyFrequency > 60 && this.pitchyFrequency > 0.1
	}
}
