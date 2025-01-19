<script lang="ts">
	import { logScale, inverseLogScale, linearScale, inverseLinearScale } from '../lib/scales'

	interface Props {
		id?: string
		lowerValue: number
		upperValue: number
		minValue: number
		maxValue: number
		defaultLowerValue?: number
		defaultUpperValue?: number
		minSeparationPercentage?: number
		logarithmic?: boolean
		unit?: string
		onChange: (lower: number, upper: number) => void
	}

	let {
		id,
		lowerValue,
		upperValue,
		minValue,
		maxValue,
		defaultLowerValue,
		defaultUpperValue,
		minSeparationPercentage = 0.05,
		logarithmic = false,
		unit = '',
		onChange,
	}: Props = $props()

	function scale(value: number) {
		if (logarithmic) {
			return logScale(value, minValue, maxValue)
		} else {
			return linearScale(value, minValue, maxValue)
		}
	}

	function inverseScale(value: number) {
		if (logarithmic) {
			return inverseLogScale(value, minValue, maxValue)
		} else {
			return inverseLinearScale(value, minValue, maxValue)
		}
	}

	let lowerPercentage = $derived(inverseScale(lowerValue))
	let upperPercentage = $derived(inverseScale(upperValue))

	function handleStart(event: MouseEvent | TouchEvent, isLower: boolean) {
		event.preventDefault()
		const slider = event.currentTarget as HTMLElement
		const rect = slider.parentElement!.getBoundingClientRect()
		const startX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX
		const startPos = isLower ? lowerPercentage : upperPercentage

		function onMove(event: MouseEvent | TouchEvent) {
			const currentX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX
			const delta = (currentX - startX) / rect.width
			let newPercentage = Math.max(0, Math.min(1, startPos + delta))

			if (isLower) {
				newPercentage = Math.min(newPercentage, upperPercentage - minSeparationPercentage)
				const newLower = scale(newPercentage)
				onChange(newLower, upperValue)
			} else {
				newPercentage = Math.max(newPercentage, lowerPercentage + minSeparationPercentage)
				const newUpper = scale(newPercentage)
				onChange(lowerValue, newUpper)
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

	function handleLowerDoubleClick(event: MouseEvent | TouchEvent) {
		if (defaultLowerValue != null && defaultLowerValue < upperValue) {
			onChange(defaultLowerValue, upperValue)
			event.stopPropagation()
		}
	}
	function handleUpperDoubleClick(event: MouseEvent | TouchEvent) {
		if (defaultUpperValue != null && defaultUpperValue > lowerValue) {
			onChange(lowerValue, defaultUpperValue)
			event.stopPropagation()
		}
	}
	function handleDoubleClick(event: MouseEvent | TouchEvent) {
		if (defaultLowerValue != null && defaultUpperValue != null) {
			onChange(defaultLowerValue, defaultUpperValue)
			event.stopPropagation()
		}
	}
</script>

<div {id} class="slider-container" role="button" tabindex="0" ondblclick={handleDoubleClick}>
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
		ondblclick={handleLowerDoubleClick}
	>
		<span class="freq-label">{Math.round(lowerValue)} {unit}</span>
	</button>
	<button
		class="handle handle-upper"
		style="left: {upperPercentage * 100}%"
		onmousedown={(e) => handleStart(e, false)}
		ontouchstart={(e) => handleStart(e, false)}
		ondblclick={handleUpperDoubleClick}
	>
		<span class="freq-label">{Math.round(upperValue)} {unit}</span>
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
