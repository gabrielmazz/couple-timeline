import {
	Alert,
	Badge,
	Button,
	Card,
	Container,
	Divider,
	Group,
	Loader,
	Modal,
	SegmentedControl,
	Select,
	Stack,
	Text,
	TextInput,
	Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import {
	CalendarHeart,
	Eye,
	GitBranch,
	Lock,
	Plus,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Counter from '../components/ui/Counter'
import { createCouple } from '../lib/timeline/actions'
import { ensureProfile, getUserTimelineTree } from '../lib/timeline/queries'
import { getErrorMessage } from '../lib/utils'
import type { Couple, CoupleRole, TimelineVisibility } from '../types/database'
import type { TimelineTree } from '../types/timeline'

type CoupleForm = {
	name: string
	visibility: TimelineVisibility
}

type CardSortOrder = 'asc' | 'desc'

function getCreatedAtParts(createdAt: string) {
	const date = new Date(createdAt)

	return {
		year: date.getFullYear(),
		month: date.getMonth() + 1,
		timestamp: date.getTime(),
	}
}

function getRelationshipDays(startedAt: string) {
	const [year, month, day] = startedAt.split('-').map(Number)
	const today = new Date()
	const startTimestamp = Date.UTC(year, month - 1, day)
	const todayTimestamp = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())

	return Math.max(1, Math.floor((todayTimestamp - startTimestamp) / 86_400_000) + 1)
}

function DashboardTimelineCard({
	timeline,
	kind,
	memberRole,
}: {
	timeline: Couple
	kind: 'root' | 'child'
	memberRole: CoupleRole
}) {
	return (
		<Card className="dashboard-timeline-card glass-panel" radius={8} p="lg" withBorder>
			<Stack h="100%" justify="space-between" gap="xl">
				<Stack gap="xs">
					<Group justify="space-between" align="flex-start" gap="xs">
						<Group gap="xs">
							<Badge
								color={timeline.visibility === 'public' ? 'green' : 'pink'}
								variant="light"
								leftSection={timeline.visibility === 'public' ? <Eye size={12} /> : <Lock size={12} />}
							>
								{timeline.visibility === 'public' ? 'Pública' : 'Privada'}
							</Badge>
							<Badge color="grape" variant="light" leftSection={<GitBranch size={12} />}>
								{kind === 'root' ? 'Principal' : 'Vinculada'}
							</Badge>
						</Group>
						{kind === 'root' ? (
							<Badge variant="outline" color="pink">
								{memberRole === 'owner' ? 'Proprietário' : 'Parceiro'}
							</Badge>
						) : null}
					</Group>
					<Title order={2} size="h3">
						{timeline.name}
					</Title>
					<Text c="dimmed" size="sm">
						Criada em {new Date(timeline.created_at).toLocaleDateString('pt-BR')}
					</Text>
				</Stack>
				<Button component={Link} to={`/timeline/${timeline.id}`} color="pink" fullWidth>
					Abrir timeline
				</Button>
			</Stack>
		</Card>
	)
}

export function DashboardPage() {
	const [tree, setTree] = useState<TimelineTree | null>(null)
	const [loading, setLoading] = useState(true)
	const [creating, setCreating] = useState(false)
	const [modalOpened, setModalOpened] = useState(false)
	const [selectedYear, setSelectedYear] = useState('all')
	const [selectedMonth, setSelectedMonth] = useState('all')
	const [sortOrder, setSortOrder] = useState<CardSortOrder>('asc')
	const [error, setError] = useState<string | null>(null)
	const form = useForm<CoupleForm>({
		initialValues: {
			name: '',
			visibility: 'private',
		},
		validate: {
			name: (value) => (value.trim().length >= 2 ? null : 'Informe o nome da timeline.'),
		},
	})
	const loadTree = useCallback(async () => {
		setLoading(true)
		setError(null)

		try {
			await ensureProfile()
			const nextTree = await getUserTimelineTree()
			const years = Array.from(
				new Set((nextTree?.children ?? []).map((timeline) => getCreatedAtParts(timeline.created_at).year)),
			).sort((a, b) => a - b)

			setTree(nextTree)
			setSelectedYear(years.at(-1)?.toString() ?? 'all')
		} catch (loadError) {
			setError(getErrorMessage(loadError, 'Não foi possível carregar.'))
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void loadTree()
		}, 0)

		return () => window.clearTimeout(timer)
	}, [loadTree])

	const availableYears = useMemo(
		() =>
			Array.from(
				new Set((tree?.children ?? []).map((timeline) => getCreatedAtParts(timeline.created_at).year)),
			).sort((a, b) => a - b),
		[tree?.children],
	)

	const visibleChildren = useMemo(() => {
		return (tree?.children ?? [])
			.filter((timeline) => {
				const { year, month } = getCreatedAtParts(timeline.created_at)

				return (
					(selectedYear === 'all' || year === Number(selectedYear)) &&
					(selectedMonth === 'all' || month === Number(selectedMonth))
				)
			})
			.toSorted((first, second) => {
				const comparison = getCreatedAtParts(first.created_at).timestamp - getCreatedAtParts(second.created_at).timestamp
				return sortOrder === 'asc' ? comparison : -comparison
			})
	}, [selectedMonth, selectedYear, sortOrder, tree?.children])

	const canManageRelationship = !tree || tree.memberRole === 'owner'
	const relationshipDays = tree?.root.relationship_started_at
		? getRelationshipDays(tree.root.relationship_started_at)
		: null

	function openCreateModal() {
		form.setValues({
			name: '',
			visibility: tree?.root.visibility ?? 'private',
		})
		setModalOpened(true)
	}

	async function handleCreate(values: CoupleForm) {
		const creatingRoot = !tree
		setCreating(true)

		try {
			await createCouple(values)
			notifications.show({
				color: 'green',
				title: creatingRoot ? 'Timeline principal criada' : 'Timeline vinculada criada',
				message: creatingRoot
					? 'Você já pode adicionar os primeiros eventos.'
					: 'Ela já aparece na árvore do relacionamento.',
			})
			form.reset()
			setModalOpened(false)
			await loadTree()
		} catch (createError) {
			notifications.show({
				color: 'red',
				title: 'Erro ao criar timeline',
				message: getErrorMessage(createError),
			})
		} finally {
			setCreating(false)
		}
	}

	return (
		<Container size="lg" py={{ base: 'lg', sm: 'xl' }}>
			<Stack gap="xl">
				<Group justify="space-between" align="flex-end" gap="lg">
					<Stack gap={4}>
						<Text c="var(--palette-blush)" fw={800} tt="uppercase" size="xs">
							Dashboard
						</Text>
						<Title order={1} tt="uppercase">Sua árvore de timelines</Title>
					</Stack>
					{canManageRelationship ? (
						<Button color="pink" leftSection={<Plus size={17} />} onClick={openCreateModal}>
							Nova timeline
						</Button>
					) : null}
				</Group>

				<Divider
					label="❤"
					size="sm"
					color="var(--palette-blush)"
					styles={{
						label: { color: 'var(--palette-blush)' },
					}}
				/>


				{relationshipDays !== null ? (
					<Stack className="" align="center" gap={6}>
						<Text c="dimmed" fw={700} tt="uppercase" size="xs">
							Nossa história já dura
						</Text>
						<div aria-label={`${relationshipDays} ${relationshipDays === 1 ? 'dia' : 'dias'} de relacionamento`}>
							<Counter
								value={relationshipDays}
								fontSize={64}
								gap={2}
								horizontalPadding={4}
								fontWeight={800}
								textColor="var(--palette-blush)"
								gradientHeight={12}
								gradientFrom="var(--app-bg-soft)"
							/>
						</div>
						<Text c="dimmed" size="sm">
							{relationshipDays === 1 ? 'dia juntos' : 'dias juntos'}
						</Text>
					</Stack>
				) : null}

				<Divider
					label="❤"
					size="sm"
					color="var(--palette-blush)"
					styles={{
						label: { color: 'var(--palette-blush)' },
					}}
				/>


				{/* {tree ? (
					<Group grow align="flex-end" gap="md" className="dashboard-timeline-filters">
						<Select
							label="Ano de criação"
							data={[
								{ label: 'Todos os anos', value: 'all' },
								...availableYears.map((year) => ({ label: String(year), value: String(year) })),
							]}
							value={selectedYear}
							onChange={(value) => setSelectedYear(value ?? 'all')}
							allowDeselect={false}
						/>
						<Select
							label="Mês de criação"
							data={[
								{ value: 'all', label: 'Todos os meses' },
								{ value: '1', label: 'Janeiro' },
								{ value: '2', label: 'Fevereiro' },
								{ value: '3', label: 'Março' },
								{ value: '4', label: 'Abril' },
								{ value: '5', label: 'Maio' },
								{ value: '6', label: 'Junho' },
								{ value: '7', label: 'Julho' },
								{ value: '8', label: 'Agosto' },
								{ value: '9', label: 'Setembro' },
								{ value: '10', label: 'Outubro' },
								{ value: '11', label: 'Novembro' },
								{ value: '12', label: 'Dezembro' },
							]}
							value={selectedMonth}
							onChange={(value) => setSelectedMonth(value ?? 'all')}
							allowDeselect={false}
						/>
						<Select
							label="Ordenar por criação"
							data={[
								{ value: 'asc', label: 'Mais antigas primeiro' },
								{ value: 'desc', label: 'Mais recentes primeiro' },
							]}
							value={sortOrder}
							onChange={(value) => setSortOrder((value ?? 'asc') as CardSortOrder)}
							allowDeselect={false}
						/>
					</Group>
				) : null} */}

				{loading ? (
					<Group justify="center" py="xl">
						<Loader color="pink" />
					</Group>
				) : error ? (
					<Alert color="red" radius={8} title="Erro">
						{error}
					</Alert>
				) : !tree ? (
					<Alert
						className="glass-panel"
						color="pink"
						variant="light"
						radius={8}
						icon={<CalendarHeart size={20} />}
						title="Nenhuma timeline criada"
					>
						Crie a timeline principal para começar a registrar a história do relacionamento.
					</Alert>
				) : (
					<Stack className="dashboard-timeline-tree" gap={0}>
						<div className="dashboard-timeline-root">
							<DashboardTimelineCard timeline={tree.root} kind="root" memberRole={tree.memberRole} />
						</div>

						{tree.children.length === 0 ? (
							<Alert
								className="dashboard-timeline-empty glass-panel"
								color="pink"
								variant="light"
								radius={8}
								title="Nenhuma timeline vinculada"
							>
								Use “Nova timeline” para criar uma ramificação ligada à principal.
							</Alert>
						) : visibleChildren.length === 0 ? (
							<Alert
								className="dashboard-timeline-empty glass-panel"
								color="pink"
								variant="light"
								radius={8}
								title="Nenhuma timeline encontrada"
							>
								Escolha outro ano ou mês nos filtros.
							</Alert>
						) : (
							<div className="dashboard-timeline-children">
								{visibleChildren.map((timeline) => (
									<div className="dashboard-timeline-child" key={timeline.id}>
										<DashboardTimelineCard timeline={timeline} kind="child" memberRole={tree.memberRole} />
									</div>
								))}
							</div>
						)}
					</Stack>
				)}
			</Stack>

			<Modal
				opened={modalOpened}
				onClose={() => {
					form.reset()
					setModalOpened(false)
				}}
				title={tree ? 'Nova timeline vinculada' : 'Nova timeline principal'}
				centered
				radius={8}
			>
				<form onSubmit={form.onSubmit(handleCreate)}>
					<Stack gap="md">
						<TextInput
							label="Nome"
							placeholder={tree ? 'Nossa história de viagens' : 'Gabriel & Ana'}
							required
							{...form.getInputProps('name')}
						/>
						{tree ? (
							<Text size="sm" c="dimmed">
								Esta timeline ficará vinculada à principal e herdará a visibilidade{' '}
								{tree.root.visibility === 'public' ? 'pública' : 'privada'}.
							</Text>
						) : (
							<SegmentedControl
								color="pink"
								data={[
									{ label: 'Privada', value: 'private' },
									{ label: 'Pública', value: 'public' },
								]}
								{...form.getInputProps('visibility')}
							/>
						)}
						<Button type="submit" color="pink" loading={creating} leftSection={<Plus size={17} />}>
							{tree ? 'Criar timeline vinculada' : 'Criar timeline principal'}
						</Button>
					</Stack>
				</form>
			</Modal>

		</Container>
	)
}
