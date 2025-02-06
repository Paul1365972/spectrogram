import { blackmanWindow } from './window_functions'

export class FFT {
	readonly size: number
	private readonly reversedBits: Uint32Array
	private readonly real: Float32Array
	private readonly imag: Float32Array
	private readonly twiddleReal: Float32Array
	private readonly twiddleImag: Float32Array
	private readonly window: Float32Array

	constructor(size: number) {
		if (size & (size - 1)) {
			throw new Error('Size must be power of 2')
		}

		this.size = size
		const bits = Math.log2(size)

		this.reversedBits = new Uint32Array(size)
		for (let i = 0; i < size; i++) {
			this.reversedBits[i] = this.reverseBits(i, bits)
		}

		this.real = new Float32Array(size)
		this.imag = new Float32Array(size)

		const totalTwiddles = size / 2
		this.twiddleReal = new Float32Array(totalTwiddles)
		this.twiddleImag = new Float32Array(totalTwiddles)

		for (let i = 0; i < totalTwiddles; i++) {
			const angle = (-2 * Math.PI * i) / size
			this.twiddleReal[i] = Math.cos(angle)
			this.twiddleImag[i] = Math.sin(angle)
		}

		this.window = blackmanWindow(size)
	}

	private reverseBits(num: number, bits: number): number {
		let reversed = 0
		for (let i = 0; i < bits; i++) {
			reversed = (reversed << 1) | ((num >> i) & 1)
		}
		return reversed
	}

	public fft(input: Float32Array): Float32Array {
		if (input.length !== this.size) {
			throw new Error('Input size must match FFT size')
		}

		for (let i = 0; i < this.size; i++) {
			const revIndex = this.reversedBits[i]
			this.real[i] = input[revIndex] * this.window[revIndex]
		}
		this.imag.fill(0)

		// Cooley-Tukey FFT
		for (let size = 2; size <= this.size; size *= 2) {
			const halfSize = size / 2
			const twiddleStep = this.size / size

			for (let i = 0; i < this.size; i += size) {
				for (let j = 0; j < halfSize; j++) {
					const twiddleIndex = j * twiddleStep
					const evenIndex = i + j
					const oddIndex = i + j + halfSize

					const oddReal = this.real[oddIndex]
					const oddImag = this.imag[oddIndex]

					const evenReal = this.real[evenIndex]
					const evenImag = this.imag[evenIndex]

					const twReal = this.twiddleReal[twiddleIndex]
					const twImag = this.twiddleImag[twiddleIndex]

					const tempReal = oddReal * twReal - oddImag * twImag
					const tempImag = oddReal * twImag + oddImag * twReal

					this.real[oddIndex] = evenReal - tempReal
					this.imag[oddIndex] = evenImag - tempImag
					this.real[evenIndex] = evenReal + tempReal
					this.imag[evenIndex] = evenImag + tempImag
				}
			}
		}

		const output = new Float32Array(this.size / 2)
		const scale = 1 / this.size
		for (let i = 0; i < this.size / 2; i++) {
			const power = (this.real[i] * this.real[i] + this.imag[i] * this.imag[i]) * scale
			output[i] = 10 * Math.log10(power)
		}
		return output
	}
}
