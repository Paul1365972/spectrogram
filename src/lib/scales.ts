import type { SpectrogramSettings } from './settings'

const NOTE_NAMES = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#']
const notes = []
for (let i = 1; i < 8; i++) {
	for (let j = 0; j < 12; j++) {
		const frequency = Math.pow(2, i - 4 + j / 12) * 440.0
		notes.push({ frequency, name: NOTE_NAMES[j], fullName: `${NOTE_NAMES[j]}${i}` })
	}
}

export const NOTES = notes

export function nearestNote(frequency: number) {
	const index = Math.round((Math.log2(frequency / 440.0) + 3) * 12)
	return NOTES[Math.max(0, Math.min(NOTES.length - 1, index))]
}

export function logScale(x: number, a: number, b: number) {
	const lower = Math.log(a)
	const upper = Math.log(b)
	return Math.exp(lower + x * (upper - lower))
}

export function inverseLogScale(y: number, a: number, b: number) {
	const lower = Math.log(a)
	const upper = Math.log(b)
	return (Math.log(y) - lower) / (upper - lower)
}

export function scale(x: number, settings: SpectrogramSettings) {
	switch (settings.scala) {
		case 'log':
			return logScale(x, settings.lowerFrequency, settings.upperFrequency)
		case 'linear':
			return settings.lowerFrequency + x * (settings.upperFrequency - settings.lowerFrequency)
		case 'mel':
			const lower = 1127 * Math.log(1 + settings.lowerFrequency / 700)
			const upper = 1127 * Math.log(1 + settings.upperFrequency / 700)
			const mel = lower + x * (upper - lower)
			return 700 * (Math.exp(mel / 1127) - 1)
	}
}

export function inverseScale(y: number, settings: SpectrogramSettings) {
	switch (settings.scala) {
		case 'log':
			return inverseLogScale(y, settings.lowerFrequency, settings.upperFrequency)
		case 'linear':
			return (y - settings.lowerFrequency) / (settings.upperFrequency - settings.lowerFrequency)
		case 'mel':
			const lower = 1127 * Math.log(1 + settings.lowerFrequency / 700)
			const upper = 1127 * Math.log(1 + settings.upperFrequency / 700)
			const mel = 1127 * Math.log(1 + y / 700)
			return (mel - lower) / (upper - lower)
	}
}

export type ScalaVariant = 'log' | 'linear' | 'mel'
export const SCALA_VARIANTS: ScalaVariant[] = ['log', 'linear', 'mel']
