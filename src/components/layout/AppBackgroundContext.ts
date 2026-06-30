import { createContext, useContext } from 'react'

export type AppBackgroundContextValue = {
	backgroundImages: string[]
	setBackgroundImages: (images: string[]) => void
	setCachedBackgroundImages: (cacheKey: string, images: string[]) => void
	loadCachedBackgroundImages: (cacheKey: string, loadImages: () => Promise<string[]>) => void
	hasCachedBackgroundImages: (cacheKey: string) => boolean
}

export const AppBackgroundContext = createContext<AppBackgroundContextValue | null>(null)

export function useAppBackground() {
	const context = useContext(AppBackgroundContext)

	if (!context) {
		throw new Error('useAppBackground precisa ser usado dentro de AppBackgroundProvider.')
	}

	return context
}
