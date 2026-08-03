import {
	Alert,
	Box,
	Container,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { isSupabaseConfigured } from '../../lib/supabase/client'
import GridMotion from '../ui/GridMotion'
import { AppNavigationMenu } from './AppNavigationMenu'
import { useAppBackground } from './AppBackgroundContext'

const BACKGROUND_IMAGE_BATCH_SIZE = 28
const BACKGROUND_IMAGE_ROTATION_MS = 18_000

function shuffleImages(images: string[]) {
	const shuffled = [...images]

	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const randomIndex = Math.floor(Math.random() * (index + 1))
		const currentImage = shuffled[index]
		shuffled[index] = shuffled[randomIndex]
		shuffled[randomIndex] = currentImage
	}

	return shuffled
}

export function AppFrame({ children }: { children: React.ReactNode }) {
	const { backgroundImages } = useAppBackground()
	const location = useLocation()
	const isDesktop = useMediaQuery('(min-width: 48em)')
	const backgroundImageDeckRef = useRef<string[]>([])
	const [visibleBackgroundImages, setVisibleBackgroundImages] = useState<string[]>([])

	useEffect(() => {
		backgroundImageDeckRef.current = shuffleImages(backgroundImages)

		const getNextBatch = () => {
			const nextImages: string[] = []

			while (nextImages.length < BACKGROUND_IMAGE_BATCH_SIZE && backgroundImages.length > 0) {
				if (backgroundImageDeckRef.current.length === 0) {
					backgroundImageDeckRef.current = shuffleImages(backgroundImages)
				}

				nextImages.push(...backgroundImageDeckRef.current.splice(0, BACKGROUND_IMAGE_BATCH_SIZE - nextImages.length))
			}

			setVisibleBackgroundImages(nextImages)
		}

		getNextBatch()

		const rotation = window.setInterval(getNextBatch, BACKGROUND_IMAGE_ROTATION_MS)

		return () => window.clearInterval(rotation)
	}, [backgroundImages])

	const canShowTimelineBackground =
		location.pathname === '/dashboard' ||
		location.pathname === '/perfil' ||
		location.pathname.startsWith('/timeline/')

	return (
		<Box className="app-shell">
			{visibleBackgroundImages.length > 0 && isDesktop && canShowTimelineBackground ? (
				<>
					<Box className="app-background" aria-hidden="true">
						<GridMotion items={visibleBackgroundImages} gradientColor="rgba(19, 9, 18, 0.92)" />
					</Box>
					<Box className="app-background-scrim" aria-hidden="true" />
				</>
			) : null}

			<AppNavigationMenu />

			{!isSupabaseConfigured ? (
				<Container size="lg" mt="md">
					<Alert color="yellow" radius={8} title="Supabase não configurado">
						Preencha <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> no
						arquivo <code>.env</code> para usar autenticação, banco e storage.
					</Alert>
				</Container>
			) : null}

			<main className="app-main">{children}</main>
		</Box>
	)
}
