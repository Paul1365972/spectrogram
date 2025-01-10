import type { AudioManager } from './audio'
import type { SpectrogramSettings } from './settings'

export function refinePeak(array: ArrayLike<number>, index: number): [number, number] {
	const a = array[Math.max(0, index - 1)]
	const b = array[index]
	const c = array[Math.min(array.length - 1, index + 1)]
	const p = (0.5 * (a - c)) / (a - 2.0 * b + c)
	return [index + p, b - 0.25 * (a - c) * p]
}

// Greedily try to find the maximas
export function findMaximumFrequencies(
	audioManager: AudioManager,
	amount: number,
	settings: SpectrogramSettings,
) {
	const freqBuffer = audioManager.getFreqBuffer()
	const minDistance = audioManager.freqToIndex(50)

	const selectedPoints = []
	for (let i = 0; i < amount; i++) {
		let maxIndex = 0
		next_freq: for (let j = 1; j < freqBuffer.length; j++) {
			if (freqBuffer[j] > freqBuffer[maxIndex]) {
				for (const other of selectedPoints) {
					if (Math.abs(other - j) < minDistance) {
						continue next_freq
					}
				}
				maxIndex = j
			}
		}
		selectedPoints.push(maxIndex)
	}

	const maximas = []
	for (const point of selectedPoints) {
		const [index, _] = refinePeak(freqBuffer, point)
		const frequency = audioManager.indexToFreq(index)
		maximas.push(frequency)
	}

	return maximas
}

export function findFundamentalFrequency(audioManager: AudioManager, partials: number): number {
	const freqBuffer = audioManager.getFreqBuffer()
	const buf = new Float32Array(freqBuffer.length)
	const lowerCutoff = Math.floor(audioManager.freqToIndex(50.0) * partials)
	const upperCutoff = Math.ceil(audioManager.freqToIndex(600.0) * partials)

	for (let i = lowerCutoff; i < upperCutoff; i++) {
		let sum = 0.0
		let product = 1.0
		for (let j = 1; j <= partials; j++) {
			const index = Math.floor((j * i) / partials)
			const value = freqBuffer[index] || 0
			product *= 0.1 + (0.9 * value) / 255.0
			const decibel = audioManager.valueToDecibel(value)
			sum += decibel / partials
		}
		buf[i] = product
	}

	let maxIndex = 0
	for (let i = 0; i < buf.length; i++) {
		if (buf[maxIndex] < buf[i]) {
			maxIndex = i
		}
	}

	const freq = audioManager.indexToFreq(maxIndex / partials)
	return freq
}
