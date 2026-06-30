import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/auth-context'
import { AppBackgroundContext } from './AppBackgroundContext'

function normalizeImages(images: string[]) {
	return Array.from(new Set(images.map((image) => image.trim()).filter(Boolean)))
}

function areSameImages(firstImages: string[], secondImages: string[]) {
	return (
		firstImages.length === secondImages.length &&
		firstImages.every((image, index) => image === secondImages[index])
	)
}

const EMPTY_BACKGROUND_IMAGES: string[] = []

export function AppBackgroundProvider({ children }: { children: ReactNode }) {
	const { user } = useAuth()
	const userId = user?.id ?? null
	const [backgroundState, setBackgroundState] = useState<{ userId: string | null; images: string[] }>({
		userId: null,
		images: [],
	})
	const cachedBackgroundKeysRef = useRef(new Set<string>())
	const pendingBackgroundKeysRef = useRef(new Set<string>())
	const sessionGenerationRef = useRef(0)
	const userIdRef = useRef(userId)
	const backgroundImages = backgroundState.userId === userId ? backgroundState.images : EMPTY_BACKGROUND_IMAGES

	useEffect(() => {
		if (userIdRef.current !== userId) {
			userIdRef.current = userId
			sessionGenerationRef.current += 1
		}
	}, [userId])

	const getScopedCacheKey = useCallback((cacheKey: string) => {
		return `${userId ?? 'anonymous'}:${cacheKey}`
	}, [userId])

	const setBackgroundImages = useCallback((images: string[]) => {
		const nextImages = normalizeImages(images)

		setBackgroundState((currentState) => {
			if (currentState.userId === userId && areSameImages(currentState.images, nextImages)) {
				return currentState
			}

			return { userId, images: nextImages }
		})
	}, [userId])

	const hasCachedBackgroundImages = useCallback((cacheKey: string) => {
		return cachedBackgroundKeysRef.current.has(getScopedCacheKey(cacheKey))
	}, [getScopedCacheKey])

	const setCachedBackgroundImages = useCallback((cacheKey: string, images: string[]) => {
		cachedBackgroundKeysRef.current.add(getScopedCacheKey(cacheKey))
		setBackgroundImages(images)
	}, [getScopedCacheKey, setBackgroundImages])

	const loadCachedBackgroundImages = useCallback((cacheKey: string, loadImages: () => Promise<string[]>) => {
		const scopedCacheKey = getScopedCacheKey(cacheKey)

		if (cachedBackgroundKeysRef.current.has(scopedCacheKey) || pendingBackgroundKeysRef.current.has(scopedCacheKey)) {
			return
		}

		const generation = sessionGenerationRef.current
		pendingBackgroundKeysRef.current.add(scopedCacheKey)

		void loadImages()
			.then((images) => {
				if (generation === sessionGenerationRef.current) {
					setCachedBackgroundImages(cacheKey, images)
				}
			})
			.catch(() => {
				cachedBackgroundKeysRef.current.delete(scopedCacheKey)
			})
			.finally(() => {
				pendingBackgroundKeysRef.current.delete(scopedCacheKey)
			})
	}, [getScopedCacheKey, setCachedBackgroundImages])

	const value = useMemo(
		() => ({
			backgroundImages,
			setBackgroundImages,
			setCachedBackgroundImages,
			loadCachedBackgroundImages,
			hasCachedBackgroundImages,
		}),
		[
			backgroundImages,
			setBackgroundImages,
			setCachedBackgroundImages,
			loadCachedBackgroundImages,
			hasCachedBackgroundImages,
		],
	)

	return <AppBackgroundContext.Provider value={value}>{children}</AppBackgroundContext.Provider>
}
