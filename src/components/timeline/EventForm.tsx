import {
  Alert,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { CalendarHeart, Save } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createTimelineEvent, updateTimelineEvent } from '../../lib/timeline/actions'
import { getErrorMessage, getYearFromDate } from '../../lib/utils'
import type { TimelineEvent } from '../../types/database'
import type { EventFormModel, TimelinePhotoWithUrl } from '../../types/timeline'
import { PhotoUploader } from './PhotoUploader'

type EditableEvent = TimelineEvent & {
  photos: TimelinePhotoWithUrl[]
}

export function EventForm({
  coupleId,
  event,
}: {
  coupleId: string
  event?: EditableEvent
}) {
  const navigate = useNavigate()
  const [files, setFiles] = useState<File[]>([])
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([])
  const [coverPhotoPath, setCoverPhotoPath] = useState<string | null>(event?.cover_photo_path ?? null)
  const [coverFileIndex, setCoverFileIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const form = useForm<EventFormModel>({
    initialValues: {
      title: event?.title ?? '',
      eventDate: event?.event_date ?? new Date().toISOString().slice(0, 10),
      description: event?.description ?? '',
      musicUrl: event?.music_url ?? '',
      coverPhotoPath: event?.cover_photo_path ?? null,
    },
    validate: {
      title: (value) => (value.trim().length < 2 ? 'Informe um título.' : null),
      eventDate: (value) => (!value ? 'Informe uma data.' : null),
      musicUrl: (value) => {
        if (!value) {
          return null
        }

        try {
          new URL(value)
          return null
        } catch {
          return 'Informe uma URL válida.'
        }
      },
    },
  })

  async function handleSubmit(values: EventFormModel) {
    if (!event && files.length === 0) {
      notifications.show({
        color: 'red',
        title: 'Adicione fotos',
        message: 'O MVP exige pelo menos uma imagem para criar o evento.',
      })
      return
    }

    setSaving(true)

    try {
      if (event) {
        await updateTimelineEvent({
          coupleId,
          eventId: event.id,
          title: values.title,
          eventDate: values.eventDate,
          description: values.description,
          musicUrl: values.musicUrl,
          files,
          removedPhotoIds,
          coverPhotoPath,
          coverFileIndex,
        })
      } else {
        await createTimelineEvent({
          coupleId,
          title: values.title,
          eventDate: values.eventDate,
          description: values.description,
          musicUrl: values.musicUrl,
          files,
          coverFileIndex: coverFileIndex ?? 0,
        })
      }

      notifications.show({
        color: 'green',
        title: event ? 'Evento atualizado' : 'Evento criado',
        message: 'A timeline já está com as novas informações.',
      })
      navigate(`/timeline/${coupleId}`)
    } catch (error) {
      notifications.show({
        color: 'red',
        title: event ? 'Erro ao atualizar evento' : 'Erro ao criar evento',
        message: getErrorMessage(error),
      })
    } finally {
      setSaving(false)
    }
  }

  const yearPreview = getYearFromDate(form.values.eventDate)
  const visiblePhotos = (event?.photos ?? []).filter((photo) => !removedPhotoIds.includes(photo.id))

  return (
    <Paper className="glass-panel" radius={8} p={{ base: 'md', sm: 'xl' }} withBorder>
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="xl">
          <Group justify="space-between" align="flex-start" gap="lg">
            <Stack gap={4}>
              <Text c="var(--palette-blush)" fw={800} tt="uppercase" size="xs">
                {event ? 'Editar momento' : 'Novo momento'}
              </Text>
              <Title order={1}>{event ? 'Atualizar evento' : 'Criar evento'}</Title>
            </Stack>
            <Button component={Link} to={`/timeline/${coupleId}`} variant="subtle" color="pink">
              Voltar
            </Button>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="Título"
              placeholder="Nossa primeira viagem"
              required
              {...form.getInputProps('title')}
            />
            <DateInput
              label="Data do evento"
              placeholder="Escolha a data"
              valueFormat="DD/MM/YYYY"
              locale="pt-br"
              clearable={false}
              required
              value={form.values.eventDate}
              onChange={(value) => form.setFieldValue('eventDate', value ?? '')}
              error={form.errors.eventDate}
            />
            <TextInput label="Ano da timeline" value={String(yearPreview)} readOnly />
            <TextInput
              label="Link de música"
              placeholder="Spotify ou YouTube"
              {...form.getInputProps('musicUrl')}
            />
          </SimpleGrid>

          <Textarea
            label="Descrição longa"
            placeholder="Conte o contexto, as sensações e os detalhes desse momento."
            autosize
            minRows={5}
            maxRows={12}
            {...form.getInputProps('description')}
          />

          <Stack gap="xs">
            <Text fw={700}>Fotos do evento</Text>
            <PhotoUploader
              existingPhotos={event?.photos ?? []}
              removedPhotoIds={removedPhotoIds}
              files={files}
              coverPhotoPath={coverPhotoPath}
              coverFileIndex={coverFileIndex}
              loading={saving}
              onRemovedPhotoIdsChange={setRemovedPhotoIds}
              onFilesChange={setFiles}
              onCoverPhotoPathChange={(path) => {
                setCoverPhotoPath(path)
                form.setFieldValue('coverPhotoPath', path)
              }}
              onCoverFileIndexChange={setCoverFileIndex}
            />
          </Stack>

          {visiblePhotos.length === 0 && files.length === 0 ? (
            <Alert color="yellow" radius={8} icon={<CalendarHeart size={18} />}>
              Adicione pelo menos uma imagem para deixar o card da timeline visual.
            </Alert>
          ) : null}

          <Group justify="flex-end">
            <Button
              type="submit"
              color="pink"
              size="md"
              loading={saving}
              leftSection={<Save size={17} />}
            >
              {event ? 'Salvar alterações' : 'Salvar evento'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  )
}
