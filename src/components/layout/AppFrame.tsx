import {
	Alert,
	Box,
	Container,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useLocation } from 'react-router-dom'
import { isSupabaseConfigured } from '../../lib/supabase/client'
import GridMotion from '../ui/GridMotion'
import { AppNavigationMenu } from './AppNavigationMenu'
import { useAppBackground } from './AppBackgroundContext'

export function AppFrame({ children }: { children: React.ReactNode }) {
	const { backgroundImages } = useAppBackground()
	const location = useLocation()
	const isDesktop = useMediaQuery('(min-width: 48em)')
	const canShowTimelineBackground =
		location.pathname === '/dashboard' ||
		location.pathname === '/perfil' ||
		location.pathname.startsWith('/timeline/')

	return (
		<Box className="app-shell">
			{backgroundImages.length > 0 && isDesktop && canShowTimelineBackground ? (
				<>
					<Box className="app-background" aria-hidden="true">
						<GridMotion items={backgroundImages} gradientColor="rgba(19, 9, 18, 0.92)" />
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
