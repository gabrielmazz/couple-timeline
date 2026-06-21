import { Badge, Card, Group, Image, Stack, Text, Title } from '@mantine/core'
import { CalendarDays, ImageOff } from 'lucide-react'
import { compactText, formatDate } from '../../lib/utils'
import type { TimelineEventWithPhotos } from '../../types/timeline'

export function TimelineCard({
    event,
    onClick,
}: {
    event: TimelineEventWithPhotos
    onClick: () => void
}) {
    return (
        <Card
            className="timeline-card glass-panel"
            radius={8}
            p={0}
            withBorder
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(keyboardEvent) => {
                if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                    keyboardEvent.preventDefault()
                    onClick()
                }
            }}
            style={{ overflow: 'hidden', cursor: 'pointer' }}
        >
            {event.coverUrl ? (
                <Image src={event.coverUrl} alt={event.title} className="timeline-card-image" />
            ) : (
                <Stack
                    className="timeline-card-image"
                    align="center"
                    justify="center"
                    bg="rgba(255,255,255,0.06)"
                    c="dimmed"
                >
                    <ImageOff size={34} />
                    <Text size="sm">Sem imagem</Text>
                </Stack>
            )}

            <Stack gap="sm" p="lg">
                <Group justify="space-between" align="flex-start">
                    <Badge color="pink" variant="filled" size="xl" radius="sm">
                        {event.year}
                    </Badge>
                    <Badge
                        className="mobile-year-marker"
                        color="pink"
                        variant="light"
                        leftSection={<CalendarDays size={13} />}
                    >
                        {formatDate(event.event_date, { day: '2-digit', month: 'short' })}
                    </Badge>
                </Group>
                <Stack gap={4}>
                    <Text size="sm" c="var(--palette-blush)" fw={700}>
                        {formatDate(event.event_date)}
                    </Text>
                    <Title order={3} size="h2" lh={1.08}>
                        {event.title}
                    </Title>
                    {event.description ? (
                        <Text c="dimmed" size="sm" lh={1.55}>
                            {compactText(event.description, 170)}
                        </Text>
                    ) : null}
                </Stack>
            </Stack>
        </Card>
    )
}
