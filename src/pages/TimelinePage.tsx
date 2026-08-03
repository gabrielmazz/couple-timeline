import { Alert, Button, Card, Container, Group, Loader, SimpleGrid, Stack, Text } from '@mantine/core'
import { RefreshCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAppBackground } from '../components/layout/AppBackgroundContext'
import { TimelineView } from '../components/timeline/TimelineView'
import Counter from '../components/ui/Counter'
import { getTimelineBackgroundImages } from '../lib/timeline/background'
import { fetchTimeline, fetchTimelineEventPhotos } from '../lib/timeline/queries'
import { getErrorMessage, getRelationshipDays } from '../lib/utils'
import type { TimelineCursor, TimelineFilters, TimelinePage as TimelinePageData } from '../types/timeline'

function getInitialFilters(): TimelineFilters {
	const now = new Date()

	return {
		year: now.getFullYear(),
		month: now.getMonth() + 1,
		sortOrder: 'asc',
	}
}

type TimelineLoadRequest = {
	append?: boolean
	cursor?: TimelineCursor | null
	filters: TimelineFilters
}

export function TimelinePage() {
	const { coupleId } = useParams()
	const { backgroundImages, setBackgroundImages } = useAppBackground()
	const [payload, setPayload] = useState<TimelinePageData | null>(null)
	const [filters, setFilters] = useState<TimelineFilters>(getInitialFilters)
	const [loading, setLoading] = useState(true)
	const [loadingMore, setLoadingMore] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
	const requestIdRef = useRef(0)

	const loadTimeline = useCallback(async ({ filters: nextFilters, cursor = null, append = false }: TimelineLoadRequest) => {
		if (!coupleId) {
			setError('Timeline inválida.')
			setLoading(false)
			return
		}

		const requestId = requestIdRef.current + 1
		requestIdRef.current = requestId

		if (append) {
			setLoadingMore(true)
			setLoadMoreError(null)
		} else {
			setLoading(true)
		}

		setError(null)

		try {
			const page = await fetchTimeline(coupleId, { filters: nextFilters, cursor })

			if (requestId !== requestIdRef.current) {
				return
			}

			setFilters(nextFilters)
			setPayload((currentPayload) =>
				append && currentPayload
					? {
						...page,
						events: [...currentPayload.events, ...page.events],
						years: currentPayload.years,
						currentMonthEventCount: currentPayload.currentMonthEventCount,
					}
					: page,
			)
		} catch (loadError) {
			if (requestId !== requestIdRef.current) {
				return
			}

			if (append) {
				setLoadMoreError(getErrorMessage(loadError, 'Não foi possível carregar mais momentos.'))
			} else {
				setPayload(null)
				setError(getErrorMessage(loadError, 'Não foi possível carregar a timeline.'))
			}
		} finally {
			if (requestId === requestIdRef.current) {
				setLoading(false)
				setLoadingMore(false)
			}
		}
	}, [coupleId])

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void loadTimeline({ filters: getInitialFilters() })
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

	useEffect(() => {
		if (backgroundImages.length > 0 || timelineBackgroundImages.length === 0) {
			return
		}

		setBackgroundImages(timelineBackgroundImages)
	}, [backgroundImages.length, setBackgroundImages, timelineBackgroundImages])

	return (
		<Container size="lg">
			{loading && !payload ? (
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
						<Button
							color="pink"
							leftSection={<RefreshCcw size={16} />}
							onClick={() => void loadTimeline({ filters })}
						>
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
						filters={filters}
						isLoading={loading}
						isLoadingMore={loadingMore}
						loadMoreError={loadMoreError}
						hasMore={Boolean(payload.nextCursor)}
						onFiltersChange={(nextFilters) => void loadTimeline({ filters: nextFilters })}
						onLoadMore={() =>
							payload.nextCursor
								? void loadTimeline({ filters, cursor: payload.nextCursor, append: true })
								: undefined
						}
						onSelectEvent={fetchTimelineEventPhotos}
						onDeleted={() => void loadTimeline({ filters })}
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
											aria-label={`${payload.currentMonthEventCount} ${
												payload.currentMonthEventCount === 1 ? 'evento registrado' : 'eventos registrados'
											} no mês atual`}
										>
											<Counter
												value={payload.currentMonthEventCount}
												fontSize={64}
												gap={2}
												horizontalPadding={4}
												fontWeight={800}
												textColor="var(--palette-blush)"
											/>
										</div>
										<Text c="dimmed" size="sm">
											{payload.currentMonthEventCount === 1 ? 'evento neste mês' : 'eventos neste mês'}
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
