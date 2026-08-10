import {
	Alert,
	Box,
	Container,
} from '@mantine/core'
import { isSupabaseConfigured } from '../../lib/supabase/client'
import { AppNavigationMenu } from './AppNavigationMenu'

export function AppFrame({ children }: { children: React.ReactNode }) {
	return (
		<Box className="app-shell">
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
