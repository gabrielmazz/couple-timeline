import {
	Alert,
	Box,
	Container,
} from '@mantine/core'
import { isFirebaseConfigured } from '../../lib/firebase/client'
import { AppNavigationMenu } from './AppNavigationMenu'

export function AppFrame({ children }: { children: React.ReactNode }) {
	return (
		<Box className="app-shell">
			<a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
			<AppNavigationMenu />

			{!isFirebaseConfigured ? (
				<Container size="lg" mt="md">
					<Alert color="yellow" radius={8} title="Firebase não configurado">
						Preencha as variáveis do Firebase no arquivo <code>.env</code> para usar o aplicativo.
					</Alert>
				</Container>
			) : null}

			<main id="conteudo" className="app-main" tabIndex={-1}>{children}</main>
		</Box>
	)
}
