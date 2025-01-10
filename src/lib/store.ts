import { persisted } from 'svelte-persisted-store'
import { getDefaultSettings } from './settings'

export const settings = persisted('settings', getDefaultSettings())
