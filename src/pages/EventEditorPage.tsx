import { Alert, Container, Group, Loader, Stack } from '@mantine/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppBackground } from '../components/layout/AppBackgroundContext'
import { EventForm } from '../components/timeline/EventForm'
import { getPhotoBackgroundImages } from '../lib/timeline/background'
import { fetchEventForEdit, fetchTimelineTreeBackgroundImages, getCouple } from '../lib/timeline/queries'
import { getErrorMessage } from '../lib/utils'
import type { TimelineEvent } from '../types/database'
import type { TimelinePhotoWithUrl } from '../types/timeline'

type EditableEvent = TimelineEvent & {
  photos: TimelinePhotoWithUrl[]
}

export function EventEditorPage({ mode }: { mode: 'create' | 'edit' }) {
  const { coupleId, eventId } = useParams()
  const { backgroundImages, setBackgroundImages, loadCachedBackgroundImages } = useAppBackground()
  const backgroundImagesRef = useRef(backgroundImages)
  const [event, setEvent] = useState<EditableEvent | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    backgroundImagesRef.current = backgroundImages
  }, [backgroundImages])

  const load = useCallback(async () => {
    if (!coupleId) {
      setError('Timeline inválida.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (mode === 'create') {
        const { couple, canEdit } = await getCouple(coupleId)

        if (!canEdit) {
          throw new Error('Você não tem permissão para criar eventos nesta timeline.')
        }

        const rootId = couple.parent_id ?? couple.id

        loadCachedBackgroundImages(`timeline-tree:${rootId}`, () => fetchTimelineTreeBackgroundImages(rootId))
      } else {
        if (!eventId) {
          throw new Error('Evento inválido.')
        }

        const editableEvent = await fetchEventForEdit(coupleId, eventId)

        setEvent(editableEvent)
        if (backgroundImagesRef.current.length === 0) {
          setBackgroundImages(getPhotoBackgroundImages(editableEvent.photos))
        }
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Não foi possível carregar o formulário.'))
    } finally {
      setLoading(false)
    }
  }, [coupleId, eventId, loadCachedBackgroundImages, mode, setBackgroundImages])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [load])

  if (!coupleId) {
    return null
  }

  return (
    <Container size="md" py={{ base: 'lg', sm: 'xl' }}>
      {loading ? (
        <Group justify="center" py={96}>
          <Loader color="pink" />
        </Group>
      ) : error ? (
        <Stack>
          <Alert color="red" radius={8} title="Erro">
            {error}
          </Alert>
        </Stack>
      ) : (
        <EventForm coupleId={coupleId} event={event} />
      )}
    </Container>
  )
}
