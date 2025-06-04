import { get, type Writable } from 'svelte/store'
import { audioSourcesToTargets, audioTargetsToSources, type AudioTargets } from './audio_sources'
import { type SpectrogramSettings } from './settings'
import { FFT } from './math/fft'
import { apply, blackmanWindow } from './math/audio_functions'
import { preEmphasis } from './math/audio_filters'

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
		function reset(updated: any) {
			settings.update((v) => {
				const newSource = audioTargetsToSources({ ...target, ...updated })
				return { ...v, ...{ audioSource: newSource } }
			})
		}
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
					reset({ microphone: false })
					console.log(error)
				})
		}
		if (this.audioSources.desktop && !target.desktop) {
			this.desktop?.destroy()
			this.desktop = null
		}
		if (!this.audioSources.desktop && target.desktop) {
			if (navigator.mediaDevices.getDisplayMedia == undefined) {
				reset({ desktop: false })
				console.log('getDisplayMedia not supported')
			} else {
				navigator.mediaDevices
					.getDisplayMedia({
						audio: AUDIO_CONSTRAINTS,
					})
					.then((stream) => {
						this.desktop = new AudioBuffer(this.audioContext!, stream)
					})
					.catch((error) => {
						reset({ desktop: false })
						console.log(error)
					})
			}
		}
		this.audioSources = target
	}

	update(settings: SpectrogramSettings) {
		for (const source of [this.desktop, this.microphone]) {
			source?.update(settings)
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

	getAnalysisBuffer() {
		if (this.microphone) {
			return this.microphone
		}
		return this.desktop
	}

	getDisplayBuffer() {
		if (this.desktop) {
			return this.desktop
		}
		return this.microphone
	}

	getSampleRate() {
		return this.sampleRate!
	}

	getNyquist() {
		return this.sampleRate! / 2.0
	}

	destroy() {
		if (this.oscillatorNode) {
			this.oscillatorNode.stop()
			this.oscillatorNode.disconnect()
		}
		if (this.gainNode) {
			this.gainNode.disconnect()
		}
		if (this.microphone) {
			this.microphone.destroy()
		}
		if (this.desktop) {
			this.desktop.destroy()
		}
		if (this.audioContext) {
			this.audioContext.close()
		}
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
	public minDecibels: number
	public maxDecibels: number
	private fft: FFT
	private window: Float32Array

	constructor(audioContext: AudioContext, stream: MediaStream) {
		this.stream = stream
		this.source = audioContext.createMediaStreamSource(stream)
		this.analyser = audioContext.createAnalyser()
		this.source.connect(this.analyser)

		const fftSize = this.analyser.fftSize
		const frequencyBinCount = this.analyser.frequencyBinCount
		this.minDecibels = this.analyser.minDecibels
		this.maxDecibels = this.analyser.maxDecibels
		this.time = new Float32Array(fftSize)
		this.freq = new Float32Array(frequencyBinCount)
		this.freqNormalized = new Float32Array(frequencyBinCount)
		this.history = new Float32Array(frequencyBinCount * MAX_HISTORY).fill(Number.NEGATIVE_INFINITY)
		this.offset = 0
		this.fft = new FFT(fftSize)
		this.window = blackmanWindow(fftSize)
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
			const newHistory = new Float32Array(this.analyser.frequencyBinCount * MAX_HISTORY)
			const factor = this.history.length / newHistory.length
			const binCount = this.analyser.frequencyBinCount
			const oldBinCount = this.history.length / MAX_HISTORY
			for (let i = 0; i < MAX_HISTORY; i++) {
				for (let j = 0; j < binCount; j++) {
					let sum = 0
					for (let k = 0; k < factor; k++) {
						sum += this.history[i * oldBinCount + Math.floor(j * factor) + k]
					}
					newHistory[i * binCount + j] = sum / Math.max(1, factor)
				}
			}
			this.history = newHistory
		}
		if (this.fft.size !== this.analyser.fftSize) {
			this.fft = new FFT(this.analyser.fftSize)
		}
		if (this.window.length !== this.analyser.fftSize) {
			this.window = blackmanWindow(this.analyser.fftSize)
		}
	}

	update(settings: SpectrogramSettings) {
		this.setFFTSize(settings.fftSize)
		this.analyser.smoothingTimeConstant = settings.smoothingFactor

		this.analyser.getFloatTimeDomainData(this.time)
		const boostFactor = Math.pow(10, settings.inputBoost / 20)
		const signal = this.time.map((x) => x * boostFactor)
		preEmphasis(signal, settings.preEmphasis)
		apply(signal, this.window)
		this.freq = this.fft.powerSpectrum(signal).map((power) => 10 * Math.log10(power))
		for (let i = 0; i < this.freq.length; i++) {
			this.freqNormalized[i] = Math.max(
				0,
				Math.min(1, (this.freq[i] - this.minDecibels) / (this.maxDecibels - this.minDecibels)),
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
