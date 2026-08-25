import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Divider,
  Group,
  Image,
  Loader,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import {
  CalendarDays,
  ExternalLink,
  Gift,
  Heart,
  Pencil,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from '@mantine/form'
import { Link } from 'react-router-dom'
import {
  createGift,
  deleteGift,
  giftCategories,
  updateGift,
  updateGiftStatus,
  type GiftInput,
} from '../lib/gifts/actions'
import { getGiftPageData, type GiftPageData } from '../lib/gifts/queries'
import { formatDate, getErrorMessage } from '../lib/utils'
import type { CoupleGift, GiftPriority, GiftStatus } from '../types/database'

type GiftFormValues = {
  title: string
  description: string
  imageUrl: string
  linkUrl: string
  priceMin: number | ''
  priceMax: number | ''
  category: CoupleGift['category']
  priority: GiftPriority
  status: GiftStatus
  isSurprise: boolean
  relatedDate: string
}

const emptyFormValues: GiftFormValues = {
  title: '',
  description: '',
  imageUrl: '',
  linkUrl: '',
  priceMin: '',
  priceMax: '',
  category: 'Outro',
  priority: 'medium',
  status: 'wanted',
  isSurprise: false,
  relatedDate: '',
}

const priorityLabels: Record<GiftPriority, string> = {
  low: 'Se eu ganhar, fico feliz',
  medium: 'Seria muito bom',
  high: 'Quero muito',
}

const statusLabels: Record<GiftStatus, string> = {
  wanted: 'Na lista',
  purchased: 'Comprado',
  received: 'Recebido',
}

const statusColors: Record<GiftStatus, string> = {
  wanted: 'pink',
  purchased: 'grape',
  received: 'green',
}

function formatPriceRange(gift: CoupleGift) {
  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

  if (gift.price_min !== null && gift.price_max !== null) {
    return `${formatter.format(gift.price_min)} – ${formatter.format(gift.price_max)}`
  }

  if (gift.price_min !== null) {
    return `A partir de ${formatter.format(gift.price_min)}`
  }

  if (gift.price_max !== null) {
    return `Até ${formatter.format(gift.price_max)}`
  }

  return null
}

function toGiftInput(values: GiftFormValues, coupleId: string, recipientId: string): GiftInput {
  return {
    coupleId,
    recipientId,
    title: values.title,
    description: values.description.trim() || null,
    imageUrl: values.imageUrl.trim() || null,
    linkUrl: values.linkUrl.trim() || null,
    priceMin: values.priceMin === '' ? null : values.priceMin,
    priceMax: values.priceMax === '' ? null : values.priceMax,
    category: values.category,
    priority: values.priority,
    status: values.status,
    isSurprise: values.isSurprise,
    relatedDate: values.relatedDate || null,
  }
}

function GiftCard({
  gift,
  canEdit,
  canMarkStatus,
  isUpdating,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  gift: CoupleGift
  canEdit: boolean
  canMarkStatus: boolean
  isUpdating: boolean
  onEdit: (gift: CoupleGift) => void
  onDelete: (gift: CoupleGift) => void
  onStatusChange: (gift: CoupleGift, status: GiftStatus) => void
}) {
  const priceRange = formatPriceRange(gift)

  return (
    <Card className="gift-card glass-panel" radius={8} withBorder padding={0}>
      {gift.image_url ? (
        <Image
          src={gift.image_url}
          alt={`Imagem de ${gift.title}`}
          className="gift-card-image"
          width={640}
          height={360}
          fit="cover"
          loading="lazy"
        />
      ) : (
        <div className="gift-card-image gift-card-image-placeholder" aria-hidden="true">
          <Gift size={34} />
        </div>
      )}

      <Stack gap="sm" p="md">
        <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap">
          <Stack gap={4} className="gift-card-content">
            <Text fw={800} size="lg" className="gift-card-title">
              {gift.title}
            </Text>
            <Group gap={6} wrap="wrap">
              <Badge color={statusColors[gift.status]} variant="light">
                {statusLabels[gift.status]}
              </Badge>
              <Badge color="grape" variant="outline">
                {gift.category}
              </Badge>
              {gift.is_surprise ? (
                <Badge color="orange" variant="light" leftSection={<Sparkles size={12} />}>
                  Surpresa
                </Badge>
              ) : null}
            </Group>
          </Stack>

          {canEdit ? (
            <Group gap={2} wrap="nowrap">
              <ActionIcon variant="subtle" color="pink" aria-label={`Editar ${gift.title}`} onClick={() => onEdit(gift)}>
                <Pencil size={16} />
              </ActionIcon>
              <ActionIcon variant="subtle" color="red" aria-label={`Excluir ${gift.title}`} onClick={() => onDelete(gift)}>
                <Trash2 size={16} />
              </ActionIcon>
            </Group>
          ) : null}
        </Group>

        {gift.description ? (
          <Text size="sm" c="dimmed" className="gift-card-description">
            {gift.description}
          </Text>
        ) : null}

        <Group gap="md" className="gift-card-meta">
          {priceRange ? <Text size="sm" fw={700}>{priceRange}</Text> : null}
          <Text size="xs" c="dimmed">{priorityLabels[gift.priority]}</Text>
        </Group>

        {gift.related_date ? (
          <Group gap={6} c="dimmed">
            <CalendarDays size={15} aria-hidden="true" />
            <Text size="xs">Para {formatDate(gift.related_date)}</Text>
          </Group>
        ) : null}

        <Group gap="xs" mt={4}>
          {gift.link_url ? (
            <Button
              component="a"
              href={gift.link_url}
              target="_blank"
              rel="noreferrer"
              variant="light"
              color="pink"
              size="xs"
              leftSection={<ExternalLink size={14} />}
            >
              Ver produto
            </Button>
          ) : null}
          {canMarkStatus && gift.status === 'wanted' ? (
            <Button
              variant="subtle"
              color="grape"
              size="xs"
              leftSection={<ShoppingBag size={14} />}
              onClick={() => onStatusChange(gift, 'purchased')}
              loading={isUpdating}
            >
              Marcar como comprado
            </Button>
          ) : null}
          {canMarkStatus && gift.status === 'purchased' ? (
            <Button
              variant="subtle"
              color="green"
              size="xs"
              leftSection={<Heart size={14} />}
              onClick={() => onStatusChange(gift, 'received')}
              loading={isUpdating}
            >
              Marcar como recebido
            </Button>
          ) : null}
        </Group>
      </Stack>
    </Card>
  )
}

export function GiftsPage() {
  const [data, setData] = useState<GiftPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('mine')
  const [modalOpened, setModalOpened] = useState(false)
  const [editingGift, setEditingGift] = useState<CoupleGift | null>(null)
  const [saving, setSaving] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const form = useForm<GiftFormValues>({
    mode: 'controlled',
    initialValues: emptyFormValues,
    validate: {
      title: (value) => (value.trim().length >= 2 ? null : 'Informe o nome do presente.'),
      priceMax: (value, values) =>
        value !== '' && values.priceMin !== '' && value < values.priceMin
          ? 'O valor máximo deve ser maior ou igual ao mínimo.'
          : null,
    },
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      setData(await getGiftPageData())
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Não foi possível carregar a lista de presentes.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const currentUserId = data?.profile.id ?? null
  const coupleId = data?.tree?.root.id ?? null
  const partnerId = data?.partner?.id ?? null
  const partnerName = data?.partner?.name || 'seu parceiro'
  const ownGifts = useMemo(
    () => data?.gifts.filter((gift) => gift.recipient_id === currentUserId) ?? [],
    [currentUserId, data?.gifts],
  )
  const partnerGifts = useMemo(
    () => data?.gifts.filter((gift) => gift.recipient_id === partnerId) ?? [],
    [data?.gifts, partnerId],
  )
  const visibleGifts = activeTab === 'mine' ? ownGifts : partnerGifts
  const activeListIsMine = activeTab === 'mine'
  const activeRecipientId = activeListIsMine ? currentUserId : partnerId

  function openCreate() {
    setEditingGift(null)
    form.setValues(emptyFormValues)
    form.resetDirty()
    setModalOpened(true)
  }

  function openEdit(gift: CoupleGift) {
    setEditingGift(gift)
    form.setValues({
      title: gift.title,
      description: gift.description ?? '',
      imageUrl: gift.image_url ?? '',
      linkUrl: gift.link_url ?? '',
      priceMin: gift.price_min ?? '',
      priceMax: gift.price_max ?? '',
      category: gift.category,
      priority: gift.priority,
      status: gift.status,
      isSurprise: gift.is_surprise,
      relatedDate: gift.related_date ?? '',
    })
    form.resetDirty()
    setModalOpened(true)
  }

  function confirmDelete(gift: CoupleGift) {
    modals.openConfirmModal({
      title: 'Excluir presente',
      centered: true,
      children: <Text size="sm">Esta ação remove “{gift.title}” da lista.</Text>,
      labels: { confirm: 'Excluir', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteGift(gift.id)
          notifications.show({ color: 'green', title: 'Presente excluído', message: 'A lista foi atualizada.' })
          await load()
        } catch (deleteError) {
          notifications.show({ color: 'red', title: 'Erro ao excluir', message: getErrorMessage(deleteError) })
        }
      },
    })
  }

  async function handleSubmit(values: GiftFormValues) {
    if (!coupleId) {
      return
    }

    setSaving(true)

    try {
      if (!activeRecipientId) {
        throw new Error('Vincule a outra pessoa antes de adicionar presentes para ela.')
      }

      const input = toGiftInput(values, coupleId, editingGift?.recipient_id ?? activeRecipientId)
      if (editingGift) {
        await updateGift({ ...input, giftId: editingGift.id })
      } else {
        await createGift(input)
      }
      notifications.show({
        color: 'green',
        title: editingGift ? 'Presente atualizado' : 'Presente adicionado',
        message: 'A lista do casal foi atualizada.',
      })
      setModalOpened(false)
      await load()
    } catch (saveError) {
      notifications.show({ color: 'red', title: 'Não foi possível salvar', message: getErrorMessage(saveError) })
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(gift: CoupleGift, status: GiftStatus) {
    setUpdatingStatus(gift.id)

    try {
      await updateGiftStatus({ giftId: gift.id, status })
      notifications.show({ color: 'green', title: 'Status atualizado', message: 'A lista foi atualizada.' })
      await load()
    } catch (statusError) {
      notifications.show({ color: 'red', title: 'Não foi possível atualizar', message: getErrorMessage(statusError) })
    } finally {
      setUpdatingStatus(null)
    }
  }

  if (loading) {
    return (
      <Container size="lg">
        <Group justify="center" py={96}>
          <Loader color="pink" />
        </Group>
      </Container>
    )
  }

  if (error) {
    return (
      <Container size="lg" py="xl">
        <Alert color="red" title="Erro ao carregar presentes">
          {error}
        </Alert>
      </Container>
    )
  }

  if (!data?.tree || !coupleId) {
    return (
      <Container size="md" py={{ base: 'lg', sm: 'xl' }}>
        <Alert color="pink" variant="light" title="Crie a timeline do casal primeiro">
          <Stack gap="sm">
            <Text>As listas de presentes ficam vinculadas à timeline principal do relacionamento.</Text>
            <Button component={Link} to="/dashboard" color="pink" size="sm">
              Ir para o dashboard
            </Button>
          </Stack>
        </Alert>
      </Container>
    )
  }

  const listLabel = activeListIsMine ? 'Sua lista' : `Lista de ${partnerName}`

  return (
    <Container size="lg" py={{ base: 'lg', sm: 'xl' }}>
      <Stack gap="xl">
        <Group justify="space-between" align="flex-end" gap="md">
          <Stack gap={5}>
            <Text c="var(--palette-blush)" fw={800} tt="uppercase" size="xs">
              Pequenos desejos
            </Text>
            <Title order={1}>Lista de presentes</Title>
            <Text c="dimmed" maw={620}>
              Guardem ideias para surpreender um ao outro nas próximas datas especiais.
            </Text>
          </Stack>
          {activeRecipientId ? (
            <Button color="pink" leftSection={<Plus size={17} />} onClick={openCreate}>
              {activeListIsMine ? 'Adicionar para mim' : `Adicionar para ${partnerName}`}
            </Button>
          ) : null}
        </Group>

        <Card className="glass-panel gifts-intro-card" radius={8} withBorder p={{ base: 'md', sm: 'lg' }}>
          <Group align="flex-start" gap="md" wrap="nowrap">
            <ThemeIcon color="pink" variant="light" size="lg" radius="xl">
              <Gift size={20} />
            </ThemeIcon>
            <Stack gap={3}>
              <Text fw={700}>As duas pessoas podem contribuir</Text>
              <Text size="sm" c="dimmed">
                {data.partner
                  ? 'Adicione desejos para você ou registre uma ideia que seu parceiro gostaria de ganhar. O modo surpresa não registra quem marcou o item.'
                  : 'Vincule a outra pessoa no seu perfil para compartilhar as duas listas.'}
              </Text>
            </Stack>
          </Group>
        </Card>

        <Tabs value={activeTab} onChange={(value) => setActiveTab(value ?? 'mine')} keepMounted={false} variant="outline">
          <Tabs.List>
            <Tabs.Tab value="mine" leftSection={<Heart size={15} />}>
              Minha lista ({ownGifts.length})
            </Tabs.Tab>
            <Tabs.Tab value="partner" leftSection={<Gift size={15} />}>
              {data.partner ? `Para ${partnerName}` : 'Para meu parceiro'} ({partnerGifts.length})
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value={activeTab} pt="xl">
            <Stack gap="md">
              <Group justify="space-between" align="flex-end">
                <Stack gap={2}>
                  <Title order={2} size="h3">{listLabel}</Title>
                  <Text size="sm" c="dimmed">
                    {activeListIsMine ? 'Itens que você gostaria de receber.' : 'Ideias para presentear seu parceiro.'}
                  </Text>
                </Stack>
                <Text size="sm" c="dimmed">{visibleGifts.length} {visibleGifts.length === 1 ? 'item' : 'itens'}</Text>
              </Group>

              {visibleGifts.length > 0 ? (
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                  {visibleGifts.map((gift) => (
                    <GiftCard
                      key={gift.id}
                      gift={gift}
                      canEdit={gift.created_by === currentUserId}
                      canMarkStatus={gift.recipient_id !== currentUserId}
                      isUpdating={updatingStatus === gift.id}
                      onEdit={openEdit}
                      onDelete={confirmDelete}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </SimpleGrid>
              ) : (
                <Card className="glass-panel gifts-empty-state" radius={8} withBorder p={{ base: 'xl', sm: 48 }}>
                  <Stack align="center" gap="sm" ta="center">
                    <ThemeIcon color="pink" variant="light" size={56} radius="xl">
                      <Gift size={28} />
                    </ThemeIcon>
                    <Title order={3} size="h4">
                      {activeListIsMine ? 'Sua lista está esperando ideias' : 'Ainda não há presentes aqui'}
                    </Title>
                    <Text size="sm" c="dimmed" maw={440}>
                      {activeListIsMine
                        ? 'Salve links, experiências e pequenas vontades para facilitar as próximas surpresas.'
                        : data.partner
                          ? `Ainda não há ideias de presentes para ${partnerName}.`
                          : 'Quando a outra pessoa estiver vinculada, os presentes dela aparecerão aqui.'}
                    </Text>
                    {activeRecipientId ? (
                      <Button color="pink" leftSection={<Plus size={16} />} onClick={openCreate}>
                        {activeListIsMine ? 'Adicionar primeiro presente' : `Adicionar presente para ${partnerName}`}
                      </Button>
                    ) : null}
                  </Stack>
                </Card>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingGift ? 'Editar presente' : 'Adicionar presente'}
        centered
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label="Nome do presente"
              placeholder="Ex.: fone sem fio…"
              required
              maxLength={120}
              autoComplete="off"
              {...form.getInputProps('title')}
            />
            <Textarea
              label="Descrição"
              placeholder="Cor, tamanho, modelo ou qualquer detalhe importante…"
              maxLength={1000}
              autosize
              minRows={3}
              {...form.getInputProps('description')}
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="URL da foto"
                placeholder="https://…"
                type="url"
                autoComplete="off"
                {...form.getInputProps('imageUrl')}
              />
              <TextInput
                label="Link do produto"
                placeholder="https://…"
                type="url"
                autoComplete="url"
                {...form.getInputProps('linkUrl')}
              />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <NumberInput
                label="Preço mínimo"
                placeholder="R$ 0,00"
                min={0}
                decimalScale={2}
                fixedDecimalScale={false}
                prefix="R$ "
                value={form.values.priceMin}
                onChange={(value) => form.setFieldValue('priceMin', value === '' ? '' : Number(value))}
                error={form.errors.priceMin}
              />
              <NumberInput
                label="Preço máximo"
                placeholder="R$ 0,00"
                min={0}
                decimalScale={2}
                fixedDecimalScale={false}
                prefix="R$ "
                value={form.values.priceMax}
                onChange={(value) => form.setFieldValue('priceMax', value === '' ? '' : Number(value))}
                error={form.errors.priceMax}
              />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select
                label="Categoria"
                data={giftCategories.map((category) => ({ value: category, label: category }))}
                {...form.getInputProps('category')}
              />
              <Select
                label="Prioridade"
                data={Object.entries(priorityLabels).map(([value, label]) => ({ value, label }))}
                {...form.getInputProps('priority')}
              />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select
                label="Status"
                data={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
                {...form.getInputProps('status')}
              />
              <DateInput
                label="Data especial"
                placeholder="Selecione uma data…"
                valueFormat="DD/MM/YYYY"
                locale="pt-br"
                clearable
                value={form.values.relatedDate || null}
                onChange={(value) => form.setFieldValue('relatedDate', value ?? '')}
              />
            </SimpleGrid>
            <Switch
              label="Modo surpresa"
              description="O sistema não registra quem marcou este item como comprado."
              checked={form.values.isSurprise}
              onChange={(event) => form.setFieldValue('isSurprise', event.currentTarget.checked)}
            />
            <Divider />
            <Group justify="flex-end">
              <Button variant="subtle" color="gray" onClick={() => setModalOpened(false)}>
                Cancelar
              </Button>
              <Button type="submit" color="pink" loading={saving}>
                {editingGift ? 'Salvar alterações' : 'Adicionar à lista'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  )
}
