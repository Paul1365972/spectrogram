export type AudioSources = 'microphone' | 'desktop' | 'both' | 'none'
export type AudioTargets = { microphone: boolean; desktop: boolean }

export function audioSourcesToTargets(audioSources: AudioSources) {
	switch (audioSources) {
		case 'none':
			return { microphone: false, desktop: false }
		case 'microphone':
			return { microphone: true, desktop: false }
		case 'desktop':
			return { microphone: false, desktop: true }
		case 'both':
			return { microphone: true, desktop: true }
	}
}

export function audioTargetsToSources(audioTargets: AudioTargets) {
	if (!audioTargets.microphone && !audioTargets.desktop) {
		return 'none'
	} else if (audioTargets.microphone && !audioTargets.desktop) {
		return 'microphone'
	} else if (!audioTargets.microphone && audioTargets.desktop) {
		return 'desktop'
	} else if (audioTargets.microphone && audioTargets.desktop) {
		return 'both'
	}
	return 'none'
}
