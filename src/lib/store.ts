import { persisted } from 'svelte-persisted-store'
import { DEFAULT_SETTINGS } from './settings'

export const settings = persisted('settings', structuredClone(DEFAULT_SETTINGS))

settings.update((value) => {
	return { ...DEFAULT_SETTINGS, ...value }
})
