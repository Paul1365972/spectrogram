import type { AudioSources } from './audio_sources'
import type { ColorMap } from './color_maps'
import type { ScalaVariant } from './scales'

export type SpectrogramSettings = {
	inputBoost: number
	tickVariant: TickVariant
	colorMap: ColorMap
	interpolation: Interpolation
	noteGuidelines: boolean
	timeGuidelines: boolean
	fftSize: 1024 | 2048 | 4096 | 8192 | 16384
	smoothingFactor: number
	preEmphasis: number
	lowerFrequency: number
	upperFrequency: number
	scala: ScalaVariant
	speed: number
	toneVolume: number
	followPitch: boolean
	audioSource: AudioSources
}

export const DEFAULT_SETTINGS: SpectrogramSettings = {
	inputBoost: 0,
	tickVariant: 'preset',
	colorMap: 'grayscale',
	interpolation: 'nearest',
	noteGuidelines: false,
	timeGuidelines: false,
	fftSize: 4096,
	smoothingFactor: 0,
	preEmphasis: 0,
	lowerFrequency: 45,
	upperFrequency: 11000,
	scala: 'log',
	speed: 5,
	toneVolume: 50,
	followPitch: false,
	audioSource: 'microphone',
}

export type TickVariant = 'none' | 'preset' | 'notes'
export const TICK_VARIANTS: TickVariant[] = ['none', 'preset', 'notes']
export type Interpolation = 'nearest' | 'linear'
