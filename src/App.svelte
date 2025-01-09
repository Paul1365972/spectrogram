<script lang="ts">
	import Settings from './components/Settings.svelte'
	import Spectogram from './components/Spectrogram.svelte'
</script>

<main>
	<Spectogram />
	<Settings />
</main>

<style>
	main {
		width: 100%;
		height: 100%;
		margin: 0;
		padding: 0;
		overflow: hidden;
	}
</style>
