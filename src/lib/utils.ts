import type { ScalaVariant } from './settings'

const NOTE_NAMES = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#']
const notes = []
for (let i = 1; i < 8; i++) {
	for (let j = 0; j < 12; j++) {
		const frequency = Math.pow(2, i - 4 + j / 12) * 440.0
		notes.push({ frequency, name: NOTE_NAMES[j], fullName: `${NOTE_NAMES[j]}${i}` })
	}
}

export const NOTES = notes

export function logScale(x: number, a: number, b: number) {
	x = Math.max(0, Math.min(1, x))
	const logRange = Math.log(b) - Math.log(a)
	return Math.exp(x * logRange + Math.log(a))
}

export function inverseLogScale(y: number, a: number, b: number) {
	y = Math.max(a, Math.min(b, y))
	const logRange = Math.log(b) - Math.log(a)
	return (Math.log(y) - Math.log(a)) / logRange
}

export function scale(
	x: number,
	scalaVariant: ScalaVariant,
	lowerFrequency: number,
	upperFrequency: number,
) {
	if (scalaVariant === 'log') {
		return logScale(x, lowerFrequency, upperFrequency)
	} else if (scalaVariant === 'linear') {
		return lowerFrequency + x * (upperFrequency - lowerFrequency)
	} else if (scalaVariant === 'mel') {
		const lower = 1127 * Math.log(1 + lowerFrequency / 700)
		const upper = 1127 * Math.log(1 + upperFrequency / 700)
		const mel = lower + x * (upper - lower)
		return 700 * Math.exp(mel / 1127 - 1)
	}
	return 0
}
