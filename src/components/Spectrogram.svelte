<script lang="ts">
	import { onMount, onDestroy } from 'svelte'
	import { get } from 'svelte/store'
	import { AudioManager } from '../lib/audio'
	import { Renderer } from '../lib/renderer'
	import { scale } from '../lib/utils'
	import { settings as settingsStore } from '../lib/store'
	import { EstimatorManager } from '../lib/estimator'

	let canvas: HTMLCanvasElement

	let initalized: boolean = false
	let settings = get(settingsStore)
	let paused = false

	let audioManager: AudioManager
	let estimatorManager: EstimatorManager
	let renderer: Renderer

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
		if (!initalized) {
			await audioManager.initialize()
			await estimatorManager.initialize()
			initalized = true
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
			if (settings.followPitch) {
				const history = 20
				const frequencies = estimatorManager
					.getResults()
					.map((item) => item.pitchyFrequency)
					.filter((item) => item > 20)
				if (frequencies.length >= history) {
					const frequency = frequencies.slice(0, history).reduce((a, item) => a + item, 0) / history
					$settingsStore.lowerFrequency = frequency / 1.25
					$settingsStore.upperFrequency = frequency * 1.25
				}
			}
		}
		renderer!.render(settings, mousePosition, paused)
		requestAnimationFrame(render)
	}
</script>

<canvas
	bind:this={canvas}
	on:mousemove={(e) => {
		mousePosition = [e.clientX, e.clientY]
		const percentage = 1.0 - (1.0 * mousePosition[1]) / window.innerHeight
		const freq = scale(percentage, settings.scala, settings.lowerFrequency, settings.upperFrequency)
		audioManager?.setOscillatorFrequency(freq)
	}}
	on:mousedown={(e) => {
		if (e.button === 0) {
			audioManager?.setGain(settings.volume / 100)
			e.preventDefault()
		}
	}}
	on:mouseup={(e) => {
		if (e.button === 0) {
			audioManager?.setGain(0)
			e.preventDefault()
		}
	}}
></canvas>

<style>
	canvas {
		width: 100%;
		height: 100%;
	}
</style>
