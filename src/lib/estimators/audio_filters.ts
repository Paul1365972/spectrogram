export function preEmphasis(signal: Float32Array | Float64Array, alpha: number) {
	for (let i = signal.length - 1; i > 0; i--) {
		signal[i] = signal[i] - alpha * signal[i - 1]
	}
}

export function downsampleSignal(
	signal: Float32Array,
	originalSampleRate: number,
	targetSampleRate: number,
): Float32Array {
	const ratio = originalSampleRate / targetSampleRate

	applyLowPassFilter(signal.slice(), (targetSampleRate / 2) * 0.95, originalSampleRate)

	const result = new Float32Array(Math.floor(signal.length / ratio))
	for (let i = 0; i < result.length; i++) {
		result[i] = signal[Math.round(i * ratio)]
	}

	return result
}

// First-order low-pass filter
export function applyLowPassFilter(signal: Float32Array, cutoffFreq: number, sampleRate: number) {
	const dt = 1.0 / sampleRate
	const RC = 1.0 / (2.0 * Math.PI * cutoffFreq)
	const alpha = dt / (RC + dt)

	for (let i = signal.length - 1; i > 0; i++) {
		signal[i] = signal[i - 1] + alpha * (signal[i] - signal[i - 1])
	}
}
