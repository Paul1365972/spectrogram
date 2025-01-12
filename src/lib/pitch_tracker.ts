const MIN_FREQ = 50
const MAX_FREQ = 1500
const WINDOW_SIZE = 30
const MIN_VALID_SAMPLES = 5
const MAX_OCTAVE_JUMP = 1.5
const EXTREME_OUTLIER_RATIO = 3

export function trackPitch(pitches: (number | null)[]): number | null {
	// Step 1: Create windowed view of recent samples
	const window = pitches.slice(0, Math.min(WINDOW_SIZE, pitches.length))

	// Step 2: Filter out obvious outliers and invalid values
	const filteredPitches = window.map((pitch, i) => {
		// Remove nulls and physically impossible frequencies
		if (pitch === null || pitch < MIN_FREQ || pitch > MAX_FREQ) {
			return null
		}

		// Check for extreme outliers by comparing with neighbors
		const nextPitch = i < window.length - 1 ? window[i + 1] : null
		if (nextPitch !== null) {
			const ratio = pitch / nextPitch
			if (ratio > EXTREME_OUTLIER_RATIO || ratio < 1 / EXTREME_OUTLIER_RATIO) {
				return null
			}
		}

		return pitch
	})

	// Step 3: Find the most recent stable pitch segment
	let stablePitchStart = -1
	let stablePitchEnd = -1
	let currentSegmentStart = -1

	for (let i = 0; i < filteredPitches.length - 1; i++) {
		const current = filteredPitches[i]
		const next = filteredPitches[i + 1]

		if (current === null || next === null) {
			// Reset segment on null values
			currentSegmentStart = -1
			continue
		}

		const ratio = current / next
		if (ratio > MAX_OCTAVE_JUMP || ratio < 1 / MAX_OCTAVE_JUMP) {
			// Reset segment on large jumps
			currentSegmentStart = -1
			continue
		}

		if (currentSegmentStart === -1) {
			currentSegmentStart = i
		}

		// Update most recent stable segment if we have enough samples
		if (i - currentSegmentStart + 1 >= MIN_VALID_SAMPLES) {
			stablePitchStart = currentSegmentStart
			stablePitchEnd = i + 1
		}
	}

	// Step 4: Calculate stable pitch or return null
	if (stablePitchStart === -1 || stablePitchEnd === -1) {
		return null
	}

	// Calculate weighted median of the stable segment
	const stableSegment = filteredPitches
		.slice(stablePitchStart, stablePitchEnd + 1)
		.filter((p): p is number => p !== null)

	if (stableSegment.length < MIN_VALID_SAMPLES) {
		return null
	}

	// Apply exponential weighting favoring recent samples
	const weightedPitches: number[] = []
	stableSegment.forEach((pitch, i) => {
		// Add each pitch multiple times based on recency weight
		const weight = Math.ceil(Math.exp(-i * 0.5) * 10)
		for (let j = 0; j < weight; j++) {
			weightedPitches.push(pitch)
		}
	})

	if (weightedPitches.length === 0) {
		return null
	}

	// Return median of weighted samples
	weightedPitches.sort((a, b) => a - b)
	const medianIndex = Math.floor(weightedPitches.length / 2)
	return weightedPitches[medianIndex]
}
