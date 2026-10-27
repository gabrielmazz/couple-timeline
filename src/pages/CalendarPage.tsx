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
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { Calendar, DateInput } from '@mantine/dates'
import { useForm } from '@mantine/form'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import {
  Bell,
  CalendarDays,
  Compass,
  Edit3,
  Heart,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { calendarEntryCategories, createCalendarEntry, deleteCalendarEntry, updateCalendarEntry } from '../lib/calendar/actions'
import { fetchCalendarPage } from '../lib/calendar/queries'
import { getAnnualDate, getCalendarEntryDate } from '../lib/calendar/recurrence'
import { getErrorMessage } from '../lib/utils'
import type { CalendarEntryCategory, CoupleCalendarEntry } from '../types/database'
import type { CalendarEntryFormModel, CalendarPageData } from '../types/calendar'

type CalendarItemSource = 'calendar' | 'timeline' | 'relationship' | 'birthday'

type CalendarItem = {
  id: string
  source: CalendarItemSource
  title: string
  description: string | null
  eventDate: string
  eventTime: string | null
  locationName: string | null
  category: CalendarEntryCategory | 'relationship' | 'birthday' | 'timeline'
  categoryLabel: string
  reminderDaysBefore: number
  editable: boolean
  entry?: CoupleCalendarEntry
  timelineName?: string
}

const EMPTY_FORM: CalendarEntryFormModel = {
  title: '',
  description: '',
  eventDate: new Date().toISOString().slice(0, 10),
  eventTime: '',
  locationName: '',
  category: 'other',
  recurrence: 'none',
  reminderDaysBefore: '0',
}

const reminderOptions = [
  { value: '0', label: 'Sem lembrete' },
  { value: '1', label: '1 dia antes' },
  { value: '3', label: '3 dias antes' },
  { value: '7', label: '1 semana antes' },
  { value: '14', label: '2 semanas antes' },
  { value: '30', label: '1 mês antes' },
]

const categoryLabels = new Map<string, string>([
  ...calendarEntryCategories.map((category) => [category.value, category.label] as const),
  ['relationship', 'Aniversário de namoro'],
  ['birthday', 'Aniversário'],
  ['timeline', 'Memória'],
])

function getTodayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function getDateAtNoon(date: string) {
  return new Date(`${date}T12:00:00`)
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(getDateAtNoon(date))
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(getDateAtNoon(date))
}

function formatTime(time: string | null) {
  return time ? time.slice(0, 5) : null
}

function getDaysUntil(date: string) {
  const today = new Date(`${getTodayIso()}T00:00:00Z`)
  const target = new Date(`${date}T00:00:00Z`)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function getAnnualItems(data: CalendarPageData, year: number): CalendarItem[] {
  const items: CalendarItem[] = []

  if (data.couple.relationship_started_at) {
    items.push({
      id: 'relationship-anniversary',
      source: 'relationship',
      title: 'Aniversário de namoro',
      description: 'A data que marca o começo da história de vocês.',
      eventDate: getAnnualDate(data.couple.relationship_started_at.slice(5), year),
      eventTime: null,
      locationName: null,
      category: 'relationship',
      categoryLabel: 'Aniversário de namoro',
      reminderDaysBefore: 7,
      editable: false,
    })
  }

  for (const member of data.members) {
    if (!member.birth_date) {
      continue
    }

    items.push({
      id: `birthday-${member.id}`,
      source: 'birthday',
      title: `Aniversário de ${member.name || 'uma pessoa especial'}`,
      description: 'Uma data pessoal importante para lembrar juntos.',
      eventDate: getAnnualDate(member.birth_date.slice(5), year),
      eventTime: null,
      locationName: null,
      category: 'birthday',
      categoryLabel: 'Aniversário',
      reminderDaysBefore: 7,
      editable: false,
    })
  }

  return items
}

function getCalendarItems(data: CalendarPageData, year: number): CalendarItem[] {
  const entries: CalendarItem[] = data.entries.flatMap((entry) => {
    const eventDate = getCalendarEntryDate(entry, year)
    if (!eventDate) return []
    return [{
    id: entry.id,
    source: 'calendar',
    title: entry.title,
    description: entry.description,
    eventDate,
    eventTime: entry.event_time,
    locationName: entry.location_name,
    category: entry.category,
    categoryLabel: categoryLabels.get(entry.category) ?? 'Outro',
    reminderDaysBefore: entry.reminder_days_before,
    editable: data.canEdit,
    entry,
    }]
  })
  const memories: CalendarItem[] = data.timelineEvents.map((event) => ({
    id: `timeline-${event.id}`,
    source: 'timeline',
    title: event.title,
    description: null,
    eventDate: event.event_date,
    eventTime: event.event_time,
    locationName: event.location_name,
    category: 'timeline',
    categoryLabel: 'Memória',
    reminderDaysBefore: 0,
    editable: false,
    timelineName: event.timelineName,
  }))

  return [...entries, ...memories, ...getAnnualItems(data, year)].sort((first, second) => {
    if (first.eventDate !== second.eventDate) {
      return first.eventDate.localeCompare(second.eventDate)
    }

    return (first.eventTime ?? '').localeCompare(second.eventTime ?? '')
  })
}

function CalendarItemCard({
  item,
  onEdit,
  onDelete,
}: {
  item: CalendarItem
  onEdit: (entry: CoupleCalendarEntry) => void
  onDelete: (entry: CoupleCalendarEntry) => void
}) {
  const icon = item.source === 'relationship' ? <Heart size={15} /> : item.source === 'birthday' ? <Sparkles size={15} /> : item.source === 'timeline' ? <CalendarDays size={15} /> : <Compass size={15} />

  return (
    <Card className={`calendar-item-card calendar-item-card-${item.source}`} radius={8} p="md" withBorder>
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
          <Badge variant="light" color={item.source === 'timeline' ? 'grape' : 'pink'} leftSection={icon}>
            {item.categoryLabel}
          </Badge>
          {item.editable && item.entry ? (
            <Group gap={4} wrap="nowrap">
              <Button
                variant="subtle"
                color="pink"
                size="compact-xs"
                leftSection={<Edit3 size={14} />}
                onClick={() => onEdit(item.entry!)}
              >
                Editar
              </Button>
              <Button
                variant="subtle"
                color="red"
                size="compact-xs"
                leftSection={<Trash2 size={14} />}
                onClick={() => onDelete(item.entry!)}
              >
                Excluir
              </Button>
            </Group>
          ) : null}
        </Group>

        <div>
          <Text fw={800} size="lg" lineClamp={2}>
            {item.title}
          </Text>
          <Text c="dimmed" size="sm" mt={4}>
            {formatDate(item.eventDate)}
            {formatTime(item.eventTime) ? ` · ${formatTime(item.eventTime)}` : ''}
          </Text>
        </div>

        {item.locationName ? (
          <Group gap={6} wrap="nowrap">
            <MapPin size={15} aria-hidden="true" />
            <Text size="sm" c="dimmed" lineClamp={1}>
              {item.locationName}
            </Text>
          </Group>
        ) : null}

        {item.description ? (
          <Text size="sm" c="dimmed" lineClamp={3}>
            {item.description}
          </Text>
        ) : null}

        {item.source === 'timeline' && item.timelineName ? (
          <Text size="xs" c="var(--palette-blush)">
            Registrado em {item.timelineName}
          </Text>
        ) : null}

        {item.source === 'calendar' && item.reminderDaysBefore > 0 ? (
          <Group gap={6}>
            <Bell size={14} aria-hidden="true" />
            <Text size="xs" c="dimmed">
              Lembrete {item.reminderDaysBefore === 1 ? '1 dia' : `${item.reminderDaysBefore} dias`} antes
            </Text>
          </Group>
        ) : null}
      </Stack>
    </Card>
  )
}

export function CalendarPage() {
  const [data, setData] = useState<CalendarPageData | null>(null)
  const [calendarDate, setCalendarDate] = useState(getTodayIso())
  const [selectedDate, setSelectedDate] = useState(getTodayIso())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalOpened, setModalOpened] = useState(false)
  const [editingEntry, setEditingEntry] = useState<CoupleCalendarEntry | null>(null)
  const form = useForm<CalendarEntryFormModel>({
    initialValues: EMPTY_FORM,
    validate: {
      title: (value) => (value.trim().length < 2 ? 'Informe um título.' : value.trim().length > 120 ? 'Use até 120 caracteres.' : null),
      description: (value) => (value.trim().length > 2000 ? 'Use até 2000 caracteres.' : null),
      eventDate: (value) => (!value ? 'Informe uma data.' : null),
      eventTime: (value) => (value && !/^\d{2}:\d{2}$/.test(value) ? 'Informe um horário válido.' : null),
      locationName: (value) => (value.trim().length > 120 ? 'Use até 120 caracteres.' : null),
    },
  })

  const loadCalendar = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      setData(await fetchCalendarPage())
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Não foi possível carregar o calendário.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCalendar()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadCalendar])

  const displayYear = Number(calendarDate.slice(0, 4))
  const displayItems = useMemo(() => (data ? getCalendarItems(data, displayYear) : []), [data, displayYear])
  const itemsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarItem[]>()

    for (const item of displayItems) {
      grouped.set(item.eventDate, [...(grouped.get(item.eventDate) ?? []), item])
    }

    return grouped
  }, [displayItems])
  const selectedItems = itemsByDate.get(selectedDate) ?? []
  const upcomingItems = useMemo(() => {
    if (!data) {
      return []
    }

    const today = getTodayIso()
    const currentYear = Number(today.slice(0, 4))
    const years = new Set([currentYear, currentYear + 1, ...data.entries.map((entry) => Number(entry.event_date.slice(0, 4))).filter((year) => year > currentYear)])
    const items = [...years].flatMap((year) => getCalendarItems(data, year))

    return items
      .filter((item) => item.source !== 'timeline' && item.eventDate >= today)
      .sort((first, second) => first.eventDate.localeCompare(second.eventDate))
      .filter((item, index, allItems) => allItems.findIndex((candidate) => candidate.id === item.id) === index)
      .slice(0, 5)
  }, [data])
  const nextItem = upcomingItems[0] ?? null

  function openCreate(date = selectedDate) {
    setEditingEntry(null)
    form.setValues({ ...EMPTY_FORM, eventDate: date })
    form.resetDirty()
    setModalOpened(true)
  }

  function openEdit(entry: CoupleCalendarEntry) {
    setEditingEntry(entry)
    form.setValues({
      title: entry.title,
      description: entry.description ?? '',
      eventDate: entry.event_date,
      eventTime: formatTime(entry.event_time) ?? '',
      locationName: entry.location_name ?? '',
      category: entry.category,
      recurrence: entry.recurrence ?? 'none',
      reminderDaysBefore: String(entry.reminder_days_before),
    })
    form.resetDirty()
    setModalOpened(true)
  }

  async function handleSubmit(values: CalendarEntryFormModel) {
    if (!data) {
      return
    }

    setSaving(true)

    try {
      if (editingEntry) {
        await updateCalendarEntry({ ...values, coupleId: data.couple.id, entryId: editingEntry.id })
      } else {
        await createCalendarEntry({ ...values, coupleId: data.couple.id })
      }

      notifications.show({
        color: 'green',
        title: editingEntry ? 'Compromisso atualizado' : 'Compromisso adicionado',
        message: 'O calendário do casal já está com a nova informação.',
      })
      setModalOpened(false)
      await loadCalendar()
    } catch (saveError) {
      notifications.show({
        color: 'red',
        title: editingEntry ? 'Erro ao atualizar' : 'Erro ao adicionar',
        message: getErrorMessage(saveError),
      })
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete(entry: CoupleCalendarEntry) {
    modals.openConfirmModal({
      title: 'Excluir compromisso',
      centered: true,
      children: <Text size="sm">Este compromisso será removido do calendário do casal.</Text>,
      labels: { confirm: 'Excluir', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        if (!data) {
          return
        }

        try {
          await deleteCalendarEntry(data.couple.id, entry.id)
          notifications.show({ color: 'green', title: 'Compromisso excluído', message: 'O calendário foi atualizado.' })
          await loadCalendar()
        } catch (deleteError) {
          notifications.show({ color: 'red', title: 'Erro ao excluir', message: getErrorMessage(deleteError) })
        }
      },
    })
  }

  if (loading && !data) {
    return (
      <Container size="lg" py={96}>
        <Group justify="center">
          <Loader color="pink" />
        </Group>
      </Container>
    )
  }

  if (error && !data) {
    return (
      <Container size="lg" py="xl">
        <Alert color="red" radius={8} title="Calendário indisponível">
          {error}
          <Button mt="sm" variant="light" color="red" onClick={() => void loadCalendar()}>Tentar novamente</Button>
        </Alert>
        <Button mt="md" component={Link} to="/dashboard" variant="light" color="pink">
          Voltar ao dashboard
        </Button>
      </Container>
    )
  }

  if (!data) {
    return null
  }

  return (
    <Container className="calendar-page" size="lg" py={{ base: 'lg', sm: 'xl' }}>
      <Stack gap="xl">
        <Group justify="space-between" align="flex-end" gap="lg">
          <Stack gap={5}>
            <Text c="var(--palette-blush)" fw={800} tt="uppercase" size="xs">
              O que vem pela frente
            </Text>
            <Title order={1}>Calendário do casal</Title>
            <Text c="dimmed" maw={620}>
              Datas importantes, planos e memórias reunidos no mesmo lugar.
            </Text>
          </Stack>
          {data.canEdit ? (
            <Button color="pink" leftSection={<Plus size={17} />} onClick={() => openCreate()}>
              Adicionar data
            </Button>
          ) : null}
        </Group>

        {error ? (
          <Alert color="yellow" radius={8} title="Algumas informações não foram atualizadas">
            {error}
          </Alert>
        ) : null}

        {nextItem ? (
          <Card className="calendar-next-card glass-panel" radius={8} p={{ base: 'lg', sm: 'xl' }} withBorder>
            <Group justify="space-between" align="center" gap="xl" wrap="wrap">
              <Group gap="md" wrap="nowrap" align="flex-start">
                <ThemeIcon size={48} radius="xl" color="pink" variant="light">
                  <Heart size={23} />
                </ThemeIcon>
                <Stack gap={2}>
                  <Text c="var(--palette-blush)" fw={800} tt="uppercase" size="xs">
                    Próximo capítulo
                  </Text>
                  <Title order={2} size="h3">
                    {nextItem.title}
                  </Title>
                  <Text c="dimmed" size="sm">
                    {formatDate(nextItem.eventDate)}
                  </Text>
                </Stack>
              </Group>
              <Stack className="calendar-countdown" gap={0} align="flex-end">
                <Text className="calendar-countdown-number" fw={900}>
                  {getDaysUntil(nextItem.eventDate)}
                </Text>
                <Text c="dimmed" size="xs" tt="uppercase" fw={800}>
                  {getDaysUntil(nextItem.eventDate) === 1 ? 'dia restante' : 'dias restantes'}
                </Text>
              </Stack>
            </Group>
          </Card>
        ) : (
          <Card className="calendar-next-card glass-panel" radius={8} p="xl" withBorder>
            <Group gap="md">
              <ThemeIcon size={44} radius="xl" color="pink" variant="light">
                <Sparkles size={21} />
              </ThemeIcon>
              <div>
                <Text fw={800}>O próximo capítulo começa com vocês.</Text>
                <Text c="dimmed" size="sm">
                  {data.canEdit ? 'Adicione uma viagem, reserva ou data especial para criar a próxima contagem regressiva.' : 'Quando houver uma data futura, ela aparecerá aqui.'}
                </Text>
              </div>
            </Group>
          </Card>
        )}

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" style={{ alignItems: 'start' }}>
          <Card className="calendar-panel glass-panel" radius={8} p={{ base: 'sm', sm: 'md' }} withBorder>
            <Calendar
              className="calendar-widget"
              date={calendarDate}
              locale="pt-br"
              defaultLevel="month"
              minLevel="month"
              fullWidth
              highlightToday
              nextLabel="Próximo mês"
              previousLabel="Mês anterior"
              ariaLabels={{ nextMonth: 'Próximo mês', previousMonth: 'Mês anterior' }}
              onNextMonth={setCalendarDate}
              onPreviousMonth={setCalendarDate}
              onNextYear={setCalendarDate}
              onPreviousYear={setCalendarDate}
              getDayProps={(date) => ({
                selected: date === selectedDate,
                onClick: () => {
                  setSelectedDate(date)

                  if (date.slice(0, 7) !== calendarDate.slice(0, 7)) {
                    setCalendarDate(date)
                  }
                },
              })}
              getDayAriaLabel={(date) => {
                const count = itemsByDate.get(date)?.length ?? 0
                return `${formatDate(date)}${count > 0 ? `, ${count} ${count === 1 ? 'item' : 'itens'}` : ''}`
              }}
              renderDay={(date) => (
                <span className="calendar-day-content">
                  {Number(date.slice(-2))}
                  {itemsByDate.has(date) ? <span className="calendar-day-dot" aria-hidden="true" /> : null}
                </span>
              )}
            />
            <Divider my="md" />
            <Group justify="space-between" px="xs" pb="xs">
              <Text size="xs" c="dimmed">
                {displayItems.filter((item) => item.eventDate.startsWith(`${displayYear}-`)).length} registros em {displayYear}
              </Text>
              <Text size="xs" c="var(--palette-blush)">
                Pontos indicam momentos marcados
              </Text>
            </Group>
          </Card>

          <Stack gap="md">
            <Group justify="space-between" align="center">
              <div>
                <Text c="var(--palette-blush)" fw={800} tt="uppercase" size="xs">
                  Agenda do dia
                </Text>
                <Title order={2} size="h3" mt={3}>
                  {formatDate(selectedDate)}
                </Title>
              </div>
              {data.canEdit ? (
                <Button variant="light" color="pink" size="sm" leftSection={<Plus size={15} />} onClick={() => openCreate(selectedDate)}>
                  Adicionar
                </Button>
              ) : null}
            </Group>

            {selectedItems.length > 0 ? (
              <Stack gap="sm">
                {selectedItems.map((item) => (
                  <CalendarItemCard key={`${item.id}-${item.eventDate}`} item={item} onEdit={openEdit} onDelete={confirmDelete} />
                ))}
              </Stack>
            ) : (
              <Card className="calendar-empty-card" radius={8} p="xl" withBorder>
                <Stack align="center" gap="sm" ta="center">
                  <ThemeIcon size={44} radius="xl" color="pink" variant="light">
                    <CalendarDays size={21} />
                  </ThemeIcon>
                  <Text fw={800}>Nada marcado para este dia</Text>
                  <Text c="dimmed" size="sm" maw={300}>
                    Use esta agenda para combinar o próximo passeio ou guardar uma data importante.
                  </Text>
                  {data.canEdit ? (
                    <Button variant="subtle" color="pink" onClick={() => openCreate(selectedDate)}>
                      Adicionar uma data
                    </Button>
                  ) : null}
                </Stack>
              </Card>
            )}
          </Stack>
        </SimpleGrid>

        <Stack gap="md">
          <div>
            <Text c="var(--palette-blush)" fw={800} tt="uppercase" size="xs">
              Próximas datas
            </Text>
            <Title order={2} size="h3" mt={3}>
              Não deixem passar
            </Title>
          </div>
          {upcomingItems.length > 0 ? (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {upcomingItems.map((item) => (
                <Card key={`${item.id}-${item.eventDate}`} className="calendar-upcoming-card" radius={8} p="md" withBorder>
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap={4}>
                      <Text size="xs" c="var(--palette-blush)" fw={800} tt="uppercase">
                        {formatShortDate(item.eventDate)}
                      </Text>
                      <Text fw={800} lineClamp={2}>
                        {item.title}
                      </Text>
                    </Stack>
                    <Badge color="pink" variant="light">
                      {getDaysUntil(item.eventDate) === 0 ? 'Hoje' : `Em ${getDaysUntil(item.eventDate)}d`}
                    </Badge>
                  </Group>
                </Card>
              ))}
            </SimpleGrid>
          ) : (
            <Text c="dimmed">Nenhuma data futura cadastrada ainda.</Text>
          )}
        </Stack>
      </Stack>

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingEntry ? 'Editar data' : 'Adicionar data'}
        centered
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label="Título"
              placeholder="Jantar de aniversário"
              required
              name="calendar-title"
              autoComplete="off"
              {...form.getInputProps('title')}
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <DateInput
                label="Data"
                placeholder="Escolha uma data"
                valueFormat="DD/MM/YYYY"
                locale="pt-br"
                required
                value={form.values.eventDate}
                onChange={(value) => form.setFieldValue('eventDate', value ?? '')}
                error={form.errors.eventDate}
              />
              <TextInput
                label="Horário"
                type="time"
                name="calendar-time"
                value={form.values.eventTime}
                onChange={(event) => form.setFieldValue('eventTime', event.currentTarget.value)}
                error={form.errors.eventTime}
              />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select
                label="Tipo de data"
                data={calendarEntryCategories}
                value={form.values.category}
                onChange={(value) => form.setFieldValue('category', (value ?? 'other') as CalendarEntryCategory)}
                allowDeselect={false}
              />
              <Select
                label="Lembrete"
                data={reminderOptions}
                value={form.values.reminderDaysBefore}
                onChange={(value) => form.setFieldValue('reminderDaysBefore', value ?? '0')}
                allowDeselect={false}
                leftSection={<Bell size={15} />}
              />
            </SimpleGrid>
            <Select
              label="Repetição"
              data={[{ value: 'none', label: 'Não repetir' }, { value: 'yearly', label: 'Todos os anos' }]}
              value={form.values.recurrence}
              onChange={(value) => form.setFieldValue('recurrence', value === 'yearly' ? 'yearly' : 'none')}
              allowDeselect={false}
            />
            <TextInput
              label="Local"
              placeholder="Restaurante, cidade ou endereço"
              name="calendar-location"
              autoComplete="off"
              leftSection={<MapPin size={15} />}
              {...form.getInputProps('locationName')}
            />
            <Textarea
              label="Detalhes"
              placeholder="Anote reservas, planos e tudo que vocês precisam lembrar…"
              autosize
              minRows={3}
              maxRows={8}
              {...form.getInputProps('description')}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="subtle" color="gray" onClick={() => setModalOpened(false)}>
                Cancelar
              </Button>
              <Button type="submit" color="pink" loading={saving} leftSection={<CalendarDays size={16} />}>
                {editingEntry ? 'Salvar alterações' : 'Adicionar ao calendário'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  )
}
