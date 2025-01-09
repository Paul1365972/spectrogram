import { persisted } from 'svelte-persisted-store'
import type { SpectrogramSettings } from './types'

export const settings = persisted('settings', {
	tickVariant: 'preset',
	colorMap: 'grayscale',
	interpolation: 'nearest',
	noteGuidelines: false,
	fftSize: 4096,
	smoothingFactor: 0,
	lowerFrequency: 45,
	upperFrequency: 11000,
	emphasis: '0',
	scala: 'log',
	speed: 5,
	volume: 50,
	followPitch: false,
} as SpectrogramSettings)
