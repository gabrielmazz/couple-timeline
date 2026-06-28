import { Alert, Button, Group, Image, Modal, Stack, Text } from '@mantine/core'
import { CalendarHeart, Plus } from 'lucide-react'
import { useMemo, useState, type WheelEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Couple } from '../../types/database'
import type { TimelineEventWithPhotos } from '../../types/timeline'
import { TimelineCard } from './TimelineCard'
import { TimelineEventModal } from './TimelineEventModal'
import { TimelineYearSelector, type TimelineSortOrder } from './TimelineYearSelector'

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
	onDeleted,
}: {
	couple: Couple
	events: TimelineEventWithPhotos[]
	years: number[]
	canEdit: boolean
	includesChildren: boolean
	onDeleted: () => void
}) {
	const [selectedYear, setSelectedYear] = useState<number | null>(years.at(-1) ?? null)
	const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
	const [sortOrder, setSortOrder] = useState<TimelineSortOrder>('asc')
	const [selectedEvent, setSelectedEvent] = useState<TimelineEventWithPhotos | null>(null)
	const [photoPreview, setPhotoPreview] = useState<PhotoPreview | null>(null)

	const handleTimelineWheel = (event: WheelEvent<HTMLDivElement>) => {
		const track = event.currentTarget
		const scrollAmount = event.deltaY || event.deltaX
		const canScrollLeft = scrollAmount < 0 && track.scrollLeft > 0
		const canScrollRight = scrollAmount > 0 && track.scrollLeft < track.scrollWidth - track.clientWidth

		if (canScrollLeft || canScrollRight) {
			event.preventDefault()
			track.scrollLeft += scrollAmount
		}
	}

	const visibleEvents = useMemo(() => {
		const filteredEvents = events.filter((event) => {
			const eventMonth = Number(event.event_date.slice(5, 7))

			return (
				(selectedYear === null || event.year === selectedYear) &&
				(selectedMonth === null || eventMonth === selectedMonth)
			)
		})

		return filteredEvents.toSorted((first, second) => {
			const comparison = first.event_date.localeCompare(second.event_date)
			return sortOrder === 'asc' ? comparison : -comparison
		})
	}, [events, selectedMonth, selectedYear, sortOrder])

	return (
		<Stack gap="xl" py={{ base: 'lg', sm: 'xl' }}>
			<Group justify="space-between" align="flex-end" gap="lg">
				<Stack gap={6}>
					<Text c="var(--palette-blush)" fw={800} tt="uppercase" size="xs">
						Timeline {couple.visibility === 'public' ? 'pública' : 'privada'}
					</Text>
					{/* <Title order={1} size="clamp(2.2rem, 7vw, 5.4rem)" lh={0.92}>
						{couple.name}
					</Title> */}
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
				selectedYear={selectedYear}
				selectedMonth={selectedMonth}
				sortOrder={sortOrder}
				onYearChange={setSelectedYear}
				onMonthChange={setSelectedMonth}
				onSortOrderChange={setSortOrder}
			/>

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
				<Alert variant="light" color="pink" radius={8} title="Nenhum evento encontrado">
					Escolha outro ano ou mês para continuar navegando pela timeline.
				</Alert>
			) : (
				<div style={{ position: 'relative' }}>
					<div className="timeline-track" onWheel={handleTimelineWheel}>
						{visibleEvents.map((event) => (
							<TimelineCard
								key={event.id}
								event={event}
								showSource={includesChildren}
								onClick={() => setSelectedEvent(event)}
							/>
						))}
					</div>
				</div>
			)}

			<TimelineEventModal
				event={selectedEvent}
				opened={Boolean(selectedEvent)}
				canEdit={canEdit}
				showSource={includesChildren}
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
