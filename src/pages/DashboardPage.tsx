import {
	ActionIcon,
	Alert,
	Badge,
	Button,
	Card,
	Container,
	Group,
	Loader,
	Menu,
	Modal,
	Select,
	Stack,
	Text,
	TextInput,
	Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import {
	CalendarDays,
	CalendarHeart,
	Eye,
	FileText,
	GitBranch,
	Lock,
	MoreHorizontal,
	Pencil,
	Plus,
	Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { reload, sendEmailVerification } from 'firebase/auth'
import { Link } from 'react-router-dom'
import { useAppBackground } from '../components/layout/AppBackgroundContext'
import { TimelineYearSelector, type TimelineSortOrder } from '../components/timeline/TimelineYearSelector'
import { acceptInvite, createCouple, deleteChildTimeline, listPendingInvites, updateChildTimeline } from '../lib/timeline/actions'
import { ensureProfile, fetchTimelineBackgroundImages, getUserTimelineTree } from '../lib/timeline/queries'
import { getErrorMessage } from '../lib/utils'
import { firebaseAuth } from '../lib/firebase/client'
import type { CoupleRole, TimelineVisibility } from '../types/database'
import type { CoupleListItem, TimelineTree, TimelineTreeItem } from '../types/timeline'

import BlurText from '../components/ui/BlurText'
import CSSBlurText from '../components/ui/BlurText.module.css'

type CoupleForm = {
	name: string
	visibility: TimelineVisibility
}

type NameForm = Pick<CoupleForm, 'name'>

function getCreatedAtParts(createdAt: string) {
	const date = new Date(createdAt)

	return {
		year: date.getFullYear(),
		month: date.getMonth() + 1,
		timestamp: date.getTime(),
	}
}

const currentDate = new Date()
const currentYear = currentDate.getFullYear()
const currentMonth = currentDate.getMonth() + 1

function formatEventDate(eventDate: string | null) {
	return eventDate ? new Date(`${eventDate}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem registros ainda'
}

function hasTimelineSummary(timeline: CoupleListItem | TimelineTreeItem): timeline is TimelineTreeItem {
	return 'eventCount' in timeline
}

function DashboardTimelineCard({
	timeline,
	kind,
	memberRole,
	canManage,
	onEdit,
	onDelete,
}: {
	timeline: CoupleListItem | TimelineTreeItem
	kind: 'root' | 'child'
	memberRole: CoupleRole
	canManage: boolean
	onEdit: (timeline: TimelineTreeItem) => void
	onDelete: (timeline: TimelineTreeItem) => void
}) {
	const summary = hasTimelineSummary(timeline) ? timeline : null

	return (
		<Card className="dashboard-timeline-card glass-panel" radius={8} p="md" withBorder>
			<Stack gap="sm">
				<Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
					<Group gap={6}>
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
					) : canManage && summary ? (
						<Menu shadow="md" width={180} position="bottom-end" withinPortal>
							<Menu.Target>
								<ActionIcon variant="subtle" color="gray" aria-label={`Ações para ${timeline.name}`}>
									<MoreHorizontal size={18} />
								</ActionIcon>
							</Menu.Target>
							<Menu.Dropdown>
								<Menu.Item leftSection={<Pencil size={15} />} onClick={() => onEdit(summary)}>
									Editar timeline
								</Menu.Item>
								<Menu.Divider />
								<Menu.Item color="red" leftSection={<Trash2 size={15} />} onClick={() => onDelete(summary)}>
									Excluir timeline
								</Menu.Item>
							</Menu.Dropdown>
						</Menu>
					) : null}
				</Group>

				<div>
					<Title order={2} size="h4" lineClamp={1}>
						{timeline.name}
					</Title>
					<Text c="dimmed" size="xs" mt={3}>
						Criada em {new Date(timeline.created_at).toLocaleDateString('pt-BR')}
					</Text>
				</div>

				{summary ? (
					<Group className="dashboard-timeline-metrics" gap="lg">
						<Group gap={6}>
							<FileText size={15} aria-hidden="true" />
							<Text size="sm" fw={700}>
								{summary.eventCount} {summary.eventCount === 1 ? 'evento' : 'eventos'}
							</Text>
						</Group>
						<Group gap={6}>
							<CalendarDays size={15} aria-hidden="true" />
							<Text size="xs" c="dimmed">
								{formatEventDate(summary.lastEventDate)}
							</Text>
						</Group>
					</Group>
				) : (
					<Text size="xs" c="dimmed">
						Base da árvore do relacionamento
					</Text>
				)}

				<Button component={Link} to={`/timeline/${timeline.id}`} color="pink" size="sm" fullWidth>
					Abrir timeline
				</Button>
			</Stack>
		</Card>
	)
}

export function DashboardPage() {
	const { loadCachedBackgroundImages } = useAppBackground()
	const [tree, setTree] = useState<TimelineTree | null>(null)
	const [loading, setLoading] = useState(true)
	const [creating, setCreating] = useState(false)
	const [savingEdit, setSavingEdit] = useState(false)
	const [deleting, setDeleting] = useState(false)
	const [modalOpened, setModalOpened] = useState(false)
	const [editingTimeline, setEditingTimeline] = useState<TimelineTreeItem | null>(null)
	const [deletingTimeline, setDeletingTimeline] = useState<TimelineTreeItem | null>(null)
	const [selectedYear, setSelectedYear] = useState<number | null>(currentYear)
	const [selectedMonth, setSelectedMonth] = useState<number | null>(currentMonth)
	const [sortOrder, setSortOrder] = useState<TimelineSortOrder>('asc')
	const [error, setError] = useState<string | null>(null)
	const [invites, setInvites] = useState<Awaited<ReturnType<typeof listPendingInvites>>>([])
	const [acceptingInvite, setAcceptingInvite] = useState<string | null>(null)
	const [emailVerified, setEmailVerified] = useState(true)
	const form = useForm<CoupleForm>({
		initialValues: {
			name: '',
			visibility: 'private',
		},
		validate: {
			name: (value) => (value.trim().length >= 2 ? null : 'Informe o nome da timeline.'),
		},
	})
	const editForm = useForm<NameForm>({
		initialValues: { name: '' },
		validate: {
			name: (value) => (value.trim().length >= 2 ? null : 'Informe o nome da timeline.'),
		},
	})

	const loadTree = useCallback(async () => {
		setLoading(true)
		setError(null)

		try {
			if (firebaseAuth.currentUser) {
				await reload(firebaseAuth.currentUser)
				await firebaseAuth.currentUser.getIdToken(true)
				setEmailVerified(firebaseAuth.currentUser.emailVerified)
			}
			await ensureProfile()
			const nextTree = await getUserTimelineTree()
			setTree(nextTree)
			setInvites(nextTree ? [] : await listPendingInvites())
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

	useEffect(() => {
		if (!tree) {
			return
		}

		const cacheKey = `timeline-tree:${tree.root.id}`
		const timelineIds = [tree.root.id, ...tree.children.map((timeline) => timeline.id)]

		loadCachedBackgroundImages(cacheKey, () => fetchTimelineBackgroundImages(timelineIds))
	}, [loadCachedBackgroundImages, tree])

	const availableYears = useMemo(
		() => Array.from(new Set((tree?.children ?? []).map((timeline) => getCreatedAtParts(timeline.created_at).year))).sort((a, b) => b - a),
		[tree?.children],
	)

	const visibleChildren = useMemo(() => {
		return (tree?.children ?? [])
			.filter((timeline) => {
				const { year, month } = getCreatedAtParts(timeline.created_at)

				return (
					(selectedYear === null || year === selectedYear) &&
					(selectedMonth === null || month === selectedMonth)
				)
			})
			.toSorted((first, second) => {
				const comparison = getCreatedAtParts(first.created_at).timestamp - getCreatedAtParts(second.created_at).timestamp

				return sortOrder === 'asc' ? comparison : -comparison
			})
	}, [selectedMonth, selectedYear, sortOrder, tree?.children])

	const canManageRelationship = tree?.memberRole === 'owner'

	async function handleAcceptInvite(id: string) {
		setAcceptingInvite(id)
		try {
			await acceptInvite(id)
			await loadTree()
			notifications.show({ color: 'green', title: 'Convite aceito', message: 'A timeline compartilhada já está disponível.' })
		} catch (inviteError) {
			notifications.show({ color: 'red', title: 'Não foi possível aceitar o convite', message: getErrorMessage(inviteError) })
		} finally {
			setAcceptingInvite(null)
		}
	}

	async function resendVerification() {
		try {
			if (!firebaseAuth.currentUser) throw new Error('Entre novamente para confirmar seu e-mail.')
			await sendEmailVerification(firebaseAuth.currentUser)
			notifications.show({ color: 'green', title: 'E-mail enviado', message: 'Abra a mensagem recebida e confirme seu endereço.' })
		} catch (verificationError) {
			notifications.show({ color: 'red', title: 'Não foi possível enviar a confirmação', message: getErrorMessage(verificationError) })
		}
	}

	function openCreateModal() {
		form.setValues({
			name: '',
			visibility: tree?.root.visibility ?? 'private',
		})
		setModalOpened(true)
	}

	function openEditModal(timeline: TimelineTreeItem) {
		editForm.setValues({ name: timeline.name })
		setEditingTimeline(timeline)
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

	async function handleEdit(values: NameForm) {
		if (!editingTimeline) {
			return
		}

		setSavingEdit(true)

		try {
			await updateChildTimeline({ timelineId: editingTimeline.id, name: values.name })
			notifications.show({ color: 'green', title: 'Timeline atualizada', message: 'O novo nome já aparece na árvore.' })
			setEditingTimeline(null)
			await loadTree()
		} catch (updateError) {
			notifications.show({ color: 'red', title: 'Erro ao editar timeline', message: getErrorMessage(updateError) })
		} finally {
			setSavingEdit(false)
		}
	}

	async function handleDelete() {
		if (!deletingTimeline) {
			return
		}

		setDeleting(true)

		try {
			await deleteChildTimeline(deletingTimeline.id)
			notifications.show({
				color: 'green',
				title: 'Timeline excluída',
				message: 'Os eventos e fotos desta ramificação também foram removidos.',
			})
			setDeletingTimeline(null)
			await loadTree()
		} catch (deleteError) {
			notifications.show({ color: 'red', title: 'Erro ao excluir timeline', message: getErrorMessage(deleteError) })
		} finally {
			setDeleting(false)
		}
	}

	return (
		<Container size="lg" py={{ base: 'lg', sm: 'xl' }}>
			<Stack gap="xl">
				{!emailVerified && !tree ? (
					<Alert color="yellow" title="Confirme seu e-mail">
						<Stack gap="sm">
							<Text size="sm">Para receber e aceitar convites, confirme o endereço de e-mail da sua conta. Depois, atualize esta página.</Text>
							<Button size="xs" variant="light" onClick={() => void resendVerification()}>Enviar confirmação novamente</Button>
						</Stack>
					</Alert>
				) : null}
				{invites.map((invite) => (
					<Alert key={invite.id} color="pink" title="Convite para uma timeline">
						<Stack gap="sm">
							<Text size="sm">Você recebeu um convite para compartilhar uma timeline. Confirme seu e-mail antes de aceitar.</Text>
							<Button size="xs" color="pink" loading={acceptingInvite === invite.id} onClick={() => void handleAcceptInvite(invite.id)}>Aceitar convite</Button>
						</Stack>
					</Alert>
				))}
				<Group justify="space-between" align="flex-end" gap="lg">
					<Stack gap={4}>
						<Text c="var(--palette-blush)" fw={800} tt="uppercase" size="xs">
							Dashboard
						</Text>
						<BlurText
							text="Sua árvore de timelines"
							delay={250}
							animateBy="words"
							direction="top"
							className={CSSBlurText.titleBlurTextTimeLineCouple}
						/>
					</Stack>
					{canManageRelationship || !tree ? (
						<Button color="pink" leftSection={<Plus size={17} />} onClick={openCreateModal}>
							Nova timeline
						</Button>
					) : null}
				</Group>

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
					<Stack gap="lg">
						{tree.children.length > 0 ? (
							<TimelineYearSelector
								years={availableYears}
								selectedYear={selectedYear}
								selectedMonth={selectedMonth}
								sortOrder={sortOrder}
								onYearChange={setSelectedYear}
								onMonthChange={setSelectedMonth}
								onSortOrderChange={setSortOrder}
							/>
						) : null}

						<div className="dashboard-timeline-tree">
							<div className="dashboard-timeline-root">
								<DashboardTimelineCard
									timeline={tree.root}
									kind="root"
									memberRole={tree.memberRole}
									canManage={false}
									onEdit={openEditModal}
									onDelete={setDeletingTimeline}
								/>
							</div>

							{tree.children.length === 0 ? (
								<Alert className="dashboard-timeline-empty glass-panel" color="pink" variant="light" radius={8} title="Nenhuma timeline vinculada">
									Use “Nova timeline” para criar uma ramificação ligada à principal.
								</Alert>
							) : (
								<>
									{visibleChildren.length === 0 ? (
									<Alert className="dashboard-timeline-empty glass-panel" color="pink" variant="light" radius={8} title="Nenhuma timeline encontrada">
											Ajuste o ano ou mês para visualizar outras ramificações.
										</Alert>
									) : (
										<div
											className="dashboard-timeline-children"
											data-child-count={Math.min(visibleChildren.length, 3)}
											style={
												{
													'--timeline-child-count': Math.min(visibleChildren.length, 3),
													'--timeline-children-max-width': `${Math.min(visibleChildren.length, 3) * 360 + (Math.min(visibleChildren.length, 3) - 1) * 18}px`,
												} as CSSProperties
											}
										>
											{visibleChildren.map((timeline) => (
												<div className="dashboard-timeline-child" key={timeline.id}>
													<DashboardTimelineCard timeline={timeline} kind="child" memberRole={tree.memberRole} canManage={canManageRelationship} onEdit={openEditModal} onDelete={setDeletingTimeline} />
												</div>
											))}
										</div>
									)}
								</>
							)}
						</div>
					</Stack>
				)}
			</Stack>

			<Modal opened={modalOpened} onClose={() => { form.reset(); setModalOpened(false) }} title={tree ? 'Nova timeline vinculada' : 'Nova timeline principal'} centered radius={8}>
				<form onSubmit={form.onSubmit(handleCreate)}>
					<Stack gap="md">
						<TextInput label="Nome" placeholder={tree ? 'Nossa história de viagens' : 'Gabriel & Ana'} required {...form.getInputProps('name')} />
						{tree ? (
							<Text size="sm" c="dimmed">Esta timeline ficará vinculada à principal e herdará a visibilidade {tree.root.visibility === 'public' ? 'pública' : 'privada'}.</Text>
						) : (
							<Select label="Visibilidade" data={[{ label: 'Privada', value: 'private' }, { label: 'Pública', value: 'public' }]} {...form.getInputProps('visibility')} />
						)}
						<Button type="submit" color="pink" loading={creating} leftSection={<Plus size={17} />}>
							{tree ? 'Criar timeline vinculada' : 'Criar timeline principal'}
						</Button>
					</Stack>
				</form>
			</Modal>

			<Modal opened={Boolean(editingTimeline)} onClose={() => setEditingTimeline(null)} title="Editar timeline vinculada" centered radius={8}>
				<form onSubmit={editForm.onSubmit(handleEdit)}>
					<Stack gap="md">
						<TextInput label="Nome" required {...editForm.getInputProps('name')} />
						<Button type="submit" color="pink" loading={savingEdit} leftSection={<Pencil size={17} />}>Salvar alterações</Button>
					</Stack>
				</form>
			</Modal>

			<Modal opened={Boolean(deletingTimeline)} onClose={() => setDeletingTimeline(null)} title="Excluir timeline vinculada" centered radius={8}>
				<Stack gap="md">
					<Text>Excluir “{deletingTimeline?.name}” removerá permanentemente seus eventos e fotos. Esta ação não pode ser desfeita.</Text>
					<Group justify="flex-end">
						<Button variant="default" onClick={() => setDeletingTimeline(null)} disabled={deleting}>Cancelar</Button>
						<Button color="red" loading={deleting} leftSection={<Trash2 size={17} />} onClick={() => void handleDelete()}>Excluir timeline</Button>
					</Group>
				</Stack>
			</Modal>
		</Container>
	)
}
