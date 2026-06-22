import {
	ActionIcon,
	Badge,
	Button,
	Divider,
	Group,
	Image,
	Modal,
	ScrollArea,
	SimpleGrid,
	Stack,
	Text,
	Title,
} from '@mantine/core'
import { Carousel } from '@mantine/carousel'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useMediaQuery } from '@mantine/hooks'
import type { EmblaCarouselType } from 'embla-carousel'
import { CalendarDays, Clock3, Edit, MapPin, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteTimelineEvent } from '../../lib/timeline/actions'
import { formatDate, getErrorMessage } from '../../lib/utils'
import type { TimelineEventWithPhotos } from '../../types/timeline'
import { MusicEmbed } from './MusicEmbed'

type PhotoPreview = {
	src: string
	alt: string
}

export function TimelineEventModal({
	coupleId,
	event,
	opened,
	canEdit,
	onClose,
	onDeleted,
	onPhotoPreview,
}: {
	coupleId: string
	event: TimelineEventWithPhotos | null
	opened: boolean
	canEdit: boolean
	onClose: () => void
	onDeleted: () => void
	onPhotoPreview: (photo: PhotoPreview) => void
}) {
	const navigate = useNavigate()
	const isMobile = useMediaQuery('(max-width: 760px)')
	const [deleting, setDeleting] = useState(false)
	const [embla, setEmbla] = useState<EmblaCarouselType | null>(null)
	const photoSlides = event?.photos.filter((photo) => photo.signedUrl) ?? []

	useEffect(() => {
		if (!opened || photoSlides.length < 2 || !embla) {
			return undefined
		}

		const autoplay = window.setInterval(() => {
			embla.scrollNext()
		}, 4200)

		return () => window.clearInterval(autoplay)
	}, [embla, opened, photoSlides.length])

	if (!event) {
		return null
	}

	const activeEvent = event

	function confirmDelete() {
		const eventId = activeEvent.id

		modals.openConfirmModal({
			title: 'Excluir evento',
			centered: true,
			children: (
				<Text size="sm">
					Esta ação remove o evento, suas fotos no Storage e os registros relacionados.
				</Text>
			),
			labels: { confirm: 'Excluir', cancel: 'Cancelar' },
			confirmProps: { color: 'red', loading: deleting },
			onConfirm: async () => {
				setDeleting(true)

				try {
					await deleteTimelineEvent(eventId)
					notifications.show({
						color: 'green',
						title: 'Evento excluído',
						message: 'A timeline foi atualizada.',
					})
					onClose()
					onDeleted()
				} catch (error) {
					notifications.show({
						color: 'red',
						title: 'Erro ao excluir',
						message: getErrorMessage(error),
					})
				} finally {
					setDeleting(false)
				}
			},
		})
	}

	return (
		<Modal
			opened={opened}
			onClose={onClose}
			fullScreen={isMobile}
			size="xl"
			radius={8}
			padding={0}
			withCloseButton={false}
			styles={{
				content: { background: 'var(--app-panel-solid)' },
				body: { padding: 0 },
			}}
		>
			<ScrollArea.Autosize mah={isMobile ? '100vh' : '86vh'}>
				<Stack gap={0} pos="relative">
					<ActionIcon
						className="timeline-event-modal-close"
						variant="transparent"
						onClick={onClose}
						aria-label="Fechar modal"
					>
						<X size={20} />
					</ActionIcon>

					{photoSlides.length > 1 ? (
						<Carousel
							withIndicators
							height={isMobile ? 320 : 460}
							emblaOptions={{ loop: true }}
							getEmblaApi={setEmbla}
						>
							{photoSlides.map((photo) => (
								<Carousel.Slide key={photo.id}>
									<button
										type="button"
										className="timeline-event-photo-button timeline-event-photo-button--hero"
										aria-label={`Ampliar imagem ${photo.caption || activeEvent.title}`}
										onClick={() =>
											onPhotoPreview({
												src: photo.signedUrl!,
												alt: photo.caption || activeEvent.title,
											})
										}
									>
										<Image
											src={photo.signedUrl}
											alt={photo.caption || activeEvent.title}
											h="100%"
											fit="cover"
										/>
									</button>
								</Carousel.Slide>
							))}
						</Carousel>
					) : photoSlides[0] ? (
						<button
							type="button"
							className="timeline-event-photo-button"
							style={{ height: isMobile ? 320 : 460 }}
							aria-label={`Ampliar imagem ${photoSlides[0].caption || activeEvent.title}`}
							onClick={() =>
								onPhotoPreview({
									src: photoSlides[0].signedUrl!,
									alt: photoSlides[0].caption || activeEvent.title,
								})
							}
						>
							<Image
								src={photoSlides[0].signedUrl}
								alt={photoSlides[0].caption || activeEvent.title}
								h="100%"
								fit="cover"
							/>
						</button>
					) : null}

					<Stack gap="lg" p={{ base: 'md', sm: 'xl' }}>
						<Stack gap="sm">
							<Group gap="xs">
								<Badge
									color="pink"
									variant="light"
									leftSection={<CalendarDays size={13} />}
								>
									{formatDate(activeEvent.event_date)}
								</Badge>
								{activeEvent.category ? (
									<Badge color="grape" variant="light">
										{activeEvent.category}
									</Badge>
								) : null}
							</Group>
							<Title order={2}>{activeEvent.title}</Title>
							{activeEvent.subtitle ? (
								<Text size="lg" c="var(--palette-blush)" fw={500}>
									{activeEvent.subtitle}
								</Text>
							) : null}
							{activeEvent.event_time || activeEvent.location_name ? (
								<Group gap="lg" c="dimmed">
									{activeEvent.event_time ? (
										<Group gap={6}>
											<Clock3 size={17} />
											<Text size="sm">{activeEvent.event_time}</Text>
										</Group>
									) : null}
									{activeEvent.location_name ? (
										<Group gap={6}>
											<MapPin size={17} />
											<Text size="sm">{activeEvent.location_name}</Text>
										</Group>
									) : null}
								</Group>
							) : null}
							{activeEvent.tags?.length ? (
								<Group gap={6}>
									{activeEvent.tags.map((tag) => (
										<Badge key={tag} color="gray" variant="outline">
											{tag}
										</Badge>
									))}
								</Group>
							) : null}
							{activeEvent.description ? (
								<Text c="dimmed" lh={1.7} mt="xs" style={{ whiteSpace: 'pre-wrap' }}>
									{activeEvent.description}
								</Text>
							) : null}
						</Stack>



						{activeEvent.photos.length > 1 ? (
							<>
								<Divider
									label="❤"
									size="sm"
									color="var(--palette-blush)"
									styles={{
										label: { color: 'var(--palette-blush)' },
									}}
								/>

								<SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
									{activeEvent.photos.map((photo) =>
										photo.signedUrl ? (
											<button
												key={photo.id}
												type="button"
												className="timeline-event-photo-button"
												style={{ height: 130, borderRadius: 8 }}
												aria-label={`Ampliar imagem ${photo.caption || activeEvent.title}`}
												onClick={() =>
													onPhotoPreview({
														src: photo.signedUrl!,
														alt: photo.caption || activeEvent.title,
													})
												}
											>
												<Image
													src={photo.signedUrl}
													alt={photo.caption || activeEvent.title}
													radius={8}
													h="100%"
													fit="cover"
												/>
											</button>
										) : null,
									)}
								</SimpleGrid>
							</>
						) : null}

						{activeEvent.music_url ? (
							<>
								<Divider
									label="𝄞"
									size="sm"
									color="var(--palette-blush)"
									styles={{
										label: { color: 'var(--palette-blush)' },
									}}
								/>
								<MusicEmbed url={activeEvent.music_url} />
							</>
						) : null}

						{canEdit ? (
							<>
								<Divider
									label="❤"
									size="sm"
									color="var(--palette-blush)"
									styles={{
										label: { color: 'var(--palette-blush)' },
									}}
								/>
								<Group justify="flex-end" grow >
									<Button
										variant="light"
										color="pink"
										leftSection={<Edit size={16} />}
										onClick={() => navigate(`/timeline/${coupleId}/eventos/${activeEvent.id}/editar`)}
									>
										Editar
									</Button>
									<Button
										color="red"
										variant="light"
										leftSection={<Trash2 size={16} />}
										loading={deleting}
										onClick={confirmDelete}
									>
										Excluir
									</Button>
								</Group>
							</>
						) : null}
					</Stack>
				</Stack>
			</ScrollArea.Autosize>
		</Modal>
	)
}
