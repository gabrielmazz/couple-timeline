import { Alert, Button, Group, Image, Loader, Modal, Stack, Text } from '@mantine/core'
import { CalendarHeart, Plus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type UIEvent, type WheelEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Couple } from '../../types/database'
import type { TimelineEventWithPhotos, TimelineFilters } from '../../types/timeline'
import { TimelineCard } from './TimelineCard'
import { TimelineEventModal } from './TimelineEventModal'
import { TimelineYearSelector } from './TimelineYearSelector'

import BlurText from '../ui/BlurText'
import CSSBlurText from './../../components/ui/BlurText.module.css'

type PhotoPreview = {
	src: string
	alt: string
}

export function TimelineView({
	couple,
	events,
	years,
	canEdit,
	includesChildren,
	filters,
	isLoading,
	isLoadingMore,
	loadMoreError,
	hasMore,
	onFiltersChange,
	onLoadMore,
	onSelectEvent,
	onDeleted,
}: {
	couple: Couple
	events: TimelineEventWithPhotos[]
	years: number[]
	canEdit: boolean
	includesChildren: boolean
	filters: TimelineFilters
	isLoading: boolean
	isLoadingMore: boolean
	loadMoreError: string | null
	hasMore: boolean
	onFiltersChange: (filters: TimelineFilters) => void
	onLoadMore: () => void
	onSelectEvent: (event: TimelineEventWithPhotos) => Promise<TimelineEventWithPhotos>
	onDeleted: () => void
}) {
	const [selectedEvent, setSelectedEvent] = useState<TimelineEventWithPhotos | null>(null)
	const [photoPreview, setPhotoPreview] = useState<PhotoPreview | null>(null)
	const [loadingEventPhotos, setLoadingEventPhotos] = useState(false)
	const [eventPhotosError, setEventPhotosError] = useState<string | null>(null)
	const selectedEventRequestRef = useRef(0)
	const loadMoreRequestedRef = useRef(false)

	const requestMoreEventsIfNeeded = useCallback((track: HTMLDivElement) => {
		if (!hasMore || isLoadingMore || loadMoreRequestedRef.current) {
			return
		}

		const remainingSpace = track.scrollWidth - track.clientWidth - track.scrollLeft
		const preloadDistance = Math.max(240, track.clientWidth * 0.35)

		if (remainingSpace <= preloadDistance) {
			loadMoreRequestedRef.current = true
			onLoadMore()
		}
	}, [hasMore, isLoadingMore, onLoadMore])

	useEffect(() => {
		loadMoreRequestedRef.current = false
	}, [events.length, filters.month, filters.sortOrder, filters.year, hasMore])

	const handleTimelineScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
		const track = event.currentTarget
		const remainingSpace = track.scrollWidth - track.clientWidth - track.scrollLeft

		if (remainingSpace > Math.max(240, track.clientWidth * 0.35)) {
			loadMoreRequestedRef.current = false
		}

		requestMoreEventsIfNeeded(track)
	}, [requestMoreEventsIfNeeded])

	const handleTimelineWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
		const track = event.currentTarget
		const scrollUnit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? track.clientWidth : 1
		const scrollAmount = (event.deltaY || event.deltaX) * scrollUnit
		const canScrollLeft = scrollAmount < 0 && track.scrollLeft > 0
		const canScrollRight = scrollAmount > 0 && track.scrollLeft < track.scrollWidth - track.clientWidth

		if (canScrollLeft || canScrollRight) {
			event.preventDefault()
			track.scrollBy({ left: scrollAmount, behavior: 'auto' })
		}
	}, [])

	const handleSelectEvent = useCallback((event: TimelineEventWithPhotos) => {
		const requestId = selectedEventRequestRef.current + 1
		selectedEventRequestRef.current = requestId
		setSelectedEvent(event)
		setLoadingEventPhotos(true)
		setEventPhotosError(null)

		void onSelectEvent(event)
			.then((eventWithPhotos) => {
				if (requestId === selectedEventRequestRef.current) {
					setSelectedEvent(eventWithPhotos)
				}
			})
			.catch(() => {
				if (requestId === selectedEventRequestRef.current) {
					setEventPhotosError('Não foi possível carregar as fotos deste evento.')
				}
			})
			.finally(() => {
				if (requestId === selectedEventRequestRef.current) {
					setLoadingEventPhotos(false)
				}
			})
	}, [onSelectEvent])

	const closeSelectedEvent = useCallback(() => {
		selectedEventRequestRef.current += 1
		setSelectedEvent(null)
		setLoadingEventPhotos(false)
		setEventPhotosError(null)
	}, [])

	return (
		<Stack gap="xl" py={{ base: 'lg', sm: 'xl' }}>
			<Group justify="space-between" align="flex-end" gap="lg">
				<Stack gap={6}>
					<Text c="var(--palette-blush)" fw={800} tt="uppercase" size="xs">
						Timeline {couple.visibility === 'public' ? 'pública' : 'privada'}
					</Text>
					<BlurText
						text={couple.name}
						delay={250}
						animateBy="words"
						direction="top"
						className={CSSBlurText.titleBlurTextTimeLineCouple}
					/>
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

			<TimelineYearSelector
				years={years}
				selectedYear={filters.year}
				selectedMonth={filters.month}
				sortOrder={filters.sortOrder}
				onYearChange={(year) => onFiltersChange({ ...filters, year })}
				onMonthChange={(month) => onFiltersChange({ ...filters, month })}
				onSortOrderChange={(sortOrder) => onFiltersChange({ ...filters, sortOrder })}
			/>

			{isLoading && events.length === 0 ? (
				<Group justify="center" py="xl">
					<Loader color="pink" />
				</Group>
			) : events.length === 0 ? (
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
			) : (
				<div style={{ position: 'relative' }}>
					<div
						className="timeline-track"
						onScroll={handleTimelineScroll}
						onWheel={handleTimelineWheel}
						aria-busy={isLoadingMore}
					>
						{events.map((event, index) => (
							<TimelineCard
								key={event.id}
								event={event}
								showSource={includesChildren}
								priority={index < 2}
								onSelect={handleSelectEvent}
							/>
						))}
						{isLoadingMore ? (
							<div className="timeline-load-sentinel" aria-label="Carregando próximos momentos">
								<Loader color="pink" size="sm" />
							</div>
						) : null}
					</div>
				</div>
			)}

			{loadMoreError ? (
				<Alert color="red" radius={8} title="Não foi possível carregar os próximos momentos">
					{loadMoreError}
				</Alert>
			) : null}

			<TimelineEventModal
				event={selectedEvent}
				opened={Boolean(selectedEvent)}
				loadingPhotos={loadingEventPhotos}
				photosError={eventPhotosError}
				canEdit={canEdit}
				showSource={includesChildren}
				onClose={closeSelectedEvent}
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
					<button
						type="button"
						className="timeline-photo-preview-close"
						aria-label="Fechar visualização da imagem"
						onClick={() => setPhotoPreview(null)}
					>
						<Image
							src={photoPreview.src}
							alt={photoPreview.alt}
							fit="contain"
							radius={8}
							mah="88vh"
							maw="92vw"
						/>
					</button>
				) : null}
			</Modal>
		</Stack>
	)
}
