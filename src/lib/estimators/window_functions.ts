export function applyBlackmanWindow(signal: Float32Array) {
	const N = signal.length
	const windowed = new Float32Array(N)

	const alpha = 0.16
	const a0 = 0.5 * (1 - alpha)
	const a1 = 0.5
	const a2 = 0.5 * alpha

	for (let n = 0; n < N; n++) {
		// Blackman window equation: w(n) = 0.42 - 0.5 * cos(2πn/(N-1)) + 0.08 * cos(4πn/(N-1))
		const iTwoPiN = (2 * Math.PI * n) / (N - 1)
		const window = a0 - a1 * Math.cos(iTwoPiN) + a2 * Math.cos(2 * iTwoPiN)
		windowed[n] = signal[n] * window
	}

	return windowed
}

export function applyHammingWindow(signal: Float32Array): Float32Array {
	const N = signal.length
	const windowed = new Float32Array(N)
	const alpha = 0.53836
	const beta = 1 - alpha

	for (let n = 0; n < N; n++) {
		// Hamming window equation: w(n) = α - β * cos(2π * n / (N-1))
		const window = alpha - beta * Math.cos((2 * Math.PI * n) / (N - 1))
		windowed[n] = signal[n] * window
	}

	return windowed
}

export function applyHannWindow(signal: Float32Array): Float32Array {
	const N = signal.length
	const windowed = new Float32Array(N)

	for (let n = 0; n < N; n++) {
		// Hanning window equation: w(n) = 0.5 - 0.5 * cos(2π * n / (N-1)))
		const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (N - 1))
		windowed[n] = signal[n] * window
	}

	return windowed
}
