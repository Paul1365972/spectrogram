export class Complex {
	constructor(
		public real: number,
		public imag: number,
	) {}

	static fromPolar(r: number, theta: number) {
		return new Complex(r * Math.cos(theta), r * Math.sin(theta))
	}

	add(other: Complex) {
		return new Complex(this.real + other.real, this.imag + other.imag)
	}

	sub(other: Complex) {
		return new Complex(this.real - other.real, this.imag - other.imag)
	}

	mul(other: Complex) {
		return new Complex(
			this.real * other.real - this.imag * other.imag,
			this.real * other.imag + this.imag * other.real,
		)
	}

	div(other: Complex) {
		const denom = other.real * other.real + other.imag * other.imag
		return new Complex(
			(this.real * other.real + this.imag * other.imag) / denom,
			(this.imag * other.real - this.real * other.imag) / denom,
		)
	}

	magnitude() {
		return Math.sqrt(this.real * this.real + this.imag * this.imag)
	}

	angle() {
		return Math.atan2(this.imag, this.real)
	}

	isFinite() {
		return Number.isFinite(this.real) && Number.isFinite(this.imag)
	}
}
