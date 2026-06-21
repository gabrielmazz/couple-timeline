import { Alert, Button, Group, Image, Modal, Stack, Text, Title } from '@mantine/core'
import { CalendarHeart, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Couple } from '../../types/database'
import type { TimelineEventWithPhotos } from '../../types/timeline'
import { TimelineCard } from './TimelineCard'
import { TimelineEventModal } from './TimelineEventModal'
import { TimelineYearSelector } from './TimelineYearSelector'

type PhotoPreview = {
  src: string
  alt: string
}

export function TimelineView({
  couple,
  events,
  years,
  canEdit,
  onDeleted,
}: {
  couple: Couple
  events: TimelineEventWithPhotos[]
  years: number[]
  canEdit: boolean
  onDeleted: () => void
}) {
  const [selectedYear, setSelectedYear] = useState<number | null>(years.at(-1) ?? null)
  const [selectedEvent, setSelectedEvent] = useState<TimelineEventWithPhotos | null>(null)
  const [photoPreview, setPhotoPreview] = useState<PhotoPreview | null>(null)

  const visibleEvents = useMemo(
    () => (selectedYear ? events.filter((event) => event.year === selectedYear) : events),
    [events, selectedYear],
  )

  return (
    <Stack gap="xl" py={{ base: 'lg', sm: 'xl' }}>
      <Group justify="space-between" align="flex-end" gap="lg">
        <Stack gap={6}>
          <Text c="var(--palette-blush)" fw={800} tt="uppercase" size="xs">
            Timeline {couple.visibility === 'public' ? 'pública' : 'privada'}
          </Text>
          <Title order={1} size="clamp(2.2rem, 7vw, 5.4rem)" lh={0.92}>
            {couple.name}
          </Title>
        </Stack>
        {canEdit ? (
          <Button
            component={Link}
            to={`/timeline/${couple.id}/novo-evento`}
            color="pink"
            leftSection={<Plus size={17} />}
          >
            Novo evento
          </Button>
        ) : null}
      </Group>

      <TimelineYearSelector years={years} selectedYear={selectedYear} onYearChange={setSelectedYear} />

      {events.length === 0 ? (
        <Alert
          className="glass-panel"
          variant="light"
          color="pink"
          radius={8}
          icon={<CalendarHeart size={20} />}
          title="Nenhum momento cadastrado"
        >
          {canEdit
            ? 'Crie o primeiro evento para começar a linha do tempo.'
            : 'Esta timeline ainda não possui eventos públicos.'}
        </Alert>
      ) : visibleEvents.length === 0 ? (
        <Alert variant="light" color="pink" radius={8} title="Sem eventos neste ano">
          Escolha outro ano para continuar navegando pela timeline.
        </Alert>
      ) : (
        <div style={{ position: 'relative' }}>
          <div className="timeline-track">
            {visibleEvents.map((event) => (
              <TimelineCard key={event.id} event={event} onClick={() => setSelectedEvent(event)} />
            ))}
          </div>
        </div>
      )}

      <TimelineEventModal
        coupleId={couple.id}
        event={selectedEvent}
        opened={Boolean(selectedEvent)}
        canEdit={canEdit}
        onClose={() => setSelectedEvent(null)}
        onDeleted={onDeleted}
        onPhotoPreview={setPhotoPreview}
      />

      <Modal
        opened={Boolean(photoPreview)}
        onClose={() => setPhotoPreview(null)}
        centered
        size="auto"
        padding={0}
        zIndex={7000}
        withCloseButton={false}
        overlayProps={{ backgroundOpacity: 0.88, blur: 2 }}
        styles={{
          content: {
            background: 'transparent',
            boxShadow: 'none',
            overflow: 'visible',
          },
          body: { padding: 0 },
        }}
      >
        {photoPreview ? (
          <Image
            src={photoPreview.src}
            alt={photoPreview.alt}
            fit="contain"
            radius={8}
            mah="88vh"
            maw="92vw"
          />
        ) : null}
      </Modal>
    </Stack>
  )
}
