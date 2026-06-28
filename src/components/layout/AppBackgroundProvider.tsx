import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { BACKGROUND_IMAGE_LIMIT, selectBackgroundItems } from '../../lib/timeline/background'
import { AppBackgroundContext } from './AppBackgroundContext'

function normalizeImages(images: string[]) {
	return selectBackgroundItems(
		images.map((image) => image.trim()).filter(Boolean),
		BACKGROUND_IMAGE_LIMIT,
	)
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
