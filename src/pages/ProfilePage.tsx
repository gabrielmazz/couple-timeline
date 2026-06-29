import {
  Alert,
  Badge,
  Button,
  Container,
  Divider,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { notifications } from '@mantine/notifications'
import { CalendarHeart, HeartHandshake, Save, UserPlus, UserRound } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppBackground } from '../components/layout/AppBackgroundContext'
import { addCoupleMemberByEmail } from '../lib/timeline/actions'
import { updateRelationshipDetails, updateUserProfile } from '../lib/profile/actions'
import { getProfilePageData } from '../lib/profile/queries'
import { getTimelineBackgroundImages } from '../lib/timeline/background'
import { fetchTimeline } from '../lib/timeline/queries'
import { getErrorMessage } from '../lib/utils'
import type { ProfilePageData } from '../types/profile'

function formatOptionalDate(value: string | null) {
  if (!value) {
    return 'Não informada'
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
}

export function ProfilePage() {
  const { setBackgroundImages } = useAppBackground()
  const [data, setData] = useState<ProfilePageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingRelationship, setSavingRelationship] = useState(false)
  const [linkingPartner, setLinkingPartner] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [bio, setBio] = useState('')
  const [relationshipStartedAt, setRelationshipStartedAt] = useState('')
  const [partnerEmail, setPartnerEmail] = useState('')

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const nextData = await getProfilePageData()
      setData(nextData)
      setName(nextData.profile.name ?? '')
      setBirthDate(nextData.profile.birth_date ?? '')
      setBio(nextData.profile.bio ?? '')
      setRelationshipStartedAt(nextData.tree?.root.relationship_started_at ?? '')
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Não foi possível carregar o perfil.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProfile()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadProfile])

  useEffect(() => {
    const timelineId = data?.tree?.root.id
    let ignore = false

    if (!timelineId) {
      setBackgroundImages([])
      return () => setBackgroundImages([])
    }

    void fetchTimeline(timelineId)
      .then((payload) => {
        if (!ignore) {
          setBackgroundImages(getTimelineBackgroundImages(payload.events))
        }
      })
      .catch(() => {
        if (!ignore) {
          setBackgroundImages([])
        }
      })

    return () => {
      ignore = true
      setBackgroundImages([])
    }
  }, [data?.tree?.root.id, setBackgroundImages])

  async function handleSaveProfile() {
    setSavingProfile(true)

    try {
      await updateUserProfile({ name, birthDate, bio })
      notifications.show({
        color: 'green',
        title: 'Perfil atualizado',
        message: 'A pessoa vinculada já poderá visualizar as novas informações.',
      })
      await loadProfile()
    } catch (saveError) {
      notifications.show({
        color: 'red',
        title: 'Erro ao atualizar perfil',
        message: getErrorMessage(saveError),
      })
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleSaveRelationship() {
    if (!data?.tree) {
      return
    }

    setSavingRelationship(true)

    try {
      await updateRelationshipDetails({
        coupleId: data.tree.root.id,
        startedAt: relationshipStartedAt,
      })
      notifications.show({
        color: 'green',
        title: 'Relacionamento atualizado',
        message: 'A data é compartilhada entre as duas contas.',
      })
      await loadProfile()
    } catch (saveError) {
      notifications.show({
        color: 'red',
        title: 'Erro ao atualizar relacionamento',
        message: getErrorMessage(saveError),
      })
    } finally {
      setSavingRelationship(false)
    }
  }

  async function handleLinkPartner() {
    if (!data?.tree) {
      return
    }

    setLinkingPartner(true)

    try {
      await addCoupleMemberByEmail({
        coupleId: data.tree.root.id,
        email: partnerEmail,
      })
      notifications.show({
        color: 'green',
        title: 'Pessoa vinculada',
        message: 'Os perfis e as timelines agora são compartilhados entre as duas contas.',
      })
      setPartnerEmail('')
      await loadProfile()
    } catch (linkError) {
      notifications.show({
        color: 'red',
        title: 'Erro ao vincular pessoa',
        message: getErrorMessage(linkError),
      })
    } finally {
      setLinkingPartner(false)
    }
  }

  return (
    <Container size="lg" py={{ base: 'lg', sm: 'xl' }}>
      <Stack gap="xl">
        <Stack gap={4}>
          <Text c="var(--palette-blush)" fw={800} tt="uppercase" size="xs">
            Conta
          </Text>
          <Title order={1}>Perfil e relacionamento</Title>
          <Text c="dimmed">
            Gerencie seus dados pessoais e as informações compartilhadas com a pessoa vinculada.
          </Text>
        </Stack>

        {loading ? (
          <Group justify="center" py={96}>
            <Loader color="pink" />
          </Group>
        ) : error ? (
          <Alert color="red" radius={8} title="Erro ao carregar perfil">
            {error}
          </Alert>
        ) : data ? (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <Paper className="glass-panel" radius={8} p={{ base: 'md', sm: 'xl' }} withBorder>
              <Stack gap="lg">
                <Group gap="sm">
                  <ThemeIcon color="pink" variant="light" size="lg" radius="xl">
                    <UserRound size={20} />
                  </ThemeIcon>
                  <Stack gap={0}>
                    <Title order={2} size="h3">Seu perfil</Title>
                    <Text c="dimmed" size="sm">Estes dados ficam visíveis para a pessoa vinculada.</Text>
                  </Stack>
                </Group>

                <Divider />

                <TextInput
                  label="Nome"
                  placeholder="Como você quer aparecer"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.currentTarget.value)}
                />
                <TextInput label="E-mail" value={data.profile.email ?? ''} disabled />
                <DateInput
                  label="Data de nascimento"
                  placeholder="Selecione a data"
                  valueFormat="DD/MM/YYYY"
                  locale="pt-br"
                  clearable
                  maxDate={new Date()}
                  value={birthDate || null}
                  onChange={(value) => setBirthDate(value ?? '')}
                />
                <Textarea
                  label="Sobre você"
                  description={`${bio.length}/500 caracteres`}
                  placeholder="Conte um pouco sobre você, seus interesses ou algo importante para compartilhar."
                  minRows={5}
                  autosize
                  maxLength={500}
                  value={bio}
                  onChange={(event) => setBio(event.currentTarget.value)}
                />
                <Button
                  color="pink"
                  leftSection={<Save size={17} />}
                  loading={savingProfile}
                  onClick={() => void handleSaveProfile()}
                >
                  Salvar perfil
                </Button>
              </Stack>
            </Paper>

            <Stack gap="lg">
              <Paper className="glass-panel" radius={8} p={{ base: 'md', sm: 'xl' }} withBorder>
                <Stack gap="lg">
                  <Group justify="space-between" align="flex-start" gap="sm">
                    <Group gap="sm">
                      <ThemeIcon color="pink" variant="light" size="lg" radius="xl">
                        <HeartHandshake size={20} />
                      </ThemeIcon>
                      <Stack gap={0}>
                        <Title order={2} size="h3">Relacionamento</Title>
                        <Text c="dimmed" size="sm">Informações compartilhadas pelas duas contas.</Text>
                      </Stack>
                    </Group>
                    {data.tree ? (
                      <Badge color="pink" variant="light">
                        {data.tree.memberRole === 'owner' ? 'Proprietário' : 'Parceiro'}
                      </Badge>
                    ) : null}
                  </Group>

                  <Divider />

                  {data.tree ? (
                    <>
                      <TextInput label="Timeline principal" value={data.tree.root.name} disabled />
                      <DateInput
                        label="Início do relacionamento"
                        description="Qualquer uma das duas pessoas pode atualizar esta data."
                        placeholder="Selecione a data"
                        valueFormat="DD/MM/YYYY"
                        locale="pt-br"
                        clearable
                        maxDate={new Date()}
                        value={relationshipStartedAt || null}
                        onChange={(value) => setRelationshipStartedAt(value ?? '')}
                      />
                      <Button
                        variant="light"
                        color="pink"
                        leftSection={<CalendarHeart size={17} />}
                        loading={savingRelationship}
                        onClick={() => void handleSaveRelationship()}
                      >
                        Salvar relacionamento
                      </Button>
                    </>
                  ) : (
                    <Alert color="pink" variant="light" title="Crie a timeline principal primeiro">
                      <Stack gap="sm">
                        <Text size="sm">O relacionamento é criado junto com a primeira timeline.</Text>
                        <Button component={Link} to="/dashboard" color="pink" size="xs">
                          Ir para o dashboard
                        </Button>
                      </Stack>
                    </Alert>
                  )}
                </Stack>
              </Paper>

              <Paper className="glass-panel" radius={8} p={{ base: 'md', sm: 'xl' }} withBorder>
                <Stack gap="lg">
                  <Group gap="sm">
                    <ThemeIcon color="grape" variant="light" size="lg" radius="xl">
                      <UserPlus size={20} />
                    </ThemeIcon>
                    <Stack gap={0}>
                      <Title order={2} size="h3">Pessoa vinculada</Title>
                      <Text c="dimmed" size="sm">A mesma pessoa aparece nos dois perfis.</Text>
                    </Stack>
                  </Group>

                  <Divider />

                  {data.partner ? (
                    <Stack gap="sm">
                      <Group justify="space-between" gap="sm">
                        <Title order={3} size="h4">{data.partner.name || 'Nome não informado'}</Title>
                        <Badge color="green" variant="light">Vinculada</Badge>
                      </Group>
                      <Text size="sm"><Text span c="dimmed">E-mail: </Text>{data.partner.email}</Text>
                      <Text size="sm">
                        <Text span c="dimmed">Nascimento: </Text>
                        {formatOptionalDate(data.partner.birth_date)}
                      </Text>
                      <Text size="sm" c={data.partner.bio ? undefined : 'dimmed'} style={{ whiteSpace: 'pre-wrap' }}>
                        {data.partner.bio || 'A pessoa ainda não adicionou uma biografia.'}
                      </Text>
                    </Stack>
                  ) : data.tree?.memberRole === 'owner' ? (
                    <Stack gap="md">
                      <Text size="sm" c="dimmed">
                        A pessoa precisa ter uma conta cadastrada e não pode participar de outro relacionamento.
                      </Text>
                      <TextInput
                        label="E-mail da pessoa"
                        placeholder="parceiro@email.com"
                        type="email"
                        value={partnerEmail}
                        onChange={(event) => setPartnerEmail(event.currentTarget.value)}
                      />
                      <Button
                        color="pink"
                        leftSection={<UserPlus size={17} />}
                        loading={linkingPartner}
                        disabled={!partnerEmail.trim()}
                        onClick={() => void handleLinkPartner()}
                      >
                        Vincular pessoa
                      </Button>
                    </Stack>
                  ) : data.tree ? (
                    <Alert color="pink" variant="light">O proprietário ainda não vinculou outra pessoa.</Alert>
                  ) : (
                    <Text c="dimmed" size="sm">Crie a timeline principal para habilitar o vínculo.</Text>
                  )}
                </Stack>
              </Paper>
            </Stack>
          </SimpleGrid>
        ) : null}
      </Stack>
    </Container>
  )
}
