<script lang="ts">
	import { onMount } from 'svelte'
	import { get } from 'svelte/store'
	import { AudioManager } from '../lib/audio'
	import { Renderer } from '../lib/renderer'
	import { scale } from '../lib/scales'
	import { settings as settingsStore } from '../lib/store'
	import { EstimatorManager } from '../lib/estimator'
	import { smoothPitches } from '../lib/pitch_smoothing'
	import { TICK_VARIANTS } from '../lib/settings'
	import { COLOR_MAPS } from '../lib/color_maps'

	let canvas: HTMLCanvasElement

	let initialized: boolean = $state(false)
	let settings = get(settingsStore)
	let paused = false

	let audioManager: AudioManager
	let estimatorManager: EstimatorManager
	let renderer: Renderer

	let toneEnabled: boolean = false
	let mousePosition: [number, number] = [0, 0]

	let momentum: number = 0

	onMount(() => {
		audioManager = new AudioManager()
		estimatorManager = new EstimatorManager(audioManager)
		renderer = new Renderer(canvas, audioManager, estimatorManager)

		window.addEventListener('mousedown', init)
		window.addEventListener('touchstart', init)
		window.addEventListener('keydown', handleKeydown)

		return () => {
			window.removeEventListener('mousedown', init)
			window.removeEventListener('touchstart', init)
			window.removeEventListener('keydown', handleKeydown)
		}
	})

	async function init() {
		window.removeEventListener('mousedown', init)
		window.removeEventListener('touchstart', init)
		if (!initialized) {
			await audioManager.initialize()
			await estimatorManager.initialize()
			initialized = true
			requestAnimationFrame(render)
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.code === 'Space') {
			paused = !paused
		} else if (event.code === 'KeyF') {
			$settingsStore.followPitch = !$settingsStore.followPitch
		} else if (event.code === 'KeyG') {
			$settingsStore.noteGuidelines = !$settingsStore.noteGuidelines
		} else if (event.code === 'KeyT') {
			$settingsStore.tickVariant =
				TICK_VARIANTS[
					(TICK_VARIANTS.indexOf($settingsStore.tickVariant) + 1) % TICK_VARIANTS.length
				]
		} else if (event.code === 'KeyC') {
			$settingsStore.colorMap =
				COLOR_MAPS[(COLOR_MAPS.indexOf($settingsStore.colorMap) + 1) % COLOR_MAPS.length]
		}
	}

	function updateOscillatorFrequency() {
		const percentage = 1.0 - mousePosition[1] / window.innerHeight
		const freq = scale(percentage, settings)
		audioManager?.setOscillatorFrequency(freq)
	}

	function handleStart(event: MouseEvent | TouchEvent) {
		if ((event instanceof MouseEvent && event.button === 0) || event instanceof TouchEvent) {
			if (event instanceof MouseEvent) {
				event.preventDefault()
				mousePosition = [event.clientX, event.clientY]
			} else if (event instanceof TouchEvent) {
				const touch = event.touches[0]
				mousePosition = [touch.clientX, touch.clientY]
			}
			toneEnabled = true
			updateOscillatorFrequency()
			audioManager?.setGain(settings.volume / 100)
		}
	}

	function handleMove(event: MouseEvent | TouchEvent) {
		if (event instanceof MouseEvent) {
			event.preventDefault()
			mousePosition = [event.clientX, event.clientY]
		} else if (event instanceof TouchEvent) {
			const touch = event.touches[0]
			mousePosition = [touch.clientX, touch.clientY]
		}
		if (toneEnabled) {
			updateOscillatorFrequency()
		}
	}

	function handleEnd(event: MouseEvent | TouchEvent) {
		if ((event instanceof MouseEvent && event.button === 0) || event instanceof TouchEvent) {
			event.preventDefault()
			toneEnabled = false
			audioManager?.setGain(0)
		}
	}

	function render() {
		settings = get(settingsStore)
		if (!paused) {
			audioManager.update(settings)
			estimatorManager.update(settings)
			if (settings.followPitch && !toneEnabled) {
				const pitches = estimatorManager
					.getResults()
					.slice(0, 128)
					.map((item) => (item.isPitchyValid() ? item.pitchyFrequency : null))
				const frequency = smoothPitches(pitches)
				if (frequency) {
					const currentMiddle = settings.lowerFrequency * Math.SQRT2
					const currentSpread = settings.upperFrequency / settings.lowerFrequency / 2
					if (
						Math.abs(currentMiddle / frequency - 1) > 0.12 ||
						currentSpread >= 1.1 ||
						currentSpread <= 0.9 ||
						momentum >= 0.01
					) {
						$settingsStore.lowerFrequency =
							settings.lowerFrequency * 0.9 + (frequency / Math.SQRT2) * 0.1
						$settingsStore.upperFrequency =
							settings.upperFrequency * 0.9 + frequency * Math.SQRT2 * 0.1
						momentum =
							momentum * 0.9 +
							Math.abs((settings.lowerFrequency * Math.SQRT2) / frequency - 1) * 0.1
					}
				}
			}
		}
		renderer!.render(settings, mousePosition, paused)
		requestAnimationFrame(render)
	}
</script>

<canvas
	bind:this={canvas}
	onmousemove={handleMove}
	onmousedown={handleStart}
	onmouseup={handleEnd}
	ontouchstart={handleStart}
	ontouchmove={handleMove}
	ontouchend={handleEnd}
	ontouchcancel={handleEnd}
>
</canvas>

<style>
	canvas {
		width: 100%;
		height: 100%;
		aspect-ratio: unset;
		touch-action: none;
		-webkit-touch-callout: none;
		-webkit-user-select: none;
		user-select: none;
	}
</style>
