import { notifications } from '@mantine/notifications'
import { BookOpen, Menu as MenuIcon } from 'lucide-react'
import { Button, Drawer } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { signOut } from 'firebase/auth'
import { firebaseAuth } from '../../lib/firebase/client'
import { getUserTimelineTree } from '../../lib/timeline/queries'
import type { TimelineTree } from '../../types/timeline'


function AppMenuLogo() {
	return (
		<Link to="/" className="app-menu-logo" aria-label="Ir para a página inicial">
			<BookOpen size={21} aria-hidden="true" />
			<span>Couple Timeline</span>
		</Link>
	)
}

export function AppNavigationMenu() {
	const { user } = useAuth()
	const location = useLocation()
	const navigate = useNavigate()
	const [menuOpen, setMenuOpen] = useState(false)
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
		try {
			await signOut(firebaseAuth)
		} catch (error) {
			notifications.show({
				color: 'red',
				title: 'Não foi possível sair',
				message: error instanceof Error ? error.message : 'Tente novamente.',
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

	const menuItems = !user
		? [
			{ label: 'Entrar', link: '/login' },
			{ label: 'Criar conta', link: '/register' },
		]
		: [
			{ label: 'Início', link: '/dashboard' },
			{ label: 'Linha do tempo', link: timelinePath },
			{ label: 'Calendário', link: '/calendario' },
			{ label: 'Planos do mês', link: '/planos-do-mes' },
			{ label: 'Nossas regras', link: '/nossas-regras' },
			{ label: 'Momentos futuros', link: '/futuro' },
			{ label: 'Presentes', link: '/presentes' },
			{ label: 'Jogos', link: '/jogos' },
			{ label: 'Perfil', link: '/perfil' },
		]

	function isActive(item: { label: string; link: string }) {
		return item.label === 'Linha do tempo'
			? location.pathname.startsWith('/timeline/')
			: item.label === 'Jogos' ? location.pathname.startsWith('/jogos') : location.pathname === item.link
	}

	return (
		<>
			<header className="app-nav-header">
				<div className="app-nav-inner">
					<AppMenuLogo />
					<nav className="app-nav-primary" aria-label="Acesso rápido">
						{menuItems.slice(0, user ? 4 : 2).map((item) => (
							<Link key={item.label} to={item.link} aria-current={isActive(item) ? 'page' : undefined}>{item.label}</Link>
						))}
					</nav>
					<Button variant="subtle" className="app-nav-toggle" onClick={() => setMenuOpen(true)} aria-label="Abrir menu de navegação" aria-expanded={menuOpen} leftSection={<MenuIcon size={19} aria-hidden="true" />}>
						Menu
					</Button>
				</div>
			</header>
			<Drawer opened={menuOpen} onClose={() => setMenuOpen(false)} position="right" title="Navegação" size="sm" classNames={{ content: 'app-nav-drawer', title: 'app-nav-drawer-title' }}>
				<nav className="app-nav-links" aria-label="Navegação principal">
					{menuItems.map((item) => {
						const active = isActive(item)
						return <Link key={item.label} to={item.link} onClick={() => setMenuOpen(false)} aria-current={active ? 'page' : undefined}>{item.label}</Link>
					})}
					{user && <button type="button" onClick={() => { setMenuOpen(false); void handleLogout() }}>Sair da conta</button>}
				</nav>
			</Drawer>
		</>
	)
}
