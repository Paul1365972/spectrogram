import type { SpectrogramSettings } from './settings'

export class AudioManager {
	private audioContext: AudioContext | null = null
	private analyser: AnalyserNode | null = null
	private gainNode: GainNode | null = null
	private oscillatorNode: OscillatorNode | null = null
	private rawFreqBuffer: Uint8Array | null = null
	private freqBuffer: Uint8Array | null = null
	private timeBuffer: Float32Array | null = null
	private sampleRate: number | null = null
	private decibelsScale: number | null = null
	private decibelsOffset: number | null = null
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

		this.freqBuffer = new Uint8Array(this.analyser.frequencyBinCount)
		this.rawFreqBuffer = new Uint8Array(this.analyser.frequencyBinCount)
		this.timeBuffer = new Float32Array(this.analyser.fftSize)
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

	getFreqBuffer() {
		return this.freqBuffer!
	}

	getRawFreqBuffer() {
		return this.rawFreqBuffer!
	}

	getTimeBuffer() {
		return this.timeBuffer!
	}

	getSampleRate() {
		return this.sampleRate!
	}

	update(settings: SpectrogramSettings) {
		const analyser = this.analyser!

		analyser.fftSize = settings.fftSize
		analyser.smoothingTimeConstant = settings.smoothingFactor

		this.freqBuffer = new Uint8Array(analyser.frequencyBinCount)
		this.rawFreqBuffer = new Uint8Array(analyser.frequencyBinCount)
		this.timeBuffer = new Float32Array(analyser.fftSize)

		analyser.getFloatTimeDomainData(this.timeBuffer!)
		analyser.getByteFrequencyData(this.rawFreqBuffer!)

		const factor = parseInt(settings.emphasis)
		const startFreq = 50
		for (let i = 0; i < this.rawFreqBuffer!.length; i++) {
			let value = this.rawFreqBuffer![i]
			const freq = this.indexToFreq(i)
			if (freq > startFreq) {
				const octaveOffset = Math.log2(freq) - Math.log2(startFreq)
				const db = this.valueToDecibel(this.rawFreqBuffer![i]) + factor * octaveOffset
				value = Math.min(255, Math.round(this.decibelToValue(db)))
			}
			this.freqBuffer![i] = value
		}

		this.sampleRate = this.audioContext!.sampleRate
		this.decibelsScale = (analyser.maxDecibels - analyser.minDecibels) / 255.0
		this.decibelsOffset = analyser.minDecibels

		const nyquist = this.sampleRate / 2.0
		this.hzPerBin = nyquist / analyser.frequencyBinCount
	}

	valueToDecibel(value: number): number {
		return value * this.decibelsScale! + this.decibelsOffset!
	}

	decibelToValue(db: number): number {
		return (db - this.decibelsOffset!) / this.decibelsScale!
	}

	indexToFreq(index: number): number {
		return index * this.hzPerBin!
	}

	freqToIndex(frequency: number): number {
		return frequency / this.hzPerBin!
	}
}
