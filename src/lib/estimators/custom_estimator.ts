import type { AudioBuffer, AudioManager } from '../audio'
import type { SpectrogramSettings } from '../settings'

// Parabolic interpolation
export function refinePeak(array: ArrayLike<number>, index: number) {
	const a = array[Math.max(0, index - 1)]
	const b = array[index]
	const c = array[Math.min(array.length - 1, index + 1)]
	const p = (0.5 * (a - c)) / (a - 2.0 * b + c)
	return { index: index + p, value: b - 0.25 * (a - c) * p }
}

// Greedily try to find the maximas
export function findMaximumFrequencies(
	audioManager: AudioManager,
	audioBuffer: AudioBuffer,
	amount: number,
) {
	const freqBuffer = audioBuffer.freq
	const hzPerBin = audioManager.getNyquist() / freqBuffer.length
	const minDistance = 50 / hzPerBin

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
		const { index } = refinePeak(freqBuffer, point)
		const frequency = index * hzPerBin
		maximas.push(frequency)
	}

	return maximas
}

// Find Fundamental Frequency via Harmonic Product Spectrum
export function findFundamentalFrequency(
	audioManager: AudioManager,
	audioBuffer: AudioBuffer,
	partials: number,
) {
	const freqBuffer = audioBuffer.freqNormalized
	const hzPerBin = audioManager.getNyquist() / freqBuffer.length
	const lowerCutoff = Math.floor(50.0 / hzPerBin)
	const upperCutoff = Math.ceil(600.0 / hzPerBin)

	const buffer = new Float32Array(freqBuffer.length).fill(1)

	for (let i = 1; i <= partials; i++) {
		const iReciprocal = 1 / i
		for (let j = lowerCutoff; j < upperCutoff; j++) {
			let value = 0
			for (let k = 0; k < i; k++) {
				value += freqBuffer[j * i + k]
			}
			buffer[j] *= 0.1 + 0.9 * value * iReciprocal
		}
	}

	let maxIndex = lowerCutoff
	for (let i = lowerCutoff; i < upperCutoff; i++) {
		if (buffer[i] > buffer[maxIndex]) {
			maxIndex = i
		}
	}

	const frequency = maxIndex * hzPerBin
	// TODO: The confidence calculation is not optimal
	const max = Math.max(...freqBuffer.slice(lowerCutoff, upperCutoff))
	const theoreticalMax = Math.pow(0.1 + 0.9 * max, partials)
	const confidence = Math.max(
		0.0,
		Math.min(1.0, ((1.0 - Math.log(buffer[maxIndex] / theoreticalMax) / 10) * max) / 255),
	)
	return { frequency, confidence }
}
