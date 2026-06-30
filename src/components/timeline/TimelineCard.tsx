import { Badge, Card, Group, Stack, Text, Title } from '@mantine/core'
import { CalendarDays, Clock3, ImageOff, MapPin } from 'lucide-react'
import { memo, useCallback, useState } from 'react'
import { compactText, formatDate } from '../../lib/utils'
import type { TimelineEventWithPhotos } from '../../types/timeline'

type TimelineCardProps = {
    event: TimelineEventWithPhotos
    showSource: boolean
    priority?: boolean
    onSelect: (event: TimelineEventWithPhotos) => void
}

type TimelineCardImageProps = {
    alt: string
    priority: boolean
    src: string
}

function TimelineCardImage({ alt, priority, src }: TimelineCardImageProps) {
    const [imageState, setImageState] = useState({ failed: false, loaded: false, src })
    const loaded = imageState.src === src && imageState.loaded
    const failed = imageState.src === src && imageState.failed

    if (failed) {
        return (
            <Stack className="timeline-card-image-shell timeline-card-image-fallback" align="center" justify="center">
                <ImageOff size={34} />
                <Text size="sm">Imagem indisponível</Text>
            </Stack>
        )
    }

    return (
        <div className="timeline-card-image-shell" aria-busy={!loaded}>
            <div className="timeline-card-image-placeholder" aria-hidden="true" />
            <img
                src={src}
                alt={alt}
                className={`timeline-card-image${loaded ? ' timeline-card-image--loaded' : ''}`}
                loading={priority ? 'eager' : 'lazy'}
                fetchPriority={priority ? 'high' : 'auto'}
                decoding="async"
                onLoad={() => setImageState({ failed: false, loaded: true, src })}
                onError={() => setImageState({ failed: true, loaded: false, src })}
            />
        </div>
    )
}

function TimelineCardComponent({
    event,
    showSource,
    priority = false,
    onSelect,
}: TimelineCardProps) {
    const handleSelect = useCallback(() => {
        onSelect(event)
    }, [event, onSelect])

    return (
        <Card
            className="timeline-card glass-panel"
            radius={8}
            p={0}
            withBorder
            role="button"
            tabIndex={0}
            onClick={handleSelect}
            onKeyDown={(keyboardEvent) => {
                if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                    keyboardEvent.preventDefault()
                    handleSelect()
                }
            }}
            style={{ cursor: 'pointer' }}
        >
            {event.coverUrl ? (
                <TimelineCardImage src={event.coverUrl} alt={event.title} priority={priority} />
            ) : (
                <Stack
                    className="timeline-card-image-shell timeline-card-image-fallback"
                    align="center"
                    justify="center"
                >
                    <ImageOff size={34} />
                    <Text size="sm">Sem imagem</Text>
                </Stack>
            )}

            <Stack gap="sm" p="lg">
                <Group justify="space-between" align="flex-start">
                    <Badge
                        className="mobile-year-marker"
                        color="pink"
                        variant="light"
                        leftSection={<CalendarDays size={13} />}
                    >
                        {formatDate(event.event_date, { day: '2-digit', month: 'short' })}
                    </Badge>
                    {showSource ? (
                        <Badge color="grape" variant="light">
                            {event.sourceTimeline.name}
                        </Badge>
                    ) : null}
                </Group>
                <Stack gap={4}>
                    <Text size="sm" c="var(--palette-blush)" fw={700}>
                        {formatDate(event.event_date)}
                    </Text>
                    <Title order={3} size="h2" lh={1.08}>
                        {event.title}
                    </Title>
                    {event.subtitle ? (
                        <Text c="var(--app-text)" size="md" fw={500}>
                            {event.subtitle}
                        </Text>
                    ) : null}
                    {event.category || event.event_time || event.location_name ? (
                        <Group gap="xs" mt={4}>
                            {event.category ? (
                                <Badge color="pink" variant="light">
                                    {event.category}
                                </Badge>
                            ) : null}
                            {event.event_time ? (
                                <Group gap={5} c="dimmed">
                                    <Clock3 size={14} />
                                    <Text size="xs">{event.event_time}</Text>
                                </Group>
                            ) : null}
                            {event.location_name ? (
                                <Group gap={5} c="dimmed">
                                    <MapPin size={14} />
                                    <Text size="xs">{event.location_name}</Text>
                                </Group>
                            ) : null}
                        </Group>
                    ) : null}
                    {event.description ? (
                        <Text c="dimmed" size="sm" lh={1.55}>
                            {compactText(event.description, 170)}
                        </Text>
                    ) : null}
                    {event.tags?.length ? (
                        <Group gap={6} mt={4}>
                            {event.tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} color="gray" variant="outline" size="sm">
                                    {tag}
                                </Badge>
                            ))}
                            {event.tags.length > 3 ? (
                                <Text size="xs" c="dimmed">
                                    +{event.tags.length - 3}
                                </Text>
                            ) : null}
                        </Group>
                    ) : null}
                </Stack>
            </Stack>
        </Card>
    )
}

export const TimelineCard = memo(TimelineCardComponent)
