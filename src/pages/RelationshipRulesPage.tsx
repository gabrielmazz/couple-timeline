import { Alert, Button, Card, Container, Group, Loader, Modal, Paper, SimpleGrid, Stack, Text, Textarea, TextInput, ThemeIcon, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { BookHeart, Heart, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/auth/auth-context'
import { firestore } from '../lib/firebase/client'
import { deleteRelationshipRule, saveRelationshipRule, type RelationshipRule } from '../lib/relationship-rules/actions'
import { getUserTimelineTree } from '../lib/timeline/queries'
import { getErrorMessage } from '../lib/utils'
import './monthly-plans.css'
import './relationship-rules.css'

export function RelationshipRulesPage() {
  const { user } = useAuth()
  const [coupleId, setCoupleId] = useState<string | null>(null)
  const [rules, setRules] = useState<RelationshipRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [opened, setOpened] = useState(false)
  const [editing, setEditing] = useState<RelationshipRule | null>(null)
  const [deleting, setDeleting] = useState<RelationshipRule | null>(null)
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const form = useForm({ initialValues: { title: '', description: '' }, validate: {
    title: (value) => value.trim().length < 2 ? 'Informe um título com pelo menos 2 caracteres.' : value.trim().length > 120 ? 'Use até 120 caracteres.' : null,
    description: (value) => value.trim().length > 5000 ? 'Use até 5000 caracteres.' : null,
  } })

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | undefined
    getUserTimelineTree().then((tree) => {
      if (!active) return
      if (!tree) throw new Error('Crie uma timeline ou vincule seu par para registrar suas regras.')
      setCoupleId(tree.root.id)
      unsubscribe = onSnapshot(query(collection(firestore, 'couple_relationship_rules'), where('couple_id', '==', tree.root.id)), (snapshot) => {
        if (!active) return
        setRules(snapshot.docs.map((item) => item.data() as RelationshipRule).sort((a, b) => (a.created_at?.toMillis() ?? 0) - (b.created_at?.toMillis() ?? 0)))
        setError(null)
        setLoading(false)
      }, () => { if (active) { setError('Não foi possível carregar as regras. Tente recarregar a página.'); setLoading(false) } })
    }).catch((loadError) => { if (active) { setError(getErrorMessage(loadError, 'Não foi possível carregar as regras.')); setLoading(false) } })
    return () => { active = false; unsubscribe?.() }
  }, [])

  function openForm(rule?: RelationshipRule) {
    setEditing(rule ?? null)
    form.setValues({ title: rule?.title ?? '', description: rule?.description ?? '' })
    form.clearErrors()
    setOpened(true)
  }

  async function handleSave(values: { title: string; description: string }) {
    if (!coupleId || busy.current) return
    busy.current = true
    setSaving(true)
    try {
      await saveRelationshipRule(coupleId, values, editing ?? undefined)
      setOpened(false)
      notifications.show({ color: 'green', message: editing ? 'Regra atualizada.' : 'Regra adicionada.' })
    } catch (saveError) {
      notifications.show({ color: 'red', title: 'Não foi possível salvar', message: getErrorMessage(saveError, 'Tente novamente.') })
    } finally { busy.current = false; setSaving(false) }
  }

  async function handleDelete() {
    if (!deleting || busy.current) return
    busy.current = true
    setSaving(true)
    try {
      await deleteRelationshipRule(deleting)
      setDeleting(null)
      notifications.show({ color: 'green', message: 'Regra excluída.' })
    } catch (deleteError) {
      notifications.show({ color: 'red', title: 'Não foi possível excluir', message: getErrorMessage(deleteError, 'Tente novamente.') })
    } finally { busy.current = false; setSaving(false) }
  }

  const term = search.trim().toLocaleLowerCase('pt-BR')
  const visibleRules = rules.filter((rule) => `${rule.title} ${rule.description}`.toLocaleLowerCase('pt-BR').includes(term))
  if (loading) return <Container size="lg" py={96}><Group justify="center"><Loader color="pink" aria-label="Carregando regras" /></Group></Container>
  if (error && !coupleId) return <Container size="lg" py="xl"><Alert color="red" title="Regras indisponíveis">{error}</Alert><Button component={Link} to="/dashboard" variant="light" color="pink" mt="md">Voltar para o início</Button></Container>

  return <Container size="xl" py={{ base: 'lg', sm: 'xl' }} className="monthly-plans-page relationship-rules-page">
    <Stack gap="xl">
      <Paper className="monthly-plans-hero glass-panel" radius={8} p={{ base: 'lg', sm: 'xl' }} withBorder>
        <Group justify="space-between" align="flex-end" gap="xl">
          <Stack gap="sm" maw={650}>
            <Text className="monthly-plans-eyebrow" fw={800} tt="uppercase" size="xs">Cuidado em cada escolha</Text>
            <Title order={1}>Nossas regras, nosso jeito de amar.</Title>
            <Text c="dimmed" size="lg">Um espaço para guardar os combinados que fazem sentido para vocês e revisitá-los sempre que precisarem.</Text>
          </Stack>
          <Button color="pink" leftSection={<Plus size={16} />} onClick={() => openForm()}>Adicionar regra</Button>
        </Group>
      </Paper>
      {error && <Alert color="yellow" title="A lista pode estar desatualizada">{error}</Alert>}
      <Group justify="space-between" align="center" gap="md">
        <div><Text className="monthly-plans-section-label" fw={800} tt="uppercase" size="xs">Construído a dois</Text><Title order={2} size="h3" mt={3}>Os combinados de vocês</Title><Text size="sm" c="dimmed" mt={4}>{rules.length} {rules.length === 1 ? 'regra registrada' : 'regras registradas'}</Text></div>
        {rules.length > 0 && <TextInput className="relationship-rules-search" aria-label="Buscar regras" placeholder="Buscar regras" leftSection={<Search size={16} />} value={search} onChange={(event) => setSearch(event.currentTarget.value)} />}
      </Group>
      {rules.length === 0 && !error ? <Card className="monthly-plans-empty glass-panel" p={{ base: 'xl', sm: 56 }} withBorder><Stack align="center" gap="sm" ta="center"><ThemeIcon color="pink" variant="light" size={56} radius="xl"><BookHeart size={25} /></ThemeIcon><Title order={2} size="h3">Seus combinados começam aqui</Title><Text c="dimmed" maw={470}>Registrem juntos aquilo que querem lembrar e cuidar no relacionamento.</Text><Button color="pink" leftSection={<Plus size={16} />} onClick={() => openForm()}>Adicionar primeira regra</Button></Stack></Card> : null}
      {rules.length > 0 && visibleRules.length === 0 && <Paper className="monthly-filter-empty" p="xl"><Text fw={700}>Nenhuma regra encontrada</Text><Button variant="subtle" color="pink" onClick={() => setSearch('')}>Limpar busca</Button></Paper>}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">{visibleRules.map((rule) => <Card key={rule.id} className="monthly-plan-card glass-panel relationship-rule-card" p="lg" withBorder><Stack gap="md" h="100%"><Group justify="space-between"><ThemeIcon color="pink" variant="light" size={42} radius="xl"><Heart size={20} /></ThemeIcon><Text size="xs" c="dimmed">{rule.created_by === user?.id ? 'Adicionada por você' : 'Adicionada pelo seu par'}</Text></Group><div><Title order={3} size="h3">{rule.title}</Title>{rule.description && <Text className="relationship-rule-description" c="dimmed" size="sm" mt={8}>{rule.description}</Text>}</div><Group gap="xs" mt="auto"><Button variant="subtle" color="gray" size="xs" leftSection={<Pencil size={14} />} onClick={() => openForm(rule)}>Editar</Button><Button variant="subtle" color="red" size="xs" leftSection={<Trash2 size={14} />} onClick={() => setDeleting(rule)}>Excluir</Button></Group></Stack></Card>)}</SimpleGrid>
    </Stack>
    <Modal opened={opened} onClose={() => { if (!saving) setOpened(false) }} title={editing ? 'Editar regra' : 'Nova regra'} centered>
      <form onSubmit={(event) => { void form.onSubmit((values) => void handleSave(values))(event) }}><Stack><TextInput label="Título" placeholder="Ex.: Conversar com sinceridade" required maxLength={120} {...form.getInputProps('title')} /><Textarea label="Detalhes" description="Opcional: contem mais sobre este combinado." placeholder="O que esse combinado significa para vocês?" autosize minRows={4} maxLength={5000} {...form.getInputProps('description')} /><Group justify="flex-end"><Button variant="subtle" color="gray" onClick={() => setOpened(false)} disabled={saving}>Cancelar</Button><Button type="submit" color="pink" loading={saving}>Salvar regra</Button></Group></Stack></form>
    </Modal>
    <Modal opened={Boolean(deleting)} onClose={() => { if (!saving) setDeleting(null) }} title="Excluir regra?" centered><Stack><Text>“{deleting?.title}” será removida para vocês dois.</Text><Group justify="flex-end"><Button variant="subtle" color="gray" onClick={() => setDeleting(null)} disabled={saving}>Cancelar</Button><Button color="red" loading={saving} onClick={() => void handleDelete()}>Excluir regra</Button></Group></Stack></Modal>
  </Container>
}
