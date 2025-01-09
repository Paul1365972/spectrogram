export function linearInterpolation(array: Uint8Array, index: number): number {
	const lowerIndex = Math.floor(index)
	const upperIndex = Math.ceil(index)
	const fraction = index - lowerIndex
	return array[lowerIndex] * (1 - fraction) + array[upperIndex] * fraction
}

export function maximumInterpolation(
	array: Uint8Array,
	lowIndex: number,
	highIndex: number,
): number {
	lowIndex = Math.round(lowIndex)
	highIndex = Math.round(highIndex)
	let max = 0
	for (let i = lowIndex; i <= highIndex; i++) {
		max = Math.max(array[i] || 0, max)
	}
	return max
}

export function averagingInterpolation(array: Uint8Array, a: number, b: number): number {
	a = Math.max(0.0001, Math.min(a, array.length - 1))
	b = Math.max(0.0001, Math.min(b, array.length - 1))
	const lowIndex = Math.ceil(a)
	const highIndex = Math.floor(b)
	const lowFrac = lowIndex - a
	const highFrac = b - highIndex
	let avg = 0.0
	avg += (array[lowIndex - 1] || 0) * lowFrac
	for (let i = lowIndex; i < highIndex; i++) {
		avg += array[i] || 0
	}
	avg += (array[highIndex] || 0) * highFrac
	if (lowIndex > highIndex) {
		return avg / (lowFrac + highFrac)
	}
	return avg / (lowFrac + highFrac + highIndex - lowIndex)
}
