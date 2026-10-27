import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Modal,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDashed,
  Compass,
  Film,
  Home,
  MapPin,
  Pencil,
  Plane,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Utensils,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createFutureMoment, completeFutureMoment, deleteFutureMoment, updateFutureMoment } from '../lib/future/actions'
import { fetchFutureMoments } from '../lib/future/queries'
import { getUserTimelineTree } from '../lib/timeline/queries'
import { getErrorMessage } from '../lib/utils'
import type { FutureMoment, FutureMomentCategory, FutureMomentStatus } from '../types/database'
import {
  futureMomentCategories,
  futureMomentStatuses,
  getFutureMomentCategoryLabel,
  getFutureMomentStatusLabel,
  type FutureMomentFormValues,
} from '../types/future'

type MomentFilter = 'all' | FutureMomentStatus

const initialFormValues: FutureMomentFormValues = {
  title: '',
  description: '',
  category: 'Sonho',
  status: 'planned',
  targetDate: '',
  locationName: '',
}

const statusColors: Record<FutureMomentStatus, string> = {
  planned: 'grape',
  in_progress: 'orange',
  completed: 'green',
}

function renderCategoryIcon(category: FutureMomentCategory) {
  switch (category) {
    case 'Viagem':
      return <Plane size={20} />
    case 'Restaurante':
      return <Utensils size={20} />
    case 'Filme ou série':
      return <Film size={20} />
    case 'Lugar':
      return <Compass size={20} />
    case 'Meta':
      return <Home size={20} />
    default:
      return <Sparkles size={20} />
  }
}

function renderStatusIcon(status: FutureMomentStatus, size: number) {
  switch (status) {
    case 'planned':
      return <CircleDashed size={size} />
    case 'in_progress':
      return <Target size={size} />
    default:
      return <CheckCircle2 size={size} />
  }
}

function formatTargetDate(targetDate: string | null) {
  if (!targetDate) {
    return 'Sem data definida'
  }

  return new Date(`${targetDate}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function FutureMomentCard({
  moment,
  coupleId,
  completing,
  onComplete,
  onDelete,
  onEdit,
}: {
  moment: FutureMoment
  coupleId: string
  completing: boolean
  onComplete: (moment: FutureMoment) => void
  onDelete: (moment: FutureMoment) => void
  onEdit: (moment: FutureMoment) => void
}) {
  return (
    <Card className="future-moment-card glass-panel" radius={8} p="lg" withBorder>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
          <ThemeIcon color="pink" variant="light" size={42} radius="xl">
            {renderCategoryIcon(moment.category)}
          </ThemeIcon>
          <Group gap={6} wrap="wrap" justify="flex-end">
            <Badge color="pink" variant="light">
              {getFutureMomentCategoryLabel(moment.category)}
            </Badge>
            <Badge
              color={statusColors[moment.status]}
              variant="light"
              leftSection={renderStatusIcon(moment.status, 12)}
            >
              {getFutureMomentStatusLabel(moment.status)}
            </Badge>
          </Group>
        </Group>

        <div>
          <Title order={3} size="h3">
            {moment.title}
          </Title>
          {moment.description ? (
            <Text c="dimmed" size="sm" mt={6} lineClamp={3}>
              {moment.description}
            </Text>
          ) : null}
        </div>

        <Stack gap={6} className="future-moment-details">
          <Group gap={7} wrap="nowrap">
            <CalendarDays size={15} aria-hidden="true" />
            <Text size="sm">{formatTargetDate(moment.target_date)}</Text>
          </Group>
          {moment.location_name ? (
            <Group gap={7} wrap="nowrap">
              <MapPin size={15} aria-hidden="true" />
              <Text size="sm" lineClamp={1}>
                {moment.location_name}
              </Text>
            </Group>
          ) : null}
        </Stack>

        <Group gap="xs" grow>
          <Button variant="subtle" color="gray" leftSection={<Pencil size={15} />} onClick={() => onEdit(moment)}>
            Editar
          </Button>
          <Button variant="subtle" color="red" leftSection={<Trash2 size={15} />} onClick={() => onDelete(moment)}>
            Excluir
          </Button>
        </Group>

        {moment.status === 'completed' ? (
          moment.completed_event_id ? (
            <Button component={Link} to={`/timeline/${coupleId}`} variant="light" color="green" fullWidth>
              Ver na timeline
            </Button>
          ) : null
        ) : (
          <Button
            color="pink"
            variant="light"
            fullWidth
            loading={completing}
            leftSection={<Check size={16} />}
            rightSection={<ArrowRight size={16} />}
            onClick={() => onComplete(moment)}
          >
            Concluir e criar evento
          </Button>
        )}
      </Stack>
    </Card>
  )
}

export function FutureMomentsPage() {
  const navigate = useNavigate()
  const [coupleId, setCoupleId] = useState<string | null>(null)
  const [moments, setMoments] = useState<FutureMoment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<MomentFilter>('all')
  const [formOpened, setFormOpened] = useState(false)
  const [editingMoment, setEditingMoment] = useState<FutureMoment | null>(null)
  const [deletingMoment, setDeletingMoment] = useState<FutureMoment | null>(null)
  const form = useForm<FutureMomentFormValues>({
    initialValues: initialFormValues,
    validate: {
      title: (value) => (value.trim().length >= 2 ? null : 'Informe um título.'),
      targetDate: (value) => (!value || /^\d{4}-\d{2}-\d{2}$/.test(value) ? null : 'Informe uma data válida.'),
    },
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const tree = await getUserTimelineTree()

      if (!tree) {
        throw new Error('Crie uma timeline ou vincule uma pessoa antes de adicionar planos.')
      }

      const nextMoments = await fetchFutureMoments(tree.root.id)
      setCoupleId(tree.root.id)
      setMoments(nextMoments)
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Não foi possível carregar os planos do casal.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [load])

  const filteredMoments = useMemo(
    () => (activeFilter === 'all' ? moments : moments.filter((moment) => moment.status === activeFilter)),
    [activeFilter, moments],
  )
  const groupedMoments = useMemo(
    () =>
      futureMomentStatuses
        .map((status) => ({
          status: status.value,
          label: status.label,
          moments: filteredMoments.filter((moment) => moment.status === status.value),
        }))
        .filter((group) => group.moments.length > 0),
    [filteredMoments],
  )
  const statusCounts = useMemo(
    () => ({
      planned: moments.filter((moment) => moment.status === 'planned').length,
      in_progress: moments.filter((moment) => moment.status === 'in_progress').length,
      completed: moments.filter((moment) => moment.status === 'completed').length,
    }),
    [moments],
  )

  function openCreateForm() {
    setEditingMoment(null)
    form.setValues(initialFormValues)
    form.clearErrors()
    setFormOpened(true)
  }

  function openEditForm(moment: FutureMoment) {
    setEditingMoment(moment)
    form.setValues({
      title: moment.title,
      description: moment.description ?? '',
      category: moment.category,
      status: moment.status,
      targetDate: moment.target_date ?? '',
      locationName: moment.location_name ?? '',
    })
    form.clearErrors()
    setFormOpened(true)
  }

  async function handleSave(values: FutureMomentFormValues) {
    if (!coupleId) {
      return
    }

    setSaving(true)

    try {
      const input = { coupleId, ...values }

      if (editingMoment) {
        await updateFutureMoment(editingMoment.id, input)
      } else {
        await createFutureMoment(input)
      }

      notifications.show({
        color: 'green',
        title: editingMoment ? 'Plano atualizado' : 'Plano adicionado',
        message: editingMoment ? 'A mudança já está compartilhada.' : 'Mais uma ideia para o futuro de vocês.',
      })
      setFormOpened(false)
      await load()
    } catch (saveError) {
      notifications.show({
        color: 'red',
        title: 'Não foi possível salvar',
        message: getErrorMessage(saveError),
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deletingMoment || !coupleId) {
      return
    }

    setDeleting(true)

    try {
      await deleteFutureMoment(deletingMoment.id, coupleId)
      notifications.show({ color: 'green', title: 'Plano excluído', message: 'Ele não aparece mais na lista do casal.' })
      setDeletingMoment(null)
      await load()
    } catch (deleteError) {
      notifications.show({
        color: 'red',
        title: 'Não foi possível excluir',
        message: getErrorMessage(deleteError),
      })
    } finally {
      setDeleting(false)
    }
  }

  async function handleComplete(moment: FutureMoment) {
    if (!coupleId) {
      return
    }

    setCompletingId(moment.id)

    try {
      const eventId = await completeFutureMoment(moment.id)
      notifications.show({
        color: 'green',
        title: 'Plano virou memória',
        message: 'Adicione fotos e detalhes para completar o novo evento.',
      })
      navigate(`/timeline/${coupleId}/eventos/${eventId}/editar`)
    } catch (completeError) {
      notifications.show({
        color: 'red',
        title: 'Não foi possível concluir o plano',
        message: getErrorMessage(completeError),
      })
    } finally {
      setCompletingId(null)
    }
  }

  if (loading) {
    return (
      <Container size="lg" py={96}>
        <Group justify="center">
          <Loader color="pink" />
        </Group>
      </Container>
    )
  }

  if (error) {
    return (
      <Container size="lg" py="xl">
        <Alert color="red" radius={8} title="Não foi possível abrir o futuro">
          {error}
        </Alert>
        <Group mt="md">
          <Button component={Link} to="/dashboard" variant="light" color="pink">
            Voltar para árvores
          </Button>
          <Button color="pink" onClick={() => void load()}>
            Tentar novamente
          </Button>
        </Group>
      </Container>
    )
  }

  return (
    <Container size="lg" py={{ base: 'lg', sm: 'xl' }} className="future-moments-page">
      <Stack gap="xl">
        <Paper className="future-hero glass-panel" radius={8} p={{ base: 'lg', sm: 'xl' }} withBorder>
          <Group justify="space-between" align="flex-end" gap="xl">
            <Stack gap="sm" maw={620}>
              <Text className="future-eyebrow" fw={800} tt="uppercase" size="xs">
                O próximo capítulo
              </Text>
              <Title order={1}>O que ainda vamos viver</Title>
              <Text c="dimmed" size="lg">
                Guardem aqui as ideias que ainda não viraram memória — da próxima viagem ao sonho mais distante.
              </Text>
            </Stack>
            <Button color="pink" size="md" leftSection={<Plus size={17} />} onClick={openCreateForm}>
              Adicionar plano
            </Button>
          </Group>
          <div className="future-horizon" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </Paper>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          {futureMomentStatuses.map((status) => {
            return (
              <Card key={status.value} className="glass-panel future-summary-card" radius={8} p="md" withBorder>
                <Group gap="sm">
                  <ThemeIcon color={statusColors[status.value]} variant="light" radius="xl">
                    {renderStatusIcon(status.value, 17)}
                  </ThemeIcon>
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      {status.label}
                    </Text>
                    <Text size="xl" fw={800} lh={1.1}>
                      {statusCounts[status.value]}
                    </Text>
                  </div>
                </Group>
              </Card>
            )
          })}
        </SimpleGrid>

        <Group justify="space-between" align="center" gap="md">
          <Stack gap={2}>
            <Title order={2} size="h3">
              Planos do casal
            </Title>
            <Text c="dimmed" size="sm">
              Quando um plano acontecer, transforme-o em um momento da timeline.
            </Text>
          </Stack>
          <SegmentedControl
            value={activeFilter}
            onChange={(value) => setActiveFilter(value as MomentFilter)}
            data={[
              { value: 'all', label: 'Todos' },
              { value: 'planned', label: 'Planejados' },
              { value: 'in_progress', label: 'Em andamento' },
              { value: 'completed', label: 'Realizados' },
            ]}
          />
        </Group>

        {groupedMoments.length === 0 ? (
          <Card className="glass-panel future-empty-state" radius={8} p={{ base: 'xl', sm: 56 }} withBorder>
            <Stack align="center" gap="sm" ta="center">
              <ThemeIcon color="pink" variant="light" size={56} radius="xl">
                <Sparkles size={25} />
              </ThemeIcon>
              <Title order={2} size="h3">
                {activeFilter === 'all' ? 'Ainda há espaço para o próximo sonho' : 'Nenhum plano neste estado'}
              </Title>
              <Text c="dimmed" maw={460}>
                {activeFilter === 'all' ? 'Adicionem uma viagem, um restaurante ou uma meta. O plano de hoje pode virar a melhor história de amanhã.' : 'Escolha outro filtro para ver os demais planos.'}
              </Text>
              {activeFilter === 'all' ? <Button color="pink" leftSection={<Plus size={17} />} onClick={openCreateForm}>Adicionar primeiro plano</Button> : <Button variant="light" color="pink" onClick={() => setActiveFilter('all')}>Ver todos os planos</Button>}
            </Stack>
          </Card>
        ) : (
          <Stack gap="xl">
            {groupedMoments.map((group) => (
              <Stack key={group.status} gap="sm">
                <Group gap="xs">
                  <Text fw={800}>{group.label}</Text>
                  <Badge color={statusColors[group.status]} variant="light">
                    {group.moments.length}
                  </Badge>
                </Group>
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  {group.moments.map((moment) => (
                    <FutureMomentCard
                      key={moment.id}
                      moment={moment}
                      coupleId={coupleId ?? ''}
                      completing={completingId === moment.id}
                      onComplete={handleComplete}
                      onDelete={setDeletingMoment}
                      onEdit={openEditForm}
                    />
                  ))}
                </SimpleGrid>
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>

      <Modal
        opened={formOpened}
        onClose={() => setFormOpened(false)}
        title={editingMoment ? 'Editar plano' : 'Novo plano para vocês'}
        centered
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSave)}>
          <Stack gap="md">
            <TextInput label="O que vocês querem viver?" placeholder="Conhecer a Patagônia" required {...form.getInputProps('title')} />
            <Group grow align="flex-start">
              <Select
                label="Tipo de plano"
                data={futureMomentCategories}
                required
                {...form.getInputProps('category')}
              />
              <Select
                label="Status"
                data={futureMomentStatuses}
                required
                {...form.getInputProps('status')}
              />
            </Group>
            <Group grow align="flex-start">
              <TextInput label="Quando?" type="date" {...form.getInputProps('targetDate')} />
              <TextInput label="Onde?" placeholder="Cidade, restaurante ou lugar" {...form.getInputProps('locationName')} />
            </Group>
            <Textarea
              label="Detalhes"
              placeholder="Por que isso seria especial para vocês?"
              minRows={4}
              autosize
              {...form.getInputProps('description')}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="subtle" color="gray" onClick={() => setFormOpened(false)}>
                Cancelar
              </Button>
              <Button type="submit" color="pink" loading={saving}>
                {editingMoment ? 'Salvar alterações' : 'Salvar plano'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={Boolean(deletingMoment)} onClose={() => setDeletingMoment(null)} title="Excluir plano" centered>
        <Stack gap="md">
          <Text>
            Excluir <strong>{deletingMoment?.title}</strong>? Essa ação não pode ser desfeita.
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setDeletingMoment(null)}>
              Cancelar
            </Button>
            <Button color="red" loading={deleting} onClick={() => void handleDelete()}>
              Excluir plano
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  )
}
