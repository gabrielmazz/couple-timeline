import { Badge, Button, Container, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { ArrowRight, CalendarHeart, Images, Music2 } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../components/auth/auth-context'

export function HomePage() {
  const { user, loading } = useAuth()

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <Container size="lg" className="hero-band">
      <Stack gap="xl">
        <Stack gap="lg" maw={780}>
          <Badge color="pink" variant="light" size="lg">
            Timeline visual para casais
          </Badge>
          <Title order={1} size="clamp(3rem, 9vw, 7rem)" lh={0.9}>
            Momentos que merecem uma linha do tempo.
          </Title>
          <Text size="xl" c="dimmed" maw={650}>
            Crie uma timeline privada ou pública com fotos, datas, descrições e a música que marcou cada
            capítulo.
          </Text>
          <Group>
            <Button component={Link} to="/register" color="pink" size="lg" rightSection={<ArrowRight size={18} />}>
              Criar timeline
            </Button>
            <Button component={Link} to="/login" variant="light" color="pink" size="lg">
              Entrar
            </Button>
          </Group>
        </Stack>

        <Paper className="glass-panel" radius={8} p={{ base: 'md', sm: 'xl' }} withBorder>
          <Group grow align="stretch">
            <Stack gap="xs">
              <CalendarHeart size={26} color="var(--palette-rose)" />
              <Text fw={800}>Eventos por data</Text>
              <Text c="dimmed" size="sm">
                Seletor por ano e navegação horizontal no desktop.
              </Text>
            </Stack>
            <Stack gap="xs">
              <Images size={26} color="var(--palette-rose)" />
              <Text fw={800}>Fotos no Storage</Text>
              <Text c="dimmed" size="sm">
                Upload múltiplo e seleção de capa por evento.
              </Text>
            </Stack>
            <Stack gap="xs">
              <Music2 size={26} color="var(--palette-rose)" />
              <Text fw={800}>Música embutida</Text>
              <Text c="dimmed" size="sm">
                YouTube e Spotify aparecem no modal do momento.
              </Text>
            </Stack>
          </Group>
        </Paper>
      </Stack>
    </Container>
  )
}
