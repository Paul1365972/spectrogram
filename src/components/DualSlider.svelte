<script lang="ts">
	import { logScale, inverseLogScale } from '../lib/scales'
	import { getDefaultSettings } from '../lib/settings'
	import { settings } from '../lib/store'

	let { id } = $props()

	const MIN_FREQ = 20
	const MAX_FREQ = 20000
	const MIN_RANGE_RATIO = 0.05

	let lowerPercentage = $derived(inverseLogScale($settings.lowerFrequency, MIN_FREQ, MAX_FREQ))
	let upperPercentage = $derived(inverseLogScale($settings.upperFrequency, MIN_FREQ, MAX_FREQ))

	function handleStart(event: MouseEvent | TouchEvent, isLower: boolean) {
		event.preventDefault()
		const slider = event.currentTarget as HTMLElement
		const rect = slider.parentElement!.getBoundingClientRect()
		const startX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX
		const startPos = isLower ? lowerPercentage : upperPercentage

		function onMove(moveEvent: MouseEvent | TouchEvent) {
			const currentX =
				moveEvent instanceof MouseEvent ? moveEvent.clientX : moveEvent.touches[0].clientX
			const delta = (currentX - startX) / rect.width
			let newPercentage = Math.max(0, Math.min(1, startPos + delta))

			if (isLower) {
				newPercentage = Math.min(newPercentage, upperPercentage - MIN_RANGE_RATIO)
				$settings.lowerFrequency = logScale(newPercentage, MIN_FREQ, MAX_FREQ)
			} else {
				newPercentage = Math.max(newPercentage, lowerPercentage + MIN_RANGE_RATIO)
				$settings.upperFrequency = logScale(newPercentage, MIN_FREQ, MAX_FREQ)
			}
		}

		function onEnd() {
			window.removeEventListener('mousemove', onMove)
			window.removeEventListener('mouseup', onEnd)
			window.removeEventListener('touchmove', onMove)
			window.removeEventListener('touchend', onEnd)
		}

		window.addEventListener('mousemove', onMove)
		window.addEventListener('mouseup', onEnd)
		window.addEventListener('touchmove', onMove)
		window.addEventListener('touchend', onEnd)
	}

	function handleDoubleClick(event: MouseEvent | TouchEvent, lower: boolean, upper: boolean) {
		event.stopPropagation()
		const defaultSettings = getDefaultSettings()
		if (lower && defaultSettings.lowerFrequency < $settings.upperFrequency) {
			$settings.lowerFrequency = defaultSettings.lowerFrequency
		}
		if (upper && defaultSettings.upperFrequency > $settings.lowerFrequency) {
			$settings.upperFrequency = defaultSettings.upperFrequency
		}
	}
</script>

<div
	{id}
	class="slider-container"
	role="button"
	tabindex="0"
	ondblclick={(e) => handleDoubleClick(e, true, true)}
>
	<div class="track">
		<div
			class="track-fill"
			style="left: {lowerPercentage * 100}%; right: {(1 - upperPercentage) * 100}%"
		></div>
	</div>
	<button
		class="handle handle-lower"
		style="left: {lowerPercentage * 100}%"
		onmousedown={(e) => handleStart(e, true)}
		ontouchstart={(e) => handleStart(e, true)}
		ondblclick={(e) => handleDoubleClick(e, true, false)}
	>
		<span class="freq-label">{Math.round($settings.lowerFrequency)} Hz</span>
	</button>
	<button
		class="handle handle-upper"
		style="left: {upperPercentage * 100}%"
		onmousedown={(e) => handleStart(e, false)}
		ontouchstart={(e) => handleStart(e, false)}
		ondblclick={(e) => handleDoubleClick(e, false, true)}
	>
		<span class="freq-label">{Math.round($settings.upperFrequency)} Hz</span>
	</button>
</div>

<style>
	.slider-container {
		position: relative;
		width: 100%;
		height: 40px;
		display: flex;
		align-items: center;
		margin-right: 20px;
		margin-bottom: 10px;
		touch-action: none;
	}

	.track {
		position: absolute;
		width: 100%;
		height: 5px;
		background-color: #888;
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
		touch-action: none;
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
