<script lang="ts">
	import { logScale, inverseLogScale } from '../lib/utils'

	let { id, lowerFrequency = $bindable(), upperFrequency = $bindable() } = $props()

	const MIN_FREQ = 20
	const MAX_FREQ = 20000
	const MIN_RANGE_RATIO = 0.05

	let lowerPercentage = $state(0)
	let upperPercentage = $state(1)

	// Update internal positions when external frequencies change
	$effect(() => {
		lowerPercentage = inverseLogScale(lowerFrequency, MIN_FREQ, MAX_FREQ)
		upperPercentage = inverseLogScale(upperFrequency, MIN_FREQ, MAX_FREQ)
	})

	// Update frequencies when positions change
	function updateFrequencies() {
		lowerFrequency = Math.round(logScale(lowerPercentage, MIN_FREQ, MAX_FREQ))
		upperFrequency = Math.round(logScale(upperPercentage, MIN_FREQ, MAX_FREQ))
	}

	// Handle dragging
	function handleDrag(event: MouseEvent, isLower: boolean) {
		const slider = event.currentTarget as HTMLElement
		const rect = slider.parentElement!.getBoundingClientRect()
		const startX = event.clientX
		const startPos = isLower ? lowerPercentage : upperPercentage

		function onMove(moveEvent: MouseEvent) {
			const delta = (moveEvent.clientX - startX) / rect.width
			let newPos = Math.max(0, Math.min(1, startPos + delta))

			if (isLower) {
				newPos = Math.min(newPos, upperPercentage - MIN_RANGE_RATIO)
				lowerPercentage = newPos
			} else {
				newPos = Math.max(newPos, lowerPercentage + MIN_RANGE_RATIO)
				upperPercentage = newPos
			}
			updateFrequencies()
		}

		function onUp() {
			window.removeEventListener('mousemove', onMove)
			window.removeEventListener('mouseup', onUp)
		}

		window.addEventListener('mousemove', onMove)
		window.addEventListener('mouseup', onUp)
	}
</script>

<div {id} class="slider-container">
	<div class="track">
		<div
			class="track-fill"
			style="left: {lowerPercentage * 100}%; right: {(1 - upperPercentage) * 100}%"
		></div>
	</div>
	<button
		class="handle handle-lower"
		style="left: {lowerPercentage * 100}%"
		onmousedown={(e) => handleDrag(e, true)}
	>
		<span class="freq-label">{Math.round(lowerFrequency)} Hz</span>
	</button>
	<button
		class="handle handle-upper"
		style="left: {upperPercentage * 100}%"
		onmousedown={(e) => handleDrag(e, false)}
	>
		<span class="freq-label">{Math.round(upperFrequency)} Hz</span>
	</button>
</div>

<style>
	.slider-container {
		position: relative;
		width: 100%;
		height: 40px;
		display: flex;
		align-items: center;
		margin-bottom: 25px;
	}

	.track {
		position: absolute;
		width: 100%;
		height: 4px;
		background-color: #ddd;
		border-radius: 2px;
	}

	.track-fill {
		position: absolute;
		height: 100%;
		background-color: black;
		border-radius: 2px;
	}

	.handle {
		position: absolute;
		width: 20px;
		height: 20px;
		background-color: white;
		border: 2px solid black;
		border-radius: 50%;
		transform: translateX(-50%);
		cursor: pointer;
		z-index: 1;
	}

	.handle:hover,
	.handle:active {
		background-color: #ddd;
	}

	.freq-label {
		position: absolute;
		top: 25px;
		left: 50%;
		transform: translateX(-50%);
		white-space: nowrap;
	}
</style>
