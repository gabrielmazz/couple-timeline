import { notifications } from '@mantine/notifications'
import { Heart } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { supabase } from '../../lib/supabase/client'
import { getUserTimelineTree } from '../../lib/timeline/queries'
import type { TimelineTree } from '../../types/timeline'
import StaggeredMenu, { type StaggeredMenuItem } from '../ui/StaggeredMenu'

function AppMenuLogo() {
	return (
		<Link to="/" className="app-menu-logo" aria-label="Ir para a página inicial">
			<Heart size={22} color="var(--palette-rose)" fill="var(--palette-rose)" />
			<span>Moments</span>
		</Link>
	)
}

export function AppNavigationMenu() {
	const { user } = useAuth()
	const location = useLocation()
	const navigate = useNavigate()
	const [timelineTreeState, setTimelineTreeState] = useState<{
		userId: string
		tree: TimelineTree | null
	} | null>(null)

	useEffect(() => {
		if (!user) {
			return
		}

		let isMounted = true

		getUserTimelineTree()
			.then((tree) => {
				if (isMounted) {
					setTimelineTreeState({ userId: user.id, tree })
				}
			})
			.catch(() => {
				if (isMounted) {
					setTimelineTreeState({ userId: user.id, tree: null })
				}
			})

		return () => {
			isMounted = false
		}
	}, [user])

	const handleLogout = useCallback(async () => {
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
	}, [navigate])

	const timelineTree = timelineTreeState && timelineTreeState.userId === user?.id
		? timelineTreeState.tree
		: null
	const currentTimelinePath = location.pathname.match(/^\/timeline\/[^/]+/)?.[0]
	const timelinePath = timelineTree?.root.id
		? `/timeline/${timelineTree.root.id}`
		: currentTimelinePath ?? '/dashboard'

	const createMenuItem = (label: string, ariaLabel: string, link: string): StaggeredMenuItem => ({
		label,
		ariaLabel,
		link,
		isActive: label === 'Timeline'
			? location.pathname.startsWith('/timeline/')
			: location.pathname === link,
		onClick: (event) => {
			event.preventDefault()
			navigate(link)
		},
	})

	const menuItems: StaggeredMenuItem[] = !user
		? [
			createMenuItem('Home', 'Ir para a página inicial', '/'),
			createMenuItem('Entrar', 'Ir para a página de login', '/login'),
			createMenuItem('Criar conta', 'Ir para a página de cadastro', '/register'),
		]
		: [
			createMenuItem('Home', 'Ir para a página inicial', '/'),
			createMenuItem('Árvores', 'Ir para o dashboard', '/dashboard'),
			createMenuItem('Timeline', 'Ir para a timeline principal', timelinePath),
			createMenuItem('Presentes', 'Ir para a lista de presentes', '/presentes'),
			createMenuItem('Calendário', 'Ir para o calendário do casal', '/calendario'),
			createMenuItem('Futuro', 'Ir para os planos do casal', '/futuro'),
			createMenuItem('Perfil', 'Ir para o perfil', '/perfil'),
			{
				label: 'Sair',
				ariaLabel: 'Sair da conta',
				onClick: (event) => {
					event.preventDefault()
					void handleLogout()
				},
			},
		]

	return (
		<>
			<StaggeredMenu
				className="app-navigation-menu"
				isFixed
				logo={<AppMenuLogo />}
				items={menuItems}
				socialItems={[]}
				displaySocials={false}
				displayItemNumbering
				colors={['#e23d75', '#feb89f', '#2a1227']}
				accentColor="var(--palette-rose)"
				menuButtonColor="#fff7f4"
				openMenuButtonColor="#fff7f4"
			/>
			<style>{`
				.app-navigation-menu .sm-panel-item {
					font-size: clamp(2.6rem, 4.2vw, 4.2rem);
				}

				@media (max-width: 640px) {
					.app-navigation-menu .sm-panel-item {
						font-size: clamp(2.2rem, 12vw, 3.6rem);
					}
				}
			`}</style>
		</>
	)
}
