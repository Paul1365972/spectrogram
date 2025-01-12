<script lang="ts">
	import { onMount, onDestroy } from 'svelte'
	import { get } from 'svelte/store'
	import { AudioManager } from '../lib/audio'
	import { Renderer } from '../lib/renderer'
	import { scale } from '../lib/scales'
	import { settings as settingsStore } from '../lib/store'
	import { EstimatorManager } from '../lib/estimator'
	import { trackPitch } from '../lib/pitch_tracker'
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
				const frequency = trackPitch(pitches)
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
	onmousemove={(e) => {
		mousePosition = [e.clientX, e.clientY]
		const percentage = 1.0 - (1.0 * mousePosition[1]) / window.innerHeight
		const freq = scale(percentage, settings.scala, settings.lowerFrequency, settings.upperFrequency)
		audioManager?.setOscillatorFrequency(freq)
	}}
	onmousedown={(e) => {
		if (e.button === 0) {
			toneEnabled = true
			audioManager?.setGain(settings.volume / 100)
			e.preventDefault()
		}
	}}
	onmouseup={(e) => {
		if (e.button === 0) {
			toneEnabled = false
			audioManager?.setGain(0)
			e.preventDefault()
		}
	}}
>
</canvas>

<style>
	canvas {
		width: 100%;
		height: 100%;
		aspect-ratio: unset;
	}
</style>
