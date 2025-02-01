import { get, type Writable } from 'svelte/store'
import { audioSourcesToTargets, audioTargetsToSources, type AudioTargets } from './audio_sources'
import { type SpectrogramSettings } from './settings'

export const MAX_HISTORY = 2048

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
	autoGainControl: false,
	echoCancellation: false,
	noiseSuppression: false,
	channelCount: { ideal: 1 },
	sampleRate: { ideal: 48000 },
}

export class AudioManager {
	private audioContext: AudioContext | null = null
	private gainNode: GainNode | null = null
	private oscillatorNode: OscillatorNode | null = null
	private microphone: AudioBuffer | null = null
	private desktop: AudioBuffer | null = null
	private sampleRate: number | null = null
	private audioSources: AudioTargets = {
		microphone: false,
		desktop: false,
	}

	initialize() {
		this.audioContext = new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 })

		this.sampleRate = this.audioContext.sampleRate

		this.gainNode = this.audioContext.createGain()
		this.gainNode.gain.value = 0.0
		this.gainNode.connect(this.audioContext.destination)

		this.oscillatorNode = this.audioContext.createOscillator()
		this.oscillatorNode.connect(this.gainNode)
		this.oscillatorNode.start()
	}

	updateSources(settings: Writable<SpectrogramSettings>) {
		const target = audioSourcesToTargets(get(settings).audioSource)
		if (this.audioSources.microphone && !target.microphone) {
			this.microphone?.destroy()
			this.microphone = null
		}
		if (!this.audioSources.microphone && target.microphone) {
			navigator.mediaDevices
				.getUserMedia({
					audio: AUDIO_CONSTRAINTS,
					video: false,
				})
				.then((stream) => {
					this.microphone = new AudioBuffer(this.audioContext!, stream)
				})
				.catch((error) => {
					settings.update((v) => {
						v.audioSource = audioTargetsToSources({ ...target, ...{ microphone: false } })
						return v
					})
					console.log(error)
				})
		}
		if (this.audioSources.desktop && !target.desktop) {
			this.desktop?.destroy()
			this.desktop = null
		}
		if (!this.audioSources.desktop && target.desktop) {
			navigator.mediaDevices
				.getDisplayMedia({
					audio: AUDIO_CONSTRAINTS,
				})
				.then((stream) => {
					this.desktop = new AudioBuffer(this.audioContext!, stream)
				})
				.catch((error) => {
					settings.update((v) => {
						v.audioSource = audioTargetsToSources({ ...target, ...{ desktop: false } })
						return v
					})
					console.log(error)
				})
		}
		this.audioSources = target
	}

	update(settings: SpectrogramSettings) {
		for (const source of [this.desktop, this.microphone]) {
			if (source) {
				source.setFFTSize(settings.fftSize)
				source.setSmoothingFactor(settings.smoothingFactor)
				source.update()
			}
		}
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

	getMicrophone() {
		return this.microphone
	}

	getDesktop() {
		return this.desktop
	}

	getPrimary() {
		if (this.microphone) {
			return this.microphone
		}
		return this.desktop
	}

	getSampleRate() {
		return this.sampleRate!
	}

	getNyquist() {
		return this.sampleRate! / 2.0
	}
}

export class AudioBuffer {
	public stream: MediaStream
	public source: MediaStreamAudioSourceNode
	public analyser: AnalyserNode
	public time: Float32Array
	public freq: Float32Array
	public freqNormalized: Float32Array
	public history: Float32Array
	public offset: number

	constructor(audioContext: AudioContext, stream: MediaStream) {
		this.stream = stream
		this.source = audioContext.createMediaStreamSource(stream)
		this.analyser = audioContext.createAnalyser()
		this.source.connect(this.analyser)

		const fftSize = this.analyser.fftSize
		const frequencyBinCount = this.analyser.frequencyBinCount
		this.time = new Float32Array(fftSize)
		this.freq = new Float32Array(frequencyBinCount)
		this.freqNormalized = new Float32Array(frequencyBinCount)
		this.history = new Float32Array(frequencyBinCount * MAX_HISTORY).fill(Number.NEGATIVE_INFINITY)
		this.offset = 0
	}

	setSmoothingFactor(smoothingFactor: number) {
		this.analyser.smoothingTimeConstant = smoothingFactor
	}

	setFFTSize(fftSize: number) {
		this.analyser.fftSize = fftSize
		if (this.time.length !== this.analyser.fftSize) {
			this.time = new Float32Array(this.analyser.fftSize)
		}
		if (this.freq.length !== this.analyser.frequencyBinCount) {
			this.freq = new Float32Array(this.analyser.frequencyBinCount)
		}
		if (this.freqNormalized.length !== this.analyser.frequencyBinCount) {
			this.freqNormalized = new Float32Array(this.analyser.frequencyBinCount)
		}
		if (this.history.length !== this.analyser.frequencyBinCount * MAX_HISTORY) {
			this.history = new Float32Array(this.analyser.frequencyBinCount * MAX_HISTORY).fill(
				Number.NEGATIVE_INFINITY,
			)
		}
	}

	update() {
		this.analyser.getFloatTimeDomainData(this.time)
		this.analyser.getFloatFrequencyData(this.freq)

		const minDecibels = this.analyser.minDecibels
		const maxDecibels = this.analyser.maxDecibels
		for (let i = 0; i < this.freq.length; i++) {
			this.freqNormalized[i] = Math.max(
				0,
				Math.min(1, (this.freq[i] - minDecibels) / (maxDecibels - minDecibels)),
			)
		}

		this.history.set(this.freq, this.offset * this.analyser.frequencyBinCount)
		this.offset = (this.offset + 1) % MAX_HISTORY
	}

	destroy() {
		this.analyser.disconnect()
		this.source.disconnect()
		for (const track of this.stream.getTracks()) {
			track.stop()
		}
	}
}
