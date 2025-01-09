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
}

export type TickVariant = 'none' | 'preset' | 'notes'
export type ColorMap = 'grayscale' | 'magma' | 'inferno'
export type Interpolation = 'nearest' | 'linear' | 'maximum' | 'averaging'
export type ScalaVariant = 'log' | 'linear' | 'mel'
