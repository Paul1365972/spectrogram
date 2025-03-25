<script lang="ts">
	import { DEFAULT_SETTINGS } from '../lib/settings'
	import { settings } from '../lib/store'
	import DualSlider from './DualSlider.svelte'

	let isOpen = false
</script>

<div class="settings-container">
	<button
		class="toggle-button"
		on:click={() => (isOpen = !isOpen)}
		aria-label={isOpen ? 'Close Settings' : 'Open Settings'}
	>
		<svg viewBox="0 0 24 24" width="24" height="24" class="icon {isOpen ? 'open' : ''}">
			<path
				d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
			/>
		</svg>
	</button>

	{#if isOpen}
		<div class="settings-menu" role="dialog" aria-label="Settings">
			<div class="settings-content">
				<div class="setting">
					<label for="audio-source">Audio Source</label>
					<select id="audio-source" bind:value={$settings.audioSource}>
						<option value="none">None</option>
						<option value="microphone">Microphone</option>
						<option value="desktop">Desktop</option>
						<option value="both">Both</option>
					</select>
				</div>

				<div class="setting">
					<label for="input-volume">Input Volume</label>
					<input
						type="range"
						id="input-volume"
						min="0"
						max="18"
						step="1"
						bind:value={$settings.inputBoost}
					/>
					<span>+{$settings.inputBoost} dB</span>
				</div>

				<div class="setting">
					<label for="frequency-range">Frequency Range</label>
					<DualSlider
						id="frequency-range"
						minValue={20}
						maxValue={20000}
						lowerValue={$settings.lowerFrequency}
						upperValue={$settings.upperFrequency}
						defaultLowerValue={DEFAULT_SETTINGS.lowerFrequency}
						defaultUpperValue={DEFAULT_SETTINGS.upperFrequency}
						logarithmic={true}
						unit="Hz"
						onChange={(lower, upper) => {
							$settings.lowerFrequency = lower
							$settings.upperFrequency = upper
						}}
					/>
				</div>

				<div class="setting">
					<label for="follow-pitch"><u>F</u>ollow Pitch</label>
					<input id="follow-pitch" type="checkbox" bind:checked={$settings.followPitch} />
				</div>

				<div class="setting">
					<label for="tick-variant"><u>T</u>icks</label>
					<select id="tick-variant" bind:value={$settings.tickVariant}>
						<option value="none">None</option>
						<option value="preset">Preset</option>
						<option value="notes">Notes</option>
					</select>
				</div>

				<div class="setting">
					<label for="note-guidelines">Note <u>G</u>uidelines</label>
					<input id="note-guidelines" type="checkbox" bind:checked={$settings.noteGuidelines} />
				</div>

				<div class="setting">
					<label for="time-guidelines">Time Guidelines</label>
					<input id="time-guidelines" type="checkbox" bind:checked={$settings.timeGuidelines} />
				</div>

				<div class="setting">
					<label for="colormap"><u>C</u>olormap</label>
					<select id="colormap" bind:value={$settings.colorMap}>
						<option value="grayscale">Grayscale</option>
						<option value="inferno">Inferno</option>
						<option value="magma">Magma</option>
					</select>
				</div>

				<div class="setting">
					<label for="interpolation">Interpolation</label>
					<select id="interpolation" bind:value={$settings.interpolation}>
						<option value="nearest">Nearest</option>
						<option value="linear">Linear</option>
					</select>
				</div>

				<div class="setting">
					<label for="speed">Speed</label>
					<input type="range" id="speed" min="1" max="10" step="0.1" bind:value={$settings.speed} />
					<span>{$settings.speed} px/f</span>
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
					<label for="pre-emphasis">Pre-Emphasis</label>
					<input
						type="range"
						id="pre-emphasis"
						min="0"
						max="1"
						step="0.01"
						bind:value={$settings.preEmphasis}
					/>
					<span>{$settings.preEmphasis.toFixed(2)}</span>
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
					<span class="info-text">(~{(($settings.fftSize / 48000) * 1000).toFixed(1)} ms)</span>
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
					<span>{Math.round($settings.smoothingFactor * 100)}%</span>
				</div>

				<div class="setting">
					<label for="volume">Tone Volume</label>
					<input
						type="range"
						id="volume"
						min="0"
						max="100"
						step="1"
						bind:value={$settings.toneVolume}
					/>
					<span>{$settings.toneVolume}%</span>
				</div>

				<div class="setting">
					<button
						class="reset-button"
						on:click={() => ($settings = structuredClone(DEFAULT_SETTINGS))}
					>
						Reset All
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.settings-container {
		position: fixed;
		top: 0;
		left: 0;
		color: black;
	}

	.toggle-button {
		position: absolute;
		top: 10px;
		left: 10px;
		width: 50px;
		height: 50px;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.8);
		border: 2px solid rgba(0, 0, 0, 0.8);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.icon {
		fill: currentColor;
		transition: transform 0.3s ease;
	}

	.icon.open {
		transform: rotate(180deg);
	}

	.settings-menu {
		position: absolute;
		top: 65px;
		left: 10px;
		width: 400px;
		max-width: calc(100dvw - 22px);
		background-color: rgba(255, 255, 255, 0.8);
		border: 2px solid rgba(0, 0, 0, 0.8);
		border-radius: 8px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		max-height: calc(100dvh - 70px);
		overflow-y: auto;
		animation: slideDown 0.2s ease;
		resize: both;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.settings-content {
		padding: 15px;
	}

	.setting {
		width: 100%;
		display: flex;
		padding: 4px 0px;
		align-items: center;
	}

	label {
		flex-shrink: 0;
		width: 7em;
		font-size: 14px;
		margin-right: 10px;
	}

	select {
		flex: 1;
		padding: 3px;
		border-radius: 3px;
	}

	input[type='range'] {
		flex: 1;
		padding: 4px;
	}

	input[type='checkbox'] {
		width: 20px;
		height: 20px;
		margin: 0;
	}

	span {
		flex-shrink: 0;
		width: 3em;
		font-size: 12px;
		white-space: nowrap;
		text-align: right;
		padding: 0;
		margin: 0;
	}

	.info-text {
		width: 7em;
	}

	.reset-button {
		width: 100%;
		padding: 10px;
		margin-top: 10px;
		background-color: #f0f0f0;
		border: 2px solid rgba(0, 0, 0, 0.8);
		border-radius: 4px;
		cursor: pointer;
	}

	.reset-button:hover {
		background-color: #e0e0e0;
	}

	@media (max-width: 768px) {
		.settings-menu {
			width: none;
		}

		input[type='checkbox'] {
			width: 24px;
			height: 24px;
		}
	}
</style>
