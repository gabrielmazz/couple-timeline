import { Alert, Button, Container, Group, Loader, Stack } from '@mantine/core'
import { RefreshCcw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { TimelineView } from '../components/timeline/TimelineView'
import { fetchTimeline } from '../lib/timeline/queries'
import { getErrorMessage } from '../lib/utils'
import type { TimelinePayload } from '../types/timeline'

export function TimelinePage() {
  const { coupleId } = useParams()
  const [payload, setPayload] = useState<TimelinePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTimeline = useCallback(async () => {
    if (!coupleId) {
      setError('Timeline inválida.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      setPayload(await fetchTimeline(coupleId))
    } catch (loadError) {
      setPayload(null)
      setError(getErrorMessage(loadError, 'Não foi possível carregar a timeline.'))
    } finally {
      setLoading(false)
    }
  }, [coupleId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTimeline()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadTimeline])

  return (
    <Container size="lg">
      {loading ? (
        <Group justify="center" py={96}>
          <Loader color="pink" />
        </Group>
      ) : error ? (
        <Stack py="xl">
          <Alert color="red" radius={8} title="Erro ao carregar timeline">
            {error}
          </Alert>
          <Group>
            <Button component={Link} to="/dashboard" variant="light" color="pink">
              Dashboard
            </Button>
            <Button color="pink" leftSection={<RefreshCcw size={16} />} onClick={() => void loadTimeline()}>
              Tentar novamente
            </Button>
          </Group>
        </Stack>
      ) : payload ? (
        <TimelineView
          couple={payload.couple}
          events={payload.events}
          years={payload.years}
          canEdit={payload.canEdit}
          includesChildren={payload.includesChildren}
          onDeleted={() => void loadTimeline()}
        />
      ) : null}
    </Container>
  )
}
