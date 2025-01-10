export type SpectrogramSettings = {
	tickVariant: TickVariant
	colorMap: ColorMap
	interpolation: Interpolation
	noteGuidelines: boolean
	fftSize: 1024 | 2048 | 4096 | 8192 | 16384
	smoothingFactor: number
	lowerFrequency: number
	upperFrequency: number
	emphasis: '0' | '3' | '6' | '12'
	scala: ScalaVariant
	speed: number
	volume: number
	followPitch: boolean
}

export function getDefaultSettings() {
	return {
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
	} as SpectrogramSettings
}

export type TickVariant = 'none' | 'preset' | 'notes'
export type ColorMap = 'grayscale' | 'magma' | 'inferno'
export type Interpolation = 'nearest' | 'linear' | 'maximum' | 'averaging'
export type ScalaVariant = 'log' | 'linear' | 'mel'
