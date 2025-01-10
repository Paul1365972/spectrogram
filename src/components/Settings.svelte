<script lang="ts">
	import { settings } from '../lib/store'
	import DualSlider from './DualSlider.svelte'
</script>

<div class="settings-menu">
	<div class="setting">
		<label for="tick-variant">Ticks</label>
		<select id="tick-variant" bind:value={$settings.tickVariant}>
			<option value="none">None</option>
			<option value="preset">Preset</option>
			<option value="notes">Notes</option>
		</select>
	</div>

	<div class="setting">
		<label for="colormap">Colormap</label>
		<select id="colormap" bind:value={$settings.colorMap}>
			<option value="grayscale">Grayscale</option>
			<option value="magma">Magma</option>
			<option value="inferno">Inferno</option>
		</select>
	</div>

	<div class="setting">
		<label for="interpolation">Interpolation</label>
		<select id="interpolation" bind:value={$settings.interpolation}>
			<option value="nearest">Nearest</option>
			<option value="linear">Linear</option>
			<option value="maximum">Maximum</option>
			<option value="averaging">Averaging</option>
		</select>
	</div>

	<div class="setting">
		<label for="note-guidelines">Note Guidelines</label>
		<input id="note-guidelines" type="checkbox" bind:checked={$settings.noteGuidelines} />
	</div>

	<div class="setting">
		<label for="fft-size">FFT Size</label>

		<select id="fft-size" bind:value={$settings.fftSize}>
			<option value={1024}>1024 Points</option>
			<option value={2048}>2048 Points</option>
			<option value={4096}>4096 Points</option>
			<option value={8192}>8192 Points</option>
			<option value={16384}>16384 Points</option>
		</select>
	</div>

	<div class="setting">
		<label for="smoothing-factor">FFT Smoothing</label>
		<input
			type="range"
			id="smoothing-factor"
			min="0"
			max="1"
			step="0.01"
			bind:value={$settings.smoothingFactor}
		/>
		<span>{Math.round($settings.smoothingFactor * 100)} %</span>
	</div>

	<div class="setting">
		<label for="frequency-range">Frequency Range</label>
		<DualSlider id="frequency-range"></DualSlider>
	</div>

	<div class="setting">
		<label for="emphasis">Emphasis</label>
		<select id="emphasis" bind:value={$settings.emphasis}>
			<option value="0">None</option>
			<option value="3">+3dB/octave</option>
			<option value="6">+6dB/octave</option>
			<option value="12">+12dB/octave</option>
		</select>
	</div>

	<div class="setting">
		<label for="scala">Scale</label>
		<select id="scala" bind:value={$settings.scala}>
			<option value="log">Logarithmic</option>
			<option value="linear">Linear</option>
			<option value="mel">Mel</option>
		</select>
	</div>

	<div class="setting">
		<label for="speed">Speed</label>
		<input type="range" id="speed" min="0" max="10" step="1" bind:value={$settings.speed} />
		<span>{$settings.speed} px/f</span>
	</div>

	<div class="setting">
		<label for="volume">Volume</label>
		<input type="range" id="volume" min="0" max="100" step="1" bind:value={$settings.volume} />
		<span>{$settings.volume}%</span>
	</div>

	<div class="setting">
		<label for="follow-pitch">Follow Pitch</label>
		<input id="follow-pitch" type="checkbox" bind:checked={$settings.followPitch} />
	</div>
</div>

<style>
	.settings-menu {
		position: absolute;
		top: 10px;
		left: 10px;
		width: 400px;
		background-color: rgba(255, 255, 255, 0.8);
		color: black;
		border: 3px solid rgba(0, 0, 0, 0.8);
		padding: 10px;
		border-radius: 5px;
	}
	.setting {
		width: 100%;
		display: flex;
		margin: 5px;
		align-items: center;
	}
	label {
		flex-shrink: 0;
		width: 6em;
	}
	span {
		margin: auto;
		flex-shrink: 0;
		width: 4.5em;
		text-align: right;
	}
</style>
