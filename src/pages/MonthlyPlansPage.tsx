import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Modal,
  MultiSelect,
  NumberInput,
  Paper,
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
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Compass,
  Heart,
  Lightbulb,
  MapPin,
  Navigation,
  Pencil,
  Plus,
  RotateCw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/auth-context'
import { CityAutocomplete } from '../components/ui/city-autocomplete'
import { Map, MapMarker, MarkerContent, MarkerLabel, MarkerTooltip, useMap } from '../components/ui/mapcn-marker-content'
import {
  addMonthlyPlanToCalendar,
  buildMonthlyPlanFromSuggestion,
  completeMonthlyPlan,
  createMonthlyPlan,
  deleteMonthlyPlan,
  toMonthlyPlanFormValues,
  updateMonthlyPlan,
  updateMonthlyPlanStatus,
} from '../lib/plans/actions'
import { fetchCitySuggestions, fetchPlaceSuggestions } from '../lib/plans/api'
import { pickInternalCoupleIdea } from '../lib/plans/ideaDeck'
import { fetchMonthlyPlansPage, formatMonthLabel, getMonthStartIso, getNextMonthStart, getPreviousMonthStart } from '../lib/plans/queries'
import { useCurrentLocation } from '../lib/plans/useCurrentLocation'
import { rankPlaceSuggestions } from '../lib/plans/ranking'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { firestore } from '../lib/firebase/client'
import { getUserTimelineTree } from '../lib/timeline/queries'
import { getErrorMessage } from '../lib/utils'
import type { CoupleMonthlyPlan, MonthlyPlanCategory, MonthlyPlanSource, MonthlyPlanStatus } from '../types/database'
import { monthlyPlanCategories, monthlyPlanStatuses, type CitySuggestion, type MonthlyPlanFormValues, type PlaceSuggestion, type SuggestionsResponse } from '../types/plans'

const initialFormValues: MonthlyPlanFormValues = {
  title: '',
  description: '',
  category: 'Atividade',
  status: 'idea',
  scheduledDate: '',
  locationName: '',
}

const discoveryCategoryValues = monthlyPlanCategories.map((category) => category.value)

const statusColors: Record<MonthlyPlanStatus, string> = {
  idea: 'yellow',
  planned: 'pink',
  completed: 'green',
}

function formatPlanDate(value: string | null) {
  if (!value) return 'Sem data definida'

  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
  })
}

function sourceLabel(source: MonthlyPlanSource) {
  if (source === 'openstreetmap') return 'Lugar encontrado perto de vocês'
  if (source === 'internal') return 'Ideia do Moments'
  return 'Adicionado pelo casal'
}

function weatherLabel(weatherCode: number | null) {
  if (weatherCode === null) return 'Clima indisponível'
  if (weatherCode === 0) return 'Céu limpo'
  if (weatherCode <= 3) return 'Poucas nuvens'
  if (weatherCode <= 48) return 'Neblina'
  if (weatherCode <= 67) return 'Possibilidade de chuva'
  if (weatherCode <= 82) return 'Pancadas de chuva'
  return 'Condições instáveis'
}

function MapBoundsToItems({ items }: { items: MapPlanItem[] }) {
  const { map, isLoaded } = useMap()
  const previousSignature = useRef('')

  useEffect(() => {
    if (!map || !isLoaded || items.length === 0) return
    const signature = items.map((item) => `${item.id}:${item.longitude}:${item.latitude}`).join('|')
    if (signature === previousSignature.current) return
    previousSignature.current = signature

    if (items.length === 1) {
      map.easeTo({ center: [items[0].longitude, items[0].latitude], zoom: Math.max(map.getZoom(), 13), duration: 350 })
      return
    }

    const longitudes = items.map((item) => item.longitude)
    const latitudes = items.map((item) => item.latitude)
    map.fitBounds(
      [
        [Math.min(...longitudes), Math.min(...latitudes)],
        [Math.max(...longitudes), Math.max(...latitudes)],
      ],
      { padding: 44, maxZoom: 14, duration: 450 },
    )
  }, [isLoaded, items, map])

  return null
}

type MapPlanItem = {
  id: string
  name: string
  category: MonthlyPlanCategory
  latitude: number
  longitude: number
  address: string | null
  googleMapsUrl: string | null
  sourceUrl: string | null
  sourceLabel: string
  isSaved: boolean
}

function PlanMap({ items, fallbackCenter, activeId, onSelect }: { items: MapPlanItem[]; fallbackCenter: [number, number]; activeId?: string | null; onSelect?: (id: string) => void }) {
  const center: [number, number] = items[0]
    ? [items[0].longitude, items[0].latitude]
    : fallbackCenter

  return (
    <div className="monthly-plans-map-shell">
      <Map center={center} zoom={12} className="monthly-plans-map">
        <MapBoundsToItems items={items} />
        {items.map((item) => (
          <MapMarker key={item.id} longitude={item.longitude} latitude={item.latitude} ariaLabel={`Abrir detalhes de ${item.name}`} onClick={() => onSelect?.(item.id)}>
            <MarkerContent className={`${item.isSaved ? 'monthly-map-marker monthly-map-marker-saved' : 'monthly-map-marker'}${activeId === item.id ? ' monthly-map-marker-active' : ''}`}>
              <span aria-hidden="true">{item.isSaved ? '♥' : '•'}</span>
              <MarkerLabel position="top">{item.name}</MarkerLabel>
            </MarkerContent>
            <MarkerTooltip>
              <div className="monthly-map-popup">
                <Text fw={800} size="sm">
                  {item.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {item.category} · {item.sourceLabel}
                </Text>
                {item.address ? <Text size="xs" mt={5}>{item.address}</Text> : null}
                {item.googleMapsUrl ? (
                  <Button component="a" href={item.googleMapsUrl} target="_blank" rel="noreferrer" size="compact-xs" color="pink" mt="sm" fullWidth>
                    Abrir no Google Maps
                  </Button>
                ) : null}
                {item.sourceUrl ? (
                  <Button component="a" href={item.sourceUrl} target="_blank" rel="noreferrer" variant="subtle" size="compact-xs" color="gray" mt={4} fullWidth>
                    Ver fonte OpenStreetMap
                  </Button>
                ) : null}
              </div>
            </MarkerTooltip>
          </MapMarker>
        ))}
      </Map>
      <Text className="monthly-map-attribution" size="xs">
        © OpenStreetMap contributors · tiles Carto
      </Text>
    </div>
  )
}

function MonthlyPlanCard({
  plan,
  currentUserId,
  onEdit,
  onDelete,
  onPlan,
  onComplete,
  onCalendar,
}: {
  plan: CoupleMonthlyPlan
  currentUserId: string | undefined
  onEdit: (plan: CoupleMonthlyPlan) => void
  onDelete: (plan: CoupleMonthlyPlan) => void
  onPlan: (plan: CoupleMonthlyPlan) => void
  onComplete: (plan: CoupleMonthlyPlan) => void
  onCalendar: (plan: CoupleMonthlyPlan) => void
}) {
  return (
    <Card className="monthly-plan-card glass-panel" radius={8} p="lg" withBorder>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
          <ThemeIcon color={plan.status === 'completed' ? 'green' : 'pink'} variant="light" size={42} radius="xl">
            {plan.status === 'completed' ? <CheckCircle2 size={20} /> : <Heart size={20} />}
          </ThemeIcon>
          <Group gap={6} justify="flex-end" wrap="wrap">
            <Badge color="pink" variant="light">{plan.category}</Badge>
            <Badge color={statusColors[plan.status]} variant="light">{monthlyPlanStatuses.find((status) => status.value === plan.status)?.label}</Badge>
          </Group>
        </Group>

        <div>
          <Title order={3} size="h3">{plan.title}</Title>
          {plan.description ? <Text c="dimmed" size="sm" mt={6} lineClamp={3}>{plan.description}</Text> : null}
        </div>

        <Stack gap={7} className="monthly-plan-details">
          <Group gap={7} wrap="nowrap">
            <CalendarDays size={15} aria-hidden="true" />
            <Text size="sm">{formatPlanDate(plan.scheduled_date)}</Text>
          </Group>
          {plan.location_name ? (
            <Group gap={7} wrap="nowrap">
              <MapPin size={15} aria-hidden="true" />
              <Text size="sm" lineClamp={1}>{plan.location_name}</Text>
            </Group>
          ) : null}
          <Text size="xs" c="dimmed">
            {plan.created_by === currentUserId ? 'Você' : 'Seu par'} · {sourceLabel(plan.source)}
          </Text>
        </Stack>

        <Group gap="xs" wrap="wrap">
          <Button variant="subtle" color="gray" size="xs" leftSection={<Pencil size={14} />} onClick={() => onEdit(plan)}>
            Editar
          </Button>
          <Button variant="subtle" color="red" size="xs" leftSection={<Trash2 size={14} />} onClick={() => onDelete(plan)}>
            Excluir
          </Button>
          {plan.google_maps_url ? (
            <Button component="a" href={plan.google_maps_url} target="_blank" rel="noreferrer" variant="subtle" color="pink" size="xs" leftSection={<Navigation size={14} />}>
              Maps
            </Button>
          ) : null}
        </Group>

        {plan.status === 'idea' ? (
          <Button color="pink" variant="light" fullWidth leftSection={<CalendarDays size={16} />} onClick={() => onPlan(plan)}>
            Planejar este mês
          </Button>
        ) : plan.status === 'planned' ? (
          <Button color="green" variant="light" fullWidth leftSection={<Check size={16} />} onClick={() => onComplete(plan)}>
            Marcar como realizado
          </Button>
        ) : (
          <Group justify="space-between" align="center">
            <Text size="sm" c="green">Vivido por vocês</Text>
            {plan.completed_event_id ? <Button component={Link} to={`/timeline/${plan.couple_id}`} variant="subtle" color="green" size="xs">Ver na timeline</Button> : null}
          </Group>
        )}

        {plan.status !== 'completed' ? (
          <Button variant="subtle" color={plan.calendar_entry_id ? 'green' : 'gray'} size="xs" disabled={!plan.scheduled_date || Boolean(plan.calendar_entry_id)} leftSection={<CalendarDays size={14} />} onClick={() => onCalendar(plan)}>
            {plan.calendar_entry_id ? 'Já está no Calendário' : plan.scheduled_date ? 'Adicionar ao Calendário' : 'Defina uma data para o Calendário'}
          </Button>
        ) : null}
      </Stack>
    </Card>
  )
}

export function MonthlyPlansPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [coupleId, setCoupleId] = useState<string | null>(null)
  const [plans, setPlans] = useState<CoupleMonthlyPlan[]>([])
  const [selectedMonth, setSelectedMonth] = useState(getMonthStartIso())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formOpened, setFormOpened] = useState(false)
  const [editingPlan, setEditingPlan] = useState<CoupleMonthlyPlan | null>(null)
  const [formSource, setFormSource] = useState<MonthlyPlanSource>('manual')
  const [deletingPlan, setDeletingPlan] = useState<CoupleMonthlyPlan | null>(null)
  const [completionPlan, setCompletionPlan] = useState<CoupleMonthlyPlan | null>(null)
  const [completionLoading, setCompletionLoading] = useState(false)
  const [discoverOpened, setDiscoverOpened] = useState(false)
  const [discoverCity, setDiscoverCity] = useState('')
  const [discoverRadius, setDiscoverRadius] = useState(5)
  const [discoverCategories, setDiscoverCategories] = useState<MonthlyPlanCategory[]>(discoveryCategoryValues)
  const [discoverResult, setDiscoverResult] = useState<SuggestionsResponse | null>(null)
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [discoverError, setDiscoverError] = useState<string | null>(null)
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([])
  const [citySuggestionsLoading, setCitySuggestionsLoading] = useState(false)
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>(null)
  const [activeMapId, setActiveMapId] = useState<string | null>(null)
  const discoverAbortRef = useRef<AbortController | null>(null)
  const citySuggestAbortRef = useRef<AbortController | null>(null)
  const location = useCurrentLocation()
  const form = useForm<MonthlyPlanFormValues>({
    initialValues: initialFormValues,
    validate: {
      title: (value) => (value.trim().length >= 2 ? null : 'Informe um título com pelo menos 2 caracteres.'),
      scheduledDate: (value) => {
        if (!value) return null
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Informe uma data válida.'
        return value.slice(0, 7) === selectedMonth.slice(0, 7) ? null : 'A data deve pertencer ao mês selecionado.'
      },
    },
  })

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true)
    setError(null)

    try {
      const tree = await getUserTimelineTree()
      if (!tree) throw new Error('Crie uma timeline ou vincule seu par antes de planejar o mês.')

      const pageData = await fetchMonthlyPlansPage(tree.root.id, selectedMonth)
      setCoupleId(tree.root.id)
      setPlans(pageData.plans)
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Não foi possível carregar os planos deste mês.'))
    } finally {
      if (showLoader) setLoading(false)
    }
  }, [selectedMonth])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    if (!coupleId) return

    return onSnapshot(query(collection(firestore, 'couple_monthly_plans'), where('couple_id', '==', coupleId)), () => void load(false))
  }, [coupleId, load])

  useEffect(() => {
    const query = discoverCity.trim()
    const timer = window.setTimeout(() => {
      if (!discoverOpened || !coupleId || query.length < 2 || selectedCity?.label === query) {
        citySuggestAbortRef.current?.abort()
        setCitySuggestions([])
        setCitySuggestionsLoading(false)
        return
      }

      citySuggestAbortRef.current?.abort()
      const controller = new AbortController()
      citySuggestAbortRef.current = controller
      setCitySuggestionsLoading(true)

      void fetchCitySuggestions({ coupleId, query, signal: controller.signal })
        .then((suggestions) => {
          if (!controller.signal.aborted) setCitySuggestions(suggestions)
        })
        .catch((suggestionError) => {
          if (!(suggestionError instanceof DOMException && suggestionError.name === 'AbortError')) {
            setCitySuggestions([])
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setCitySuggestionsLoading(false)
        })
    }, query.length >= 2 ? 300 : 0)

    return () => {
      window.clearTimeout(timer)
      citySuggestAbortRef.current?.abort()
    }
  }, [coupleId, discoverCity, discoverOpened, selectedCity])

  const statusCounts = useMemo(
    () => ({
      idea: plans.filter((plan) => plan.status === 'idea').length,
      planned: plans.filter((plan) => plan.status === 'planned').length,
      completed: plans.filter((plan) => plan.status === 'completed').length,
    }),
    [plans],
  )

  const mapItems = useMemo<MapPlanItem[]>(() => {
    const externalItems: MapPlanItem[] = (discoverResult?.places ?? []).map((place) => ({
      id: `suggestion:${place.id}`,
      name: place.name,
      category: place.category,
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.address,
      googleMapsUrl: place.googleMapsUrl,
      sourceUrl: place.sourceUrl,
      sourceLabel: 'Sugestão OpenStreetMap',
      isSaved: false,
    }))
    const savedItems: MapPlanItem[] = plans
      .filter((plan) => plan.latitude !== null && plan.longitude !== null)
      .map((plan) => ({
        id: `plan:${plan.id}`,
        name: plan.location_name || plan.title,
        category: plan.category,
        latitude: plan.latitude as number,
        longitude: plan.longitude as number,
        address: plan.address,
        googleMapsUrl: plan.google_maps_url,
        sourceUrl: plan.source_url,
        sourceLabel: sourceLabel(plan.source),
        isSaved: true,
      }))

    return [...savedItems, ...externalItems]
  }, [discoverResult, plans])

  const mapCenter: [number, number] = discoverResult
    ? [discoverResult.location.longitude, discoverResult.location.latitude]
    : mapItems[0]
      ? [mapItems[0].longitude, mapItems[0].latitude]
      : [-46.6333, -23.5505]

  function openCreateForm(values: Partial<MonthlyPlanFormValues> = {}, source: MonthlyPlanSource = 'manual') {
    setEditingPlan(null)
    setFormSource(source)
    form.setValues({ ...initialFormValues, ...values, status: 'idea' })
    form.clearErrors()
    setFormOpened(true)
  }

  function openEditForm(plan: CoupleMonthlyPlan) {
    setEditingPlan(plan)
    setFormSource(plan.source)
    form.setValues(toMonthlyPlanFormValues(plan))
    form.clearErrors()
    setFormOpened(true)
  }

  async function handleSave(values: MonthlyPlanFormValues) {
    if (!coupleId) return
    setSaving(true)

    try {
      const metadata = editingPlan
        ? {
            source: editingPlan.source,
            address: editingPlan.address,
            latitude: editingPlan.latitude,
            longitude: editingPlan.longitude,
            sourcePlaceId: editingPlan.source_place_id,
            googleMapsUrl: editingPlan.google_maps_url,
            sourceUrl: editingPlan.source_url,
          }
        : { source: formSource }
      const input = { coupleId, monthStart: selectedMonth, ...values, ...metadata }

      if (editingPlan) await updateMonthlyPlan(editingPlan.id, input)
      else await createMonthlyPlan(input)

      notifications.show({ color: 'green', title: editingPlan ? 'Plano atualizado' : 'Plano adicionado', message: 'A mudança já está compartilhada com seu par.' })
      setFormOpened(false)
      await load(false)
    } catch (saveError) {
      notifications.show({ color: 'red', title: 'Não foi possível salvar', message: getErrorMessage(saveError) })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deletingPlan || !coupleId) return
    setSaving(true)
    try {
      await deleteMonthlyPlan(deletingPlan.id, coupleId)
      setDeletingPlan(null)
      notifications.show({ color: 'green', title: 'Plano removido', message: 'Ele não aparece mais para o casal.' })
      await load(false)
    } catch (deleteError) {
      notifications.show({ color: 'red', title: 'Não foi possível excluir', message: getErrorMessage(deleteError) })
    } finally {
      setSaving(false)
    }
  }

  async function handlePlan(plan: CoupleMonthlyPlan) {
    if (!coupleId) return
    try {
      await updateMonthlyPlanStatus(plan.id, coupleId, 'planned')
      notifications.show({ color: 'pink', title: 'Plano reservado para este mês', message: 'Agora falta só escolher o melhor momento.' })
      await load(false)
    } catch (planError) {
      notifications.show({ color: 'red', title: 'Não foi possível planejar', message: getErrorMessage(planError) })
    }
  }

  async function handleCalendar(plan: CoupleMonthlyPlan) {
    if (plan.calendar_entry_id) return
    try {
      await addMonthlyPlanToCalendar(plan.id)
      notifications.show({ color: 'green', title: 'Adicionado ao Calendário', message: 'A data agora também aparece na agenda do casal.' })
      await load(false)
    } catch (calendarError) {
      notifications.show({ color: 'red', title: 'Não foi possível adicionar ao Calendário', message: getErrorMessage(calendarError) })
    }
  }

  async function handleComplete(createMemory: boolean) {
    if (!completionPlan) return
    setCompletionLoading(true)
    try {
      const eventId = await completeMonthlyPlan(completionPlan.id, createMemory)
      setCompletionPlan(null)
      await load(false)
      if (createMemory && eventId) {
        notifications.show({ color: 'green', title: 'Plano virou memória', message: 'Agora vocês podem adicionar fotos e detalhes.' })
        navigate(`/timeline/${completionPlan.couple_id}/eventos/${eventId}/editar`)
      } else {
        notifications.show({ color: 'green', title: 'Plano marcado como realizado', message: 'Mais uma história vivida por vocês.' })
      }
    } catch (completeError) {
      notifications.show({ color: 'red', title: 'Não foi possível concluir', message: getErrorMessage(completeError) })
    } finally {
      setCompletionLoading(false)
    }
  }

  async function handleSuggestionSearch(overrides: { city?: string; coordinates?: { latitude: number; longitude: number } } = {}) {
    if (!coupleId) return
    const cityMatchesSelection = selectedCity?.label === discoverCity.trim()
    const city = overrides.city !== undefined
      ? overrides.city.trim()
      : cityMatchesSelection
        ? selectedCity.label
        : discoverCity.trim()
    const coordinates = overrides.coordinates ?? (cityMatchesSelection ? {
      latitude: selectedCity.latitude,
      longitude: selectedCity.longitude,
    } : location.coordinates)

    if (!city && !coordinates) {
      setDiscoverError('Informe uma cidade ou permita usar sua localização.')
      return
    }

    discoverAbortRef.current?.abort()
    const controller = new AbortController()
    discoverAbortRef.current = controller
    setDiscoverLoading(true)
    setDiscoverError(null)

    try {
      const result = await fetchPlaceSuggestions({
        coupleId,
        city: city || undefined,
        latitude: coordinates?.latitude,
        longitude: coordinates?.longitude,
        radiusKm: discoverRadius,
        categories: discoverCategories,
        signal: controller.signal,
      })
      setDiscoverResult(result)
      setActiveMapId(result.places[0] ? `suggestion:${result.places[0].id}` : null)
    } catch (searchError) {
      if (!(searchError instanceof DOMException && searchError.name === 'AbortError')) {
        setDiscoverError(getErrorMessage(searchError, 'Não foi possível buscar lugares agora.'))
      }
    } finally {
      if (!controller.signal.aborted) setDiscoverLoading(false)
    }
  }

  async function handleUseLocation() {
    const coordinates = await location.requestLocation()
    if (!coordinates) return

    setDiscoverCity('')
    setSelectedCity(null)
    setCitySuggestions([])
    await handleSuggestionSearch({ city: '', coordinates })
  }

  async function handleSaveSuggestion(place: PlaceSuggestion) {
    if (!coupleId) return
    try {
      await createMonthlyPlan(buildMonthlyPlanFromSuggestion(coupleId, selectedMonth, place))
      notifications.show({ color: 'green', title: 'Lugar salvo nos planos', message: 'Seu par já poderá vê-lo na lista deste mês.' })
      await load(false)
    } catch (saveError) {
      const message = getErrorMessage(saveError)
      notifications.show({ color: message.toLowerCase().includes('duplicate') ? 'yellow' : 'red', title: 'Lugar já salvo ou indisponível', message })
      await load(false)
    }
  }

  function openDiscovery() {
    setDiscoverOpened(true)
    setDiscoverError(null)
  }

  if (loading && plans.length === 0) {
    return <Container size="lg" py={96}><Group justify="center"><Loader color="pink" /></Group></Container>
  }

  if (error && plans.length === 0) {
    return (
      <Container size="lg" py="xl">
        <Alert color="red" radius={8} title="Planos do mês indisponíveis">{error}</Alert>
        <Group mt="md">
          <Button component={Link} to="/dashboard" variant="light" color="pink">Voltar para árvores</Button>
          <Button color="pink" onClick={() => void load()}>Tentar novamente</Button>
        </Group>
      </Container>
    )
  }

  return (
    <Container size="xl" py={{ base: 'lg', sm: 'xl' }} className="monthly-plans-page">
      <Stack gap="xl">
        <Paper className="monthly-plans-hero glass-panel" radius={8} p={{ base: 'lg', sm: 'xl' }} withBorder>
          <Group justify="space-between" align="flex-end" gap="xl">
            <Stack gap="sm" maw={650}>
              <Text className="monthly-plans-eyebrow" fw={800} tt="uppercase" size="xs">Pequenos planos, grandes histórias</Text>
              <Title order={1}>O que vamos viver em {formatMonthLabel(selectedMonth)}?</Title>
              <Text c="dimmed" size="lg">Uma lista compartilhada para sair do “qualquer dia” e escolher o próximo programa de vocês.</Text>
            </Stack>
            <Group gap="xs" wrap="wrap">
              <Button variant="light" color="pink" leftSection={<Lightbulb size={16} />} onClick={() => openCreateForm()}>Adicionar ideia</Button>
              <Button color="pink" leftSection={<Compass size={16} />} onClick={openDiscovery}>Encontrar lugares</Button>
            </Group>
          </Group>
          <div className="monthly-plans-orbit" aria-hidden="true"><span /><span /><span /></div>
        </Paper>

        <Group justify="space-between" align="center" gap="md" className="monthly-plans-month-nav">
          <ActionIcon variant="light" color="pink" size="lg" aria-label="Mês anterior" onClick={() => setSelectedMonth(getPreviousMonthStart(selectedMonth))}><ArrowLeft size={17} /></ActionIcon>
          <Stack gap={0} align="center">
            <Text size="xs" c="dimmed" tt="uppercase" fw={800}>Planejamento compartilhado</Text>
            <Title order={2} size="h3">{formatMonthLabel(selectedMonth)}</Title>
          </Stack>
          <ActionIcon variant="light" color="pink" size="lg" aria-label="Próximo mês" onClick={() => setSelectedMonth(getNextMonthStart(selectedMonth))}><ArrowRight size={17} /></ActionIcon>
        </Group>

        {error ? <Alert color="yellow" radius={8} title="A lista pode estar desatualizada">{error}</Alert> : null}

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          {monthlyPlanStatuses.map((status) => (
            <Card key={status.value} className="monthly-summary-card glass-panel" radius={8} p="md" withBorder>
              <Group gap="sm">
                <ThemeIcon color={statusColors[status.value]} variant="light" radius="xl">{status.value === 'idea' ? <Lightbulb size={17} /> : status.value === 'planned' ? <CalendarDays size={17} /> : <Check size={17} />}</ThemeIcon>
                <div><Text size="xs" c="dimmed" tt="uppercase" fw={700}>{status.label}</Text><Text size="xl" fw={800} lh={1.1}>{statusCounts[status.value]}</Text></div>
              </Group>
            </Card>
          ))}
        </SimpleGrid>

        <Group justify="space-between" align="center" gap="md">
          <div><Text className="monthly-plans-section-label" fw={800} tt="uppercase" size="xs">A lista de vocês</Text><Title order={2} size="h3" mt={3}>Escolham o próximo capítulo</Title></div>
          <Button variant="subtle" color="pink" leftSection={<Sparkles size={16} />} onClick={() => {
            const idea = pickInternalCoupleIdea(plans.map((plan) => plan.title))
            openCreateForm({ title: idea.title, description: idea.description, category: idea.category }, 'internal')
          }}>Sortear uma ideia</Button>
        </Group>

        {plans.length === 0 ? (
          <Card className="monthly-plans-empty glass-panel" radius={8} p={{ base: 'xl', sm: 56 }} withBorder>
            <Stack align="center" gap="sm" ta="center">
              <ThemeIcon color="pink" variant="light" size={56} radius="xl"><Heart size={25} /></ThemeIcon>
              <Title order={2} size="h3">Este mês ainda está em branco</Title>
              <Text c="dimmed" maw={470}>Adicionem uma ideia, sorteiem um programa ou encontrem lugares reais perto de vocês.</Text>
              <Group justify="center" gap="xs"><Button color="pink" leftSection={<Plus size={16} />} onClick={() => openCreateForm()}>Adicionar primeira ideia</Button><Button variant="light" color="pink" leftSection={<Compass size={16} />} onClick={openDiscovery}>Encontrar lugares</Button></Group>
            </Stack>
          </Card>
        ) : (
          <div className="monthly-plans-layout">
            <Stack gap="xl">
              {monthlyPlanStatuses.map((status) => {
                const groupPlans = plans.filter((plan) => plan.status === status.value)
                if (groupPlans.length === 0) return null
                return <Stack key={status.value} gap="sm"><Group gap="xs"><Text fw={800}>{status.label}</Text><Badge color={statusColors[status.value]} variant="light">{groupPlans.length}</Badge></Group><SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">{groupPlans.map((plan) => <MonthlyPlanCard key={plan.id} plan={plan} currentUserId={user?.id} onEdit={openEditForm} onDelete={setDeletingPlan} onPlan={handlePlan} onComplete={setCompletionPlan} onCalendar={handleCalendar} />)}</SimpleGrid></Stack>
              })}
            </Stack>
            <Card className="monthly-plans-map-card glass-panel" radius={8} p="sm" withBorder>
              <Group justify="space-between" px="xs" pb="sm"><div><Text className="monthly-plans-section-label" fw={800} tt="uppercase" size="xs">Mapa dos lugares</Text><Text size="sm" c="dimmed">Sugestões salvas e lugares que vocês já escolheram.</Text></div><Button variant="light" color="pink" size="xs" leftSection={<Compass size={14} />} onClick={openDiscovery}>Descobrir</Button></Group>
              {mapItems.length > 0 ? <PlanMap items={mapItems} activeId={activeMapId} onSelect={setActiveMapId} fallbackCenter={mapCenter} /> : <div className="monthly-map-empty"><MapPin size={22} /><Text size="sm" ta="center">Quando um lugar tiver coordenadas, ele aparece aqui.</Text></div>}
            </Card>
          </div>
        )}
      </Stack>

      <Modal opened={formOpened} onClose={() => setFormOpened(false)} title={editingPlan ? 'Editar plano do mês' : 'Adicionar ideia para vocês'} centered size="lg">
        <form onSubmit={form.onSubmit(handleSave)}>
          <Stack gap="md">
            <TextInput label="O que vocês querem fazer?" placeholder="Ir ao zoológico" required {...form.getInputProps('title')} />
            <Group grow align="flex-start"><Select label="Categoria" data={monthlyPlanCategories} allowDeselect={false} {...form.getInputProps('category')} /><TextInput label="Data do mês" type="date" {...form.getInputProps('scheduledDate')} /></Group>
            <TextInput label="Local" placeholder="Parque, restaurante ou endereço" leftSection={<MapPin size={15} />} {...form.getInputProps('locationName')} />
            <Textarea label="Detalhes" placeholder="Anote horários, preferências ou uma combinação para vocês…" minRows={4} autosize {...form.getInputProps('description')} />
            <Text size="xs" c="dimmed">O plano ficará visível para os dois e começará como uma ideia. A data pode ser escolhida depois.</Text>
            <Group justify="flex-end" mt="sm"><Button variant="subtle" color="gray" onClick={() => setFormOpened(false)}>Cancelar</Button><Button type="submit" color="pink" loading={saving}>{editingPlan ? 'Salvar alterações' : 'Salvar ideia'}</Button></Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={Boolean(deletingPlan)} onClose={() => setDeletingPlan(null)} title="Excluir plano" centered>
        <Stack gap="md"><Text>Excluir <strong>{deletingPlan?.title}</strong>? Essa ação não pode ser desfeita.</Text><Group justify="flex-end"><Button variant="subtle" color="gray" onClick={() => setDeletingPlan(null)}>Cancelar</Button><Button color="red" loading={saving} onClick={() => void handleDelete()}>Excluir plano</Button></Group></Stack>
      </Modal>

      <Modal opened={Boolean(completionPlan)} onClose={() => setCompletionPlan(null)} title="Criar uma memória na Timeline?" centered>
        <Stack gap="md"><Text>Vocês viveram <strong>{completionPlan?.title}</strong>. Querem registrar esse momento na Timeline para adicionar fotos depois?</Text><Group justify="flex-end" wrap="wrap"><Button variant="subtle" color="gray" loading={completionLoading} onClick={() => void handleComplete(false)}>Apenas concluir</Button><Button color="pink" loading={completionLoading} leftSection={<Heart size={15} />} onClick={() => void handleComplete(true)}>Concluir e criar memória</Button></Group></Stack>
      </Modal>

      <Modal opened={discoverOpened} onClose={() => { setDiscoverOpened(false); discoverAbortRef.current?.abort(); citySuggestAbortRef.current?.abort(); setDiscoverLoading(false); setCitySuggestionsLoading(false) }} title="Encontrar um programa para vocês" centered size="xl">
        <Stack gap="md">
          <Text c="dimmed" size="sm">Busque lugares reais próximos sem salvar a localização do dispositivo. Vocês escolhem o que merece entrar no mês.</Text>
          <Group grow align="flex-start"><CityAutocomplete value={discoverCity} suggestions={citySuggestions} loading={citySuggestionsLoading} onChange={(value) => { setDiscoverCity(value); setSelectedCity(null); setDiscoverResult(null) }} onSelect={(suggestion) => { setDiscoverCity(suggestion.label); setSelectedCity(suggestion); setCitySuggestions([]); setDiscoverResult(null) }} /><NumberInput label="Raio" suffix=" km" min={1} max={15} value={discoverRadius} onChange={(value) => setDiscoverRadius(typeof value === 'number' ? value : 5)} /></Group>
          <MultiSelect label="Categorias" data={monthlyPlanCategories} value={discoverCategories} onChange={(values) => setDiscoverCategories(values as MonthlyPlanCategory[])} searchable clearable={false} />
          <Group justify="space-between" align="center" gap="xs"><Button variant="light" color="pink" leftSection={<Navigation size={15} />} loading={location.status === 'loading'} onClick={() => void handleUseLocation()}>Usar minha localização</Button><Button color="pink" leftSection={<Compass size={15} />} loading={discoverLoading} onClick={() => void handleSuggestionSearch()}>Buscar sugestões</Button></Group>
          {location.error ? <Alert color="yellow" radius={8}>{location.error}</Alert> : null}
          {discoverError ? <Alert color="red" radius={8} title="Busca indisponível">{discoverError}</Alert> : null}
          {discoverResult ? <>
            <Paper className="monthly-weather-card" p="sm" withBorder><Group justify="space-between"><div><Text size="xs" c="dimmed" tt="uppercase" fw={800}>Previsão no ponto buscado</Text><Text fw={800}>{discoverResult.location.label}</Text></div><Text size="sm" c="var(--palette-peach)">{discoverResult.weather ? `${Math.round(discoverResult.weather.temperature ?? 0)}°C · ${weatherLabel(discoverResult.weather.weatherCode)}${discoverResult.weather.precipitationProbability !== null ? ` · chuva ${discoverResult.weather.precipitationProbability}%` : ''}` : 'Clima indisponível'}</Text></Group></Paper>
            {discoverResult.warnings.map((warning) => <Alert key={warning} color="yellow" radius={8}>{warning}</Alert>)}
            <div className="monthly-discovery-layout"><Stack gap="sm" className="monthly-discovery-results"><Group justify="space-between"><Text fw={800}>{discoverResult.places.length} lugares encontrados</Text><Button variant="subtle" color="gray" size="xs" leftSection={<RotateCw size={13} />} onClick={() => void handleSuggestionSearch()}>Atualizar</Button></Group>{discoverResult.places.length > 0 ? rankPlaceSuggestions(discoverResult.places, discoverResult.weather).map((place) => <Card key={place.id} className="monthly-suggestion-card" radius={8} p="sm" withBorder data-active={activeMapId === `suggestion:${place.id}`}><Group justify="space-between" align="flex-start" wrap="nowrap"><div><Text fw={800} lineClamp={1}>{place.name}</Text><Text size="xs" c="dimmed">{place.category}{place.distanceKm !== null ? ` · ${place.distanceKm} km` : ''}</Text>{place.address ? <Text size="xs" mt={4} lineClamp={2}>{place.address}</Text> : null}</div><Stack gap="xs"><Button size="compact-xs" variant="light" color="pink" onClick={() => setActiveMapId(`suggestion:${place.id}`)}>Ver no mapa</Button><Button size="compact-xs" color="pink" onClick={() => void handleSaveSuggestion(place)}>Salvar ideia</Button></Stack></Group></Card>) : <Card className="monthly-map-empty" p="xl" withBorder><Text size="sm" ta="center" c="dimmed">Nenhum lugar mapeado nessa busca. Tente aumentar o raio ou escolher outra categoria.</Text></Card>}</Stack><div className="monthly-discovery-map">{mapItems.length > 0 ? <PlanMap items={mapItems} activeId={activeMapId} onSelect={setActiveMapId} fallbackCenter={mapCenter} /> : <div className="monthly-map-empty"><MapPin size={22} /><Text size="sm" ta="center">O mapa aparecerá quando houver resultados.</Text></div>}</div></div>
          </> : <Card className="monthly-discovery-intro" p="lg" withBorder><Stack align="center" ta="center" gap="xs"><Sparkles size={24} color="var(--palette-peach)" /><Text fw={800}>Onde vocês estão pensando em sair?</Text><Text size="sm" c="dimmed">Informe uma cidade ou use a localização apenas para esta busca.</Text></Stack></Card>}
          <Text size="xs" c="dimmed">Dados de lugares: OpenStreetMap/Overpass. Clima: Open-Meteo. Os mapas incluem atribuição às fontes.</Text>
        </Stack>
      </Modal>
    </Container>
  )
}

