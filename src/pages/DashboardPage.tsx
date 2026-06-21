import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Modal,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { CalendarHeart, Eye, Lock, Plus, UserPlus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { addCoupleMemberByEmail, createCouple } from '../lib/timeline/actions'
import { ensureProfile, listUserCouples } from '../lib/timeline/queries'
import { getErrorMessage } from '../lib/utils'
import type { TimelineVisibility } from '../types/database'
import type { CoupleListItem } from '../types/timeline'

type CoupleForm = {
  name: string
  visibility: TimelineVisibility
}

type MemberForm = {
  email: string
}

export function DashboardPage() {
  const [couples, setCouples] = useState<CoupleListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [addingMember, setAddingMember] = useState(false)
  const [modalOpened, setModalOpened] = useState(false)
  const [memberModalCouple, setMemberModalCouple] = useState<CoupleListItem | null>(null)
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
  const memberForm = useForm<MemberForm>({
    initialValues: {
      email: '',
    },
    validate: {
      email: (value) => (/^\S+@\S+\.\S+$/.test(value) ? null : 'Informe o e-mail da pessoa.'),
    },
  })

  const loadCouples = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      await ensureProfile()
      setCouples(await listUserCouples())
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Não foi possível carregar.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCouples()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadCouples])

  async function handleCreate(values: CoupleForm) {
    setCreating(true)

    try {
      await createCouple(values)
      notifications.show({
        color: 'green',
        title: 'Timeline criada',
        message: 'Você já pode adicionar os primeiros eventos.',
      })
      form.reset()
      setModalOpened(false)
      await loadCouples()
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

  async function handleAddMember(values: MemberForm) {
    if (!memberModalCouple) {
      return
    }

    setAddingMember(true)

    try {
      await addCoupleMemberByEmail({
        coupleId: memberModalCouple.id,
        email: values.email,
      })
      notifications.show({
        color: 'green',
        title: 'Pessoa vinculada',
        message: 'Ela já pode acessar esta timeline pela própria conta.',
      })
      memberForm.reset()
      setMemberModalCouple(null)
      await loadCouples()
    } catch (addError) {
      notifications.show({
        color: 'red',
        title: 'Erro ao vincular pessoa',
        message: getErrorMessage(addError),
      })
    } finally {
      setAddingMember(false)
    }
  }

  return (
    <Container size="lg" py={{ base: 'lg', sm: 'xl' }}>
      <Stack gap="xl">
        <Group justify="space-between" align="flex-end">
          <Stack gap={4}>
            <Text c="var(--palette-blush)" fw={800} tt="uppercase" size="xs">
              Dashboard
            </Text>
            <Title order={1}>Suas timelines</Title>
          </Stack>
          <Button color="pink" leftSection={<Plus size={17} />} onClick={() => setModalOpened(true)}>
            Nova timeline
          </Button>
        </Group>

        {loading ? (
          <Group justify="center" py="xl">
            <Loader color="pink" />
          </Group>
        ) : error ? (
          <Alert color="red" radius={8} title="Erro">
            {error}
          </Alert>
        ) : couples.length === 0 ? (
          <Alert
            className="glass-panel"
            color="pink"
            variant="light"
            radius={8}
            icon={<CalendarHeart size={20} />}
            title="Nenhuma timeline criada"
          >
            Crie uma timeline para começar a registrar eventos, fotos e músicas.
          </Alert>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {couples.map((couple) => (
              <Card key={couple.id} className="glass-panel" radius={8} p="lg" withBorder>
                <Stack h="100%" justify="space-between" gap="xl">
                  <Stack gap="xs">
                    <Group justify="space-between" align="flex-start">
                      <Badge
                        color={couple.visibility === 'public' ? 'green' : 'pink'}
                        variant="light"
                        leftSection={couple.visibility === 'public' ? <Eye size={12} /> : <Lock size={12} />}
                      >
                        {couple.visibility === 'public' ? 'Pública' : 'Privada'}
                      </Badge>
                      <Badge variant="outline" color="pink">
                        {couple.memberRole}
                      </Badge>
                    </Group>
                    <Title order={2} size="h3">
                      {couple.name}
                    </Title>
                    <Text c="dimmed" size="sm">
                      Criada em {new Date(couple.created_at).toLocaleDateString('pt-BR')}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Button component={Link} to={`/timeline/${couple.id}`} color="pink" fullWidth>
                      Abrir timeline
                    </Button>
                    {couple.memberRole === 'owner' ? (
                      <Button
                        variant="light"
                        color="pink"
                        fullWidth
                        leftSection={<UserPlus size={16} />}
                        onClick={() => setMemberModalCouple(couple)}
                      >
                        Vincular pessoa
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </Stack>

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title="Nova timeline de casal"
        centered
        radius={8}
      >
        <form onSubmit={form.onSubmit(handleCreate)}>
          <Stack gap="md">
            <TextInput label="Nome" placeholder="Gabriel & Ana" required {...form.getInputProps('name')} />
            <SegmentedControl
              color="pink"
              data={[
                { label: 'Privada', value: 'private' },
                { label: 'Pública', value: 'public' },
              ]}
              {...form.getInputProps('visibility')}
            />
            <Button type="submit" color="pink" loading={creating} leftSection={<Plus size={17} />}>
              Criar timeline
            </Button>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={Boolean(memberModalCouple)}
        onClose={() => {
          memberForm.reset()
          setMemberModalCouple(null)
        }}
        title="Vincular pessoa à timeline"
        centered
        radius={8}
      >
        <form onSubmit={memberForm.onSubmit(handleAddMember)}>
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Informe o e-mail da conta da pessoa. Ela precisa ter se cadastrado no app antes.
            </Text>
            <TextInput
              label="E-mail"
              placeholder="namorada@email.com"
              type="email"
              required
              {...memberForm.getInputProps('email')}
            />
            <Button
              type="submit"
              color="pink"
              loading={addingMember}
              leftSection={<UserPlus size={17} />}
            >
              Vincular pessoa
            </Button>
          </Stack>
        </form>
      </Modal>
    </Container>
  )
}
