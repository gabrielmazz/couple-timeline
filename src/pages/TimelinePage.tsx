import { Alert, Button, Card, Container, Group, Loader, SimpleGrid, Stack, Text } from '@mantine/core'
import { RefreshCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAppBackground } from '../components/layout/AppBackgroundContext'
import { TimelineView } from '../components/timeline/TimelineView'
import Counter from '../components/ui/Counter'
import { getTimelineBackgroundImages } from '../lib/timeline/background'
import { fetchTimeline } from '../lib/timeline/queries'
import { getErrorMessage, getRelationshipDays } from '../lib/utils'
import type { TimelinePayload } from '../types/timeline'

export function TimelinePage() {
	const { coupleId } = useParams()
	const { backgroundImages, setBackgroundImages } = useAppBackground()
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

	const timelineBackgroundImages = useMemo(() => {
		if (!payload) {
			return []
		}

		return getTimelineBackgroundImages(payload.events)
	}, [payload])

	const relationshipDays = payload?.couple.relationship_started_at
		? getRelationshipDays(payload.couple.relationship_started_at)
		: null

	const currentMonthEventsCount = useMemo(() => {
		if (!payload) {
			return 0
		}

		const today = new Date()
		const currentYear = today.getFullYear()
		const currentMonth = today.getMonth() + 1

		return payload.events.filter((event) => {
			const [eventYear, eventMonth] = event.event_date.split('-').map(Number)

			return eventYear === currentYear && eventMonth === currentMonth
		}).length
	}, [payload])

	useEffect(() => {
		if (backgroundImages.length > 0 || timelineBackgroundImages.length === 0) {
			return
		}

		setBackgroundImages(timelineBackgroundImages)
	}, [backgroundImages.length, setBackgroundImages, timelineBackgroundImages])

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
				<>
					<TimelineView
						couple={payload.couple}
						events={payload.events}
						years={payload.years}
						canEdit={payload.canEdit}
						includesChildren={payload.includesChildren}
						onDeleted={() => void loadTimeline()}
					/>

					{relationshipDays !== null ? (
						<Stack gap="lg" pb="xl">
							<Card className="timeline-card timeline-stats-card glass-panel" radius={8} p="xl" withBorder>
								<SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl">
									<Stack align="center" gap={6}>
										<Text c="dimmed" fw={700} tt="uppercase" size="xs">
											Nossa história já dura
										</Text>
										<div aria-label={`${relationshipDays} ${relationshipDays === 1 ? 'dia' : 'dias'} de relacionamento`}>
											<Counter
												value={relationshipDays}
												fontSize={64}
												gap={2}
												horizontalPadding={4}
												fontWeight={800}
												textColor="var(--palette-blush)"
											/>
										</div>
										<Text c="dimmed" size="sm">
											{relationshipDays === 1 ? 'dia juntos' : 'dias juntos'}
										</Text>
									</Stack>
									<Stack align="center" gap={6}>
										<Text c="dimmed" fw={700} tt="uppercase" size="xs">
											Registros deste mês
										</Text>
										<div
											aria-label={`${currentMonthEventsCount} ${
												currentMonthEventsCount === 1 ? 'evento registrado' : 'eventos registrados'
											} no mês atual`}
										>
											<Counter
												value={currentMonthEventsCount}
												fontSize={64}
												gap={2}
												horizontalPadding={4}
												fontWeight={800}
												textColor="var(--palette-blush)"
											/>
										</div>
										<Text c="dimmed" size="sm">
											{currentMonthEventsCount === 1 ? 'evento neste mês' : 'eventos neste mês'}
										</Text>
									</Stack>
								</SimpleGrid>
							</Card>
						</Stack>
					) : null}
				</>
			) : null}
		</Container>
	)
}
