export function identityWindow(length: number) {
	const window = new Float32Array(length)

	for (let n = 0; n < length; n++) {
		// Hanning window equation: w(n) = 0.5 - 0.5 * cos(2π * n / (N-1)))
		window[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (length - 1))
	}

	return window
}

export function blackmanWindow(length: number) {
	const window = new Float32Array(length)

	const alpha = 0.16
	const a0 = 0.5 * (1 - alpha)
	const a1 = 0.5
	const a2 = 0.5 * alpha

	for (let n = 0; n < length; n++) {
		// Blackman window equation: w(n) = 0.42 - 0.5 * cos(2πn/(N-1)) + 0.08 * cos(4πn/(N-1))
		const iTwoPiN = (2 * Math.PI * n) / (length - 1)
		window[n] = a0 - a1 * Math.cos(iTwoPiN) + a2 * Math.cos(2 * iTwoPiN)
	}

	return window
}

export function hammingWindow(length: number) {
	const window = new Float32Array(length)

	const alpha = 0.53836
	const beta = 1 - alpha

	for (let n = 0; n < length; n++) {
		// Hamming window equation: w(n) = α - β * cos(2π * n / (N-1))
		window[n] = alpha - beta * Math.cos((2 * Math.PI * n) / (length - 1))
	}

	return window
}

export function hannWindow(length: number) {
	const window = new Float32Array(length)

	for (let n = 0; n < length; n++) {
		// Hanning window equation: w(n) = 0.5 - 0.5 * cos(2π * n / (N-1)))
		window[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (length - 1))
	}

	return window
}

export function apply(signal: Float32Array | Float64Array, kernel: Float32Array | Float64Array) {
	if (signal.length !== kernel.length) {
		throw new Error()
	}
	for (let n = 0; n < signal.length; n++) {
		signal[n] *= kernel[n]
	}
}
