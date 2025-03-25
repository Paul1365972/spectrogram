// Formant estimator based on the paper "A MODEL FOR EFFICIENT FORMANT ESTIMATION" by L. Welling and H. Ney

import { FFT } from './fft'
import { apply, hammingWindow } from './audio_functions'
import { preEmphasis } from './audio_filters'

export interface Formant {
	frequency: number
	bandwidth: number
	dB: number
}

export class EfficientFormant {
	private readonly frameSize = 1024

	public readonly sampleRate: number

	private readonly fft: FFT
	private readonly window: Float32Array

	constructor(sampleRate: number) {
		this.sampleRate = sampleRate
		this.fft = new FFT(this.frameSize)
		this.window = hammingWindow(this.frameSize)
	}

	// Compute look-up tables for efficient autocorrelation calculation as in Eq. (4)
	private computeLookupTables(powerSpectrum: Float32Array): Float32Array[] {
		const T: Float32Array[] = new Array(3)

		for (let tau = 0; tau < 3; tau++) {
			T[tau] = new Float32Array(powerSpectrum.length)
			let sum = 0
			T[tau][0] = sum
			for (let i = 1; i < powerSpectrum.length; i++) {
				sum += powerSpectrum[i] * Math.cos((2 * Math.PI * tau * i) / powerSpectrum.length)
				T[tau][i] = sum
			}
		}

		return T
	}

	// Compute minimum error for a segment using Eq. (2)
	private computeSegmentError(
		T: Float32Array[],
		j: number,
		i: number,
	): { error: number; alpha: number; beta: number } {
		// Calculate autocorrelation coefficients using Eq. (3)
		const r0 = T[0][i] - T[0][j]
		const r1 = T[1][i] - T[1][j]
		const r2 = T[2][i] - T[2][j]

		// Calculate optimal resonator parameters
		const denominator = r0 * r0 - r1 * r1

		if (Math.abs(denominator) < 1e-10) {
			return { error: Infinity, alpha: 0, beta: 0 }
		}

		const alpha = (r0 * r1 - r1 * r2) / denominator
		const beta = (r0 * r2 - r1 * r1) / denominator

		// Ensure the resonator is valid: beta < 0 (for resonators as per paper)
		if (beta >= 0) {
			return { error: Infinity, alpha: 0, beta: 0 }
		}

		// Calculate minimum error using Eq. (2)
		const error = r0 - alpha * r1 - beta * r2

		return { error, alpha, beta }
	}

	// Implement dynamic programming algorithm as described in Section 3
	private dynamicProgramming(
		powerSpectrum: Float32Array,
		numFormants: number,
	): {
		boundaries: number[]
		alphas: number[]
		betas: number[]
		errors: number[]
	} {
		// Compute look-up tables for efficient autocorrelation
		const T = this.computeLookupTables(powerSpectrum)

		// Initialize dynamic programming arrays
		const F: Float32Array[] = new Array(numFormants + 1)
		const B: Float32Array[] = new Array(numFormants + 1)
		for (let k = 0; k <= numFormants; k++) {
			F[k] = new Float32Array(powerSpectrum.length).fill(Infinity)
			B[k] = new Float32Array(powerSpectrum.length).fill(0)
		}

		// Precompute segment errors for all possible segments
		const segmentErrors: { error: number; alpha: number; beta: number }[][] = new Array(
			powerSpectrum.length,
		)
		for (let j = 0; j < powerSpectrum.length; j++) {
			segmentErrors[j] = new Array(powerSpectrum.length)
			for (let i = j + 1; i < powerSpectrum.length; i++) {
				segmentErrors[j][i] = this.computeSegmentError(T, j, i)
			}
		}
		F[0][0] = 0

		// Dynamic programming recurrence from Eq. (5)
		for (let i = 1; i < powerSpectrum.length; i++) {
			for (let k = 1; k <= numFormants; k++) {
				for (let j = 0; j < i; j++) {
					const { error } = segmentErrors[j][i]
					const candidateError = F[k - 1][j] + error

					if (candidateError < F[k][i]) {
						F[k][i] = candidateError
						B[k][i] = j
					}
				}
			}
		}

		// Trace back to find segment boundaries
		const boundaries: number[] = new Array(numFormants + 1).fill(0)
		boundaries[numFormants] = powerSpectrum.length - 1

		for (let k = numFormants; k > 0; k--) {
			boundaries[k - 1] = B[k][boundaries[k]]
		}

		// Extract alpha and beta values for each segment
		const alphas: number[] = new Array(numFormants)
		const betas: number[] = new Array(numFormants)
		const errors: number[] = new Array(numFormants)

		for (let k = 0; k < numFormants; k++) {
			const j = boundaries[k]
			const i = boundaries[k + 1]
			if (j >= i) {
				continue
			}
			const { alpha, beta, error } = segmentErrors[j][i]
			alphas[k] = alpha
			betas[k] = beta
			errors[k] = error
		}

		return { boundaries, alphas, betas, errors }
	}

	// Compute formant frequency and bandwidth from resonator parameters
	private computeFormant(
		alpha: number,
		beta: number,
		segmentError: number,
		sampleRate: number,
	): Formant {
		// Compute formant frequency using Eq. (1) from the paper
		const term = (beta * (1 - alpha)) / (4 * alpha)
		const phi = Math.acos(Math.max(-1, Math.min(1, term)))
		const frequency = (phi * sampleRate) / (2 * Math.PI)

		// Compute bandwidth based on resonator poles
		const r = Math.sqrt(-beta)
		const bandwidth = (-Math.log(r) * sampleRate) / Math.PI

		// Compute amplitude in dB
		const dB = -10 * Math.log10(Math.max(1e-10, segmentError))

		return { frequency, bandwidth, dB }
	}

	estimate(signal: Float32Array, numFormants: number): Formant[] {
		signal = signal.slice(signal.length - this.frameSize)
		preEmphasis(signal, 1.0)
		apply(signal, this.window)

		let powerSpectrum = this.fft.powerSpectrum(signal)

		const cutoffIndex = Math.ceil(5000 * (powerSpectrum.length / this.sampleRate))
		powerSpectrum[0] = 0
		powerSpectrum = powerSpectrum.slice(0, cutoffIndex)

		const { alphas, betas, errors } = this.dynamicProgramming(powerSpectrum, numFormants)

		// Compute formant frequencies and bandwidths
		const formants: Formant[] = []

		for (let k = 0; k < numFormants; k++) {
			// Skip invalid formants
			//if (alphas[k] !== 0 && betas[k] < 0) {
			const formant = this.computeFormant(alphas[k], betas[k], errors[k], this.sampleRate)
			formants.push(formant)
			//}
		}

		// Sort formants by frequency (ascending)
		formants.sort((a, b) => a.frequency - b.frequency)

		return formants
	}
}
