import { Complex } from '../math/complex'
import { applyHannWindow } from './window_functions'

export interface Formant {
	frequency: number
	bandwidth: number
	dB: number
}

function computeAutocorrelation(signal: Float32Array, lpcOrder: number) {
	const N = signal.length
	const R = new Float32Array(lpcOrder + 1)

	for (let k = 0; k <= lpcOrder; k++) {
		for (let n = 0; n < N - k; n++) {
			R[k] += signal[n] * signal[n + k]
		}
		R[k] /= N
	}

	return R
}

function levinsonDurbin(R: Float32Array, lpcOrder: number) {
	const a = new Float32Array(lpcOrder + 1)
	const E = new Float32Array(lpcOrder + 1)

	// Initialize
	a[0] = 1.0
	E[0] = R[0]

	// Main recursion
	for (let i = 0; i < lpcOrder; i++) {
		// Compute reflection coefficient
		let numerator = R[i + 1]
		for (let j = 0; j < i; j++) {
			numerator += a[j + 1] * R[i - j]
		}
		const ki = -numerator / E[i]

		// Update coefficients
		a[i + 1] = ki
		for (let j = 0; j < i; j++) {
			a[j + 1] += ki * a[i - j]
		}

		// Update error
		E[i + 1] = E[i] * (1 - ki * ki)

		if (E[i + 1] <= 0) {
			console.warn(`TODO: Non-positive prediction error at order ${i + 1}`)
		}
	}

	//const error = E[lpcOrder]
	return a
}

function evaluatePolynomial(z: Complex, coefficients: Float32Array): Complex {
	let result = new Complex(0, 0)
	for (let i = coefficients.length - 1; i >= 0; i--) {
		result = result.multiply(z).add(new Complex(coefficients[i], 0))
	}
	return result
}

function durandKerner(coefficients: Float32Array): Complex[] {
	const n = coefficients.length - 1
	let roots: Complex[] = []

	// Initialize guess roots on the unit circle
	for (let i = 0; i < n; i++) {
		const angle = (2 * Math.PI * i) / n
		roots.push(Complex.fromPolar(1, angle))
	}

	const MAX_ITERATIONS = 1000
	const EPSILON = 1e-10

	// Durand-Kerner
	for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
		let maxDiff = 0

		roots = roots.map((root, i) => {
			// Compute the next approximation
			let numerator = evaluatePolynomial(root, coefficients)
			let denominator = new Complex(1, 0)
			for (let j = 0; j < n; j++) {
				if (j !== i) {
					denominator = denominator.multiply(root.subtract(roots[j]))
				}
			}

			const newRoot = root.subtract(numerator.divide(denominator))
			const diff = newRoot.subtract(root).magnitude()
			maxDiff = Math.max(maxDiff, diff)

			return newRoot
		})

		// Check convergence
		if (maxDiff < EPSILON) {
			return roots
		}
	}

	console.warn('TODO: Gave up finding better roots')
	return roots
}

function extractFormants(roots: Complex[], sampleRate: number) {
	return roots
		.filter((root) => root.imag > 0)
		.map((root) => {
			const frequency = (root.angle() * sampleRate) / (2 * Math.PI)
			const bandwidth = (-Math.log(root.magnitude()) * sampleRate) / Math.PI
			const dB = 20 * Math.log10(root.magnitude())
			return { frequency, bandwidth, dB }
		})
		.sort((a, b) => a.frequency - b.frequency)
		.filter(
			(formant) =>
				formant.frequency > 50 &&
				formant.frequency < sampleRate / 2 - 50 &&
				formant.bandwidth < 500,
		)
}

function negateCoefficients(coefficients: Float32Array) {
	let result = new Float32Array(coefficients.length)
	result[0] = coefficients[0]
	for (let i = 1; i < coefficients.length; i++) {
		result[i] = -coefficients[i]
	}
	return result
}

export function analyzeLPC(signal: Float32Array, lpcOrder: number, sampleRate: number) {
	if (signal.length <= lpcOrder) {
		throw new Error('Signal length must be greater than LPC order')
	}

	const windowed = applyHannWindow(signal)
	const R = computeAutocorrelation(windowed, lpcOrder)
	const lpcCoefficients = levinsonDurbin(R, lpcOrder)
	const polynomialCoefficients = negateCoefficients(lpcCoefficients)
	const roots = durandKerner(polynomialCoefficients)
	const formants = extractFormants(roots, sampleRate)
	return formants
}
