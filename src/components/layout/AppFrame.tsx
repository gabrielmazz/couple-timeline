import {
	Alert,
	Anchor,
	Badge,
	Box,
	Burger,
	Button,
	Collapse,
	Container,
	Group,
	Menu,
	Text,
	UnstyledButton,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { Heart, LogOut, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { isSupabaseConfigured, supabase } from '../../lib/supabase/client'
import GridMotion from '../ui/GridMotion'
import { useAppBackground } from './AppBackgroundContext'

export function AppFrame({ children }: { children: React.ReactNode }) {
	const { user } = useAuth()
	const { backgroundImages } = useAppBackground()
	const navigate = useNavigate()
	const [opened, setOpened] = useState(false)

	async function handleLogout() {
		const { error } = await supabase.auth.signOut()

		if (error) {
			notifications.show({
				color: 'red',
				title: 'Não foi possível sair',
				message: error.message,
			})
			return
		}

		navigate('/login')
	}

	const nav = user ? (
		<Group gap="xs">
			<Button component={Link} to="/dashboard" variant="subtle" color="pink">
				Dashboard
			</Button>
			<Menu position="bottom-end" withArrow>
				<Menu.Target>
					<UnstyledButton aria-label="Abrir menu da conta">
						<Badge
							size="lg"
							radius={8}
							variant="light"
							color="pink"
							leftSection={<UserRound size={14} />}
						>
							{user.email}
						</Badge>
					</UnstyledButton>
				</Menu.Target>
				<Menu.Dropdown>
					<Menu.Label>Conta</Menu.Label>
					<Menu.Item component={Link} to="/perfil" leftSection={<UserRound size={16} />}>
						Perfil e relacionamento
					</Menu.Item>
					<Menu.Divider />
					<Menu.Item color="red" leftSection={<LogOut size={16} />} onClick={handleLogout}>
						Sair
					</Menu.Item>
				</Menu.Dropdown>
			</Menu>
		</Group>
	) : (
		<Group gap="xs">
			<Button component={Link} to="/login" variant="subtle" color="pink">
				Entrar
			</Button>
			<Button component={Link} to="/register" color="pink">
				Criar conta
			</Button>
		</Group>
	)

	return (
		<Box className="app-shell">
			{backgroundImages.length > 0 ? (
				<>
					<Box className="app-background" aria-hidden="true">
						<GridMotion items={backgroundImages} gradientColor="rgba(19, 9, 18, 0.92)" />
					</Box>
					<Box className="app-background-scrim" aria-hidden="true" />
				</>
			) : null}

			<Box className="app-header">
				<Container size="lg" py="sm">
					<Group justify="space-between" wrap="nowrap">
						<Anchor component={Link} to="/" c="white" underline="never">
							<Group gap="xs" wrap="nowrap">
								<Heart size={22} color="var(--palette-rose)" fill="var(--palette-rose)" />
								<Text fw={800} size="lg" tt="uppercase" style={{ lineHeight: 1, letterSpacing: '0.12em' }}>
									Moments
								</Text>
							</Group>
						</Anchor>
						<Box visibleFrom="sm">{nav}</Box>
						<Burger
							hiddenFrom="sm"
							opened={opened}
							onClick={() => setOpened((value) => !value)}
							aria-label="Abrir navegação"
						/>
					</Group>
					<Collapse expanded={opened}>
						<Box py="md">{nav}</Box>
					</Collapse>
				</Container>
			</Box>

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
