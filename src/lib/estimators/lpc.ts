import { Complex } from '../math/complex'
import { apply, hammingWindow, hannWindow } from './window_functions'

export interface Formant {
	frequency: number
	bandwidth: number
	dB: number
}

function preEmphasis(signal: Float32Array) {
	const alpha = 0.95
	for (let i = signal.length - 1; i > 0; i--) {
		signal[i] = signal[i] - alpha * signal[i - 1]
	}
}

function normalizeSignal(signal: Float32Array) {
	const N = signal.length

	let sum = 0
	for (let n = 0; n < N; n++) {
		sum += signal[n]
	}
	const average = sum / N
	for (let n = 0; n < N; n++) {
		signal[n] -= average
	}
}

function computeAutocorrelation(signal: Float32Array, lpcOrder: number) {
	const N = signal.length
	const R = new Float32Array(lpcOrder + 1)

	for (let k = 0; k <= lpcOrder; k++) {
		for (let n = 0; n < N - k; n++) {
			R[k] += signal[n] * signal[n + k]
		}
		R[k] /= N - k
	}

	return R
}

function levinsonDurbin(R: Float32Array, lpcOrder: number) {
	const a = new Float32Array(lpcOrder + 1)

	// Initialize
	a[0] = 1.0
	let error = R[0]

	// Main recursion
	for (let i = 0; i < lpcOrder; i++) {
		// Compute reflection coefficient
		let sum = R[i + 1]
		for (let j = 0; j < i; j++) {
			sum += a[j + 1] * R[i - j]
		}
		const k = -sum / error

		// Update coefficients
		const oldA = new Float32Array(a)
		for (let j = 0; j < i; j++) {
			a[j + 1] += k * oldA[i - j]
		}
		a[i + 1] = k

		// Update error
		error *= 1 - k * k

		if (error <= 0) {
			console.warn(`TODO: Non-positive prediction error at order ${i + 1}`)
			break
		}
	}

	return a
}

function evaluatePolynomial(z: Complex, coefficients: Float32Array): Complex {
	let result = new Complex(0, 0)
	for (let i = 0; i < coefficients.length; i++) {
		result = result.mul(z).add(new Complex(coefficients[i], 0))
	}
	return result
}

function durandKerner(coefficients: Float32Array): Complex[] {
	const n = coefficients.length - 1
	let roots: Complex[] = []

	// Initialize guess roots on the unit circle
	for (let i = 0; i < n; i++) {
		const angle = (2 * Math.PI * i) / n
		roots.push(Complex.fromPolar(0.9, angle))
	}

	const MAX_ITERATIONS = 10000
	const EPSILON = 1e-8

	// Durand-Kerner
	for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
		let maxDiff = 0

		for (let i = 0; i < roots.length; i++) {
			// Compute the next approximation
			let numerator = evaluatePolynomial(roots[i], coefficients)
			let denominator = new Complex(1, 0)
			for (let j = 0; j < n; j++) {
				if (j !== i) {
					denominator = denominator.mul(roots[i].sub(roots[j]))
				}
			}

			const offset = numerator.div(denominator)
			let newRoot = roots[i].sub(offset)
			if (newRoot.isFinite()) {
				roots[i] = newRoot
				const diff = offset.magnitude()
				maxDiff = Math.max(maxDiff, diff)
			}
		}

		// Check convergence
		if (maxDiff < EPSILON) {
			return roots
		}
	}

	console.warn('TODO: Gave up finding better roots')
	return roots
}

function extractFormants(roots: Complex[], sampleRate: number) {
	return (
		roots
			//.filter((root) => root.imag > 0)
			.map((root) => {
				const frequency = (root.angle() / (2 * Math.PI)) * sampleRate
				const bandwidth = (-Math.log(root.magnitude()) / Math.PI) * sampleRate
				const dB = 20 * Math.log10(root.magnitude())
				return { frequency, bandwidth, dB }
			})
			.sort((a, b) => a.frequency - b.frequency)
	)
	//.filter(
	//	(formant) =>
	//		formant.frequency > 50 &&
	//		formant.frequency < sampleRate / 2 - 50 &&
	//		formant.bandwidth < 500,
	//)
}

function negateCoefficients(coefficients: Float32Array) {
	let result = new Float32Array(coefficients.length)
	result[0] = coefficients[0]
	for (let i = 1; i < coefficients.length; i++) {
		result[i] = -coefficients[i]
	}
	return result
}

export function computeLPCCoefficients(signal: Float32Array, lpcOrder: number) {
	signal = new Float32Array(signal)
	preEmphasis(signal)
	apply(signal, hammingWindow(signal.length))
	normalizeSignal(signal)
	const R = computeAutocorrelation(signal, lpcOrder)
	const lpcCoefficients = levinsonDurbin(R, lpcOrder)
	const polynomialCoefficients = negateCoefficients(lpcCoefficients)
	return polynomialCoefficients
}

export function computeLPCFormants(coefficients: Float32Array, sampleRate: number) {
	const roots = durandKerner(coefficients)
	const formants = extractFormants(roots, sampleRate)
	return formants
}

export function computeLPCResonance(
	coefficients: Float32Array,
	frequency: number,
	sampleRate: number,
) {
	const omega = (2 * Math.PI * frequency) / sampleRate

	let denominator = new Complex(1, 0)
	for (let i = 0; i < coefficients.length; i++) {
		const angle = -omega * (i + 1)
		const coeff = new Complex(coefficients[i], 0)
		const z = Complex.fromPolar(1, angle)
		denominator = denominator.sub(coeff.mul(z))
	}

	const resonance = 1 / denominator.magnitude()
	return resonance
}
