<script lang="ts">
	import { onMount, onDestroy } from 'svelte'
	import { get } from 'svelte/store'
	import { AudioManager } from '../lib/audio'
	import { Renderer } from '../lib/renderer'
	import { scale } from '../lib/scales'
	import { settings as settingsStore } from '../lib/store'
	import { EstimatorManager } from '../lib/estimator'
	import { trackPitch } from '../lib/pitch_tracker'

	let canvas: HTMLCanvasElement

	let initialized: boolean = $state(false)
	let settings = get(settingsStore)
	let paused = false

	let audioManager: AudioManager
	let estimatorManager: EstimatorManager
	let renderer: Renderer

	let toneEnabled: boolean = false
	let mousePosition: [number, number] = [0, 0]

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
			event.preventDefault()
			paused = !paused
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
					$settingsStore.lowerFrequency = settings.lowerFrequency * 0.9 + (frequency / 1.25) * 0.1
					$settingsStore.upperFrequency = settings.upperFrequency * 0.9 + frequency * 1.25 * 0.1
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
