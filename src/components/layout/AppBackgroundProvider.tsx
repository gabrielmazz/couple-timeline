import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { AppBackgroundContext } from './AppBackgroundContext'

function normalizeImages(images: string[]) {
	return Array.from(new Set(images.map((image) => image.trim()).filter(Boolean)))
}

export function AppBackgroundProvider({ children }: { children: ReactNode }) {
	const [backgroundImages, setBackgroundImagesState] = useState<string[]>([])

	const setBackgroundImages = useCallback((images: string[]) => {
		const nextImages = normalizeImages(images)

		setBackgroundImagesState((currentImages) => {
			const isSameList =
				currentImages.length === nextImages.length &&
				currentImages.every((image, index) => image === nextImages[index])

			return isSameList ? currentImages : nextImages
		})
	}, [])

	const value = useMemo(
		() => ({
			backgroundImages,
			setBackgroundImages,
		}),
		[backgroundImages, setBackgroundImages],
	)

	return <AppBackgroundContext.Provider value={value}>{children}</AppBackgroundContext.Provider>
}
