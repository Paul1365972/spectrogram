<script lang="ts">
	import { onMount } from 'svelte'
	import { get } from 'svelte/store'
	import { AudioManager } from '../lib/audio'
	import { Renderer } from '../lib/render/renderer'
	import { scale } from '../lib/scales'
	import { settings as settingsStore } from '../lib/store'
	import { AnalyzerManager } from '../lib/analyzer/analyzer'
	import { PitchTracker } from '../lib/pitch_tracker'
	import { TICK_VARIANTS } from '../lib/settings'
	import { COLOR_MAPS } from '../lib/render/color_maps'

	let canvas: HTMLCanvasElement

	let audioManager: AudioManager
	let analyzerManager: AnalyzerManager
	let renderer: Renderer

	let initialized: boolean = $state(false)
	let paused = false

	let toneEnabled: boolean = false
	let mousePosition: [number, number] = [0, 0]

	let pitchTracker: PitchTracker
	let animationFrameId: number | null = null

	onMount(() => {
		audioManager = new AudioManager()
		analyzerManager = new AnalyzerManager(audioManager)
		renderer = new Renderer(canvas, audioManager, analyzerManager)
		pitchTracker = new PitchTracker()

		window.addEventListener('mousedown', init)
		window.addEventListener('touchend', init)
		window.addEventListener('keydown', handleKeydown)

		return () => {
			window.removeEventListener('mousedown', init)
			window.removeEventListener('touchend', init)
			window.removeEventListener('keydown', handleKeydown)

			if (animationFrameId !== null) {
				cancelAnimationFrame(animationFrameId)
			}

			if (initialized) {
				renderer?.destroy()
				analyzerManager?.destroy()
				audioManager?.destroy()
			}
		}
	})

	async function init() {
		window.removeEventListener('mousedown', init)
		window.removeEventListener('touchend', init)
		if (!initialized) {
			audioManager.initialize()
			await analyzerManager.initialize()
			initialized = true
			animationFrameId = requestAnimationFrame(render)
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		switch (event.code) {
			case 'Space':
				paused = !paused
				break
			case 'KeyF':
				$settingsStore.followPitch = !$settingsStore.followPitch
				break
			case 'KeyG':
				$settingsStore.noteGuidelines = !$settingsStore.noteGuidelines
				break
			case 'KeyT':
				$settingsStore.tickVariant =
					TICK_VARIANTS[
						(TICK_VARIANTS.indexOf($settingsStore.tickVariant) + 1) % TICK_VARIANTS.length
					]
				break
			case 'KeyC':
				$settingsStore.colorMap =
					COLOR_MAPS[(COLOR_MAPS.indexOf($settingsStore.colorMap) + 1) % COLOR_MAPS.length]
				break
			default:
				return
		}
		event.preventDefault()
	}

	function updateOscillatorFrequency() {
		const percentage = 1.0 - mousePosition[1] / window.innerHeight
		const freq = scale(percentage, get(settingsStore))
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
			audioManager?.setGain(get(settingsStore).toneVolume / 100)
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
		audioManager.updateSources(settingsStore)
		const settings = get(settingsStore)
		if (!paused) {
			audioManager.update(settings)
			analyzerManager.update(settings)
			const frequencyUpdate = pitchTracker.updateFrequencyWindow(
				analyzerManager.getResults(),
				settings,
				toneEnabled,
			)
			if (frequencyUpdate) {
				$settingsStore.lowerFrequency = frequencyUpdate.lowerFrequency!
				$settingsStore.upperFrequency = frequencyUpdate.upperFrequency!
			}
		}
		renderer!.render(settings, mousePosition, paused)
		animationFrameId = requestAnimationFrame(render)
	}
</script>

<div class="spectrogram-container">
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

	{#if !initialized}
		<div class="click-anywhere">
			<h2>Click anywhere</h2>
		</div>
	{/if}
</div>

<style>
	.spectrogram-container {
		position: relative;
		width: 100%;
		height: 100%;
	}

	canvas {
		width: 100%;
		height: 100%;
		aspect-ratio: unset;
		touch-action: none;
		-webkit-touch-callout: none;
		-webkit-user-select: none;
		user-select: none;
	}

	.click-anywhere {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		font-size: 2rem;
		font-weight: normal;
		color: white;
	}
</style>
