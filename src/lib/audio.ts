import type { SpectrogramSettings } from './settings'

export const MAX_HISTORY = 2048

export class AudioManager {
	private audioContext: AudioContext | null = null
	private analyser: AnalyserNode | null = null
	private gainNode: GainNode | null = null
	private oscillatorNode: OscillatorNode | null = null
	private timeBuffer: Float32Array | null = null
	private freqBuffer: Float32Array | null = null
	private freqBufferNormalized: Float32Array | null = null
	private freqBufferHistory: Float32Array | null = null
	private freqBufferHistoryOffset: number = 0
	private sampleRate: number | null = null
	private hzPerBin: number | null = null

	async initialize() {
		this.audioContext = new AudioContext()
		const stream = await navigator.mediaDevices.getUserMedia({
			audio: {
				autoGainControl: false,
				echoCancellation: false,
				noiseSuppression: false,
			},
			video: false,
		})
		const input = this.audioContext.createMediaStreamSource(stream)
		this.analyser = this.audioContext.createAnalyser()
		this.analyser.smoothingTimeConstant = 0
		this.analyser.fftSize = 4096
		input.connect(this.analyser)

		this.gainNode = this.audioContext.createGain()
		this.gainNode.connect(this.audioContext.destination)
		this.gainNode.gain.value = 0.0

		this.oscillatorNode = this.audioContext.createOscillator()
		this.oscillatorNode.connect(this.gainNode)
		this.oscillatorNode.start()

		this.timeBuffer = new Float32Array(this.analyser.fftSize)
		this.freqBuffer = new Float32Array(this.analyser.frequencyBinCount)
		this.freqBufferNormalized = new Float32Array(this.analyser.frequencyBinCount)
		this.freqBufferHistory = new Float32Array(this.analyser.frequencyBinCount * MAX_HISTORY).fill(
			Number.NEGATIVE_INFINITY,
		)
	}

	update(settings: SpectrogramSettings) {
		const analyser = this.analyser!

		analyser.fftSize = settings.fftSize
		analyser.smoothingTimeConstant = settings.smoothingFactor

		if (this.timeBuffer!.length !== analyser.fftSize) {
			this.timeBuffer = new Float32Array(analyser.fftSize)
		}
		if (this.freqBuffer!.length !== analyser.frequencyBinCount) {
			this.freqBuffer = new Float32Array(analyser.frequencyBinCount)
		}
		if (this.freqBufferNormalized!.length !== analyser.frequencyBinCount) {
			this.freqBufferNormalized = new Float32Array(analyser.frequencyBinCount)
		}
		if (this.freqBufferHistory!.length !== analyser.frequencyBinCount * MAX_HISTORY) {
			this.freqBufferHistory = new Float32Array(analyser.frequencyBinCount * MAX_HISTORY).fill(
				Number.NEGATIVE_INFINITY,
			)
		}

		analyser.getFloatTimeDomainData(this.timeBuffer!)
		// Does the FFT with a blackman window
		analyser.getFloatFrequencyData(this.freqBuffer!)

		const factor = parseInt(settings.emphasis)
		if (factor > 0) {
			const startFreq = 50
			const startIndex = Math.ceil(this.freqToIndex(startFreq))
			for (let i = startIndex; i < this.freqBuffer!.length; i++) {
				const freq = this.indexToFreq(i)
				const octaveOffset = Math.log2(freq) - Math.log2(startFreq)
				this.freqBuffer![i] += factor * octaveOffset
			}
		}
		for (let i = 0; i < this.freqBuffer!.length; i++) {
			this.freqBufferNormalized![i] = this.decibelToPercentage(this.freqBuffer![i])
		}
		this.freqBufferHistory!.set(this.freqBuffer!, this.freqBufferHistoryOffset * MAX_HISTORY)
		this.freqBufferHistoryOffset! = (this.freqBufferHistoryOffset! + 1) % MAX_HISTORY

		this.sampleRate = this.audioContext!.sampleRate
		const nyquist = this.sampleRate / 2.0
		this.hzPerBin = nyquist / analyser.frequencyBinCount
	}

	setOscillatorFrequency(freq: number) {
		if (this.oscillatorNode) {
			this.oscillatorNode.frequency.value = freq
		}
	}

	setGain(value: number) {
		if (this.gainNode) {
			this.gainNode.gain.setTargetAtTime(value, this.audioContext?.currentTime || 0, 0.005)
		}
	}

	getTimeBuffer() {
		return this.timeBuffer!
	}

	getFreqBuffer() {
		return this.freqBuffer!
	}

	getFreqBufferNormalized() {
		return this.freqBufferNormalized!
	}

	getFreqBufferHistory() {
		return this.freqBufferHistory!
	}

	getFreqBufferHistoryOffset() {
		return this.freqBufferHistoryOffset!
	}

	getSampleRate() {
		return this.sampleRate!
	}

	indexToFreq(index: number): number {
		return index * this.hzPerBin!
	}

	freqToIndex(frequency: number): number {
		return frequency / this.hzPerBin!
	}

	// TODO Replace with configurable range or make it more intelligent
	private decibelToPercentage(x: number) {
		const minDecibels = -100
		const maxDecibels = -30
		return Math.max(0, Math.min(1, (x - minDecibels) / (maxDecibels - minDecibels)))
	}
}
