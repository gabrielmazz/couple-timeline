import {
	ActionIcon,
	Badge,
	Button,
	Group,
	Image,
	Modal,
	ScrollArea,
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

import BlurText from './../../components/ui/BlurText'
import CSSBlurText from './../../components/ui/BlurText.module.css'
import Folder from './../../components/ui/Folder'
import ScrollStack, { ScrollStackItem } from './../../components/ui/ScrollStack'
import TextType from './../../components/ui/TextType'

type PhotoPreview = {
	src: string
	alt: string
}

export function TimelineEventModal({
	event,
	opened,
	canEdit,
	showSource,
	onClose,
	onDeleted,
	onPhotoPreview,
}: {
	event: TimelineEventWithPhotos | null
	opened: boolean
	canEdit: boolean
	showSource: boolean
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
			classNames={{
				content: 'timeline-event-modal-content',
				body: 'timeline-event-modal-body',
			}}
			styles={{
				content: { background: 'transparent' },
				body: { padding: 0 },
			}}
		>
			<ScrollArea.Autosize mah={isMobile ? 'calc(100vh - 6px)' : '86vh'}>
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
							<BlurText
								segments={[
									<Badge
										key="date"
										color="pink"
										variant="light"
										leftSection={<CalendarDays size={13} />}
									>
										{formatDate(activeEvent.event_date)}
									</Badge>,
									showSource ? (
										<Badge key="source" color="grape" variant="light">
											{activeEvent.sourceTimeline.name}
										</Badge>
									) : null,
									activeEvent.category ? (
										<Badge key="category" color="grape" variant="light">
											{activeEvent.category}
										</Badge>
									) : null,
								].filter(Boolean)}
								delay={100}
								direction="top"
								className={CSSBlurText.badgesBlurText}
							/>

							<BlurText
								text={activeEvent.title}
								delay={250}
								animateBy="words"
								direction="top"
								className={CSSBlurText.titleBlurText}
							/>

							{activeEvent.subtitle ? (
								<BlurText
									text={activeEvent.subtitle}
									delay={150}
									animateBy="words"
									direction="bottom"
									className={CSSBlurText.subtitleBlurText}
								/>
							) : null}

							{activeEvent.event_time || activeEvent.location_name ? (
								<Group gap="lg" c="dimmed">
									{activeEvent.event_time ? (
										<BlurText
											segments={[
												<Clock3 key="icon" size={17} />,
												'\u00A0',
												...activeEvent.event_time.split(''),
											]}
											delay={50}
											animateBy="letters"
											direction="bottom"
											className={CSSBlurText.infoBlurText}
										/>
									) : null}
									{activeEvent.location_name ? (
										<BlurText
											segments={[
												<MapPin key="icon" size={17} />,
												'\u00A0',
												...activeEvent.location_name
													.split(' ')
													.flatMap((word, index) => (index === 0 ? [word] : ['\u00A0', word])),
											]}
											delay={50}
											animateBy="words"
											direction="bottom"
											className={CSSBlurText.infoBlurText}
										/>
									) : null}
								</Group>
							) : null}
							{activeEvent.tags?.length ? (
								<BlurText
									segments={activeEvent.tags.map((tag) => (
										<Badge key={tag} color="gray" variant="outline">
											{tag}
										</Badge>
									))}
									delay={80}
									direction="bottom"
									className={CSSBlurText.tagsBlurText}
								/>
							) : null}
							{activeEvent.description ? (
								<TextType
									text={activeEvent.description}
									typingSpeed={20}
									pauseDuration={1500}
									showCursor
									cursorCharacter="●"
									loop={false}
									deletingSpeed={50}
									cursorBlinkDuration={0.5}
								/>
							) : null}
						</Stack>

						{photoSlides.length > 1 || activeEvent.music_url ? (
							<ScrollStack
								className="timeline-event-scroll-stack"
								itemDistance={isMobile ? 24 : 32}
								itemStackDistance={isMobile ? 16 : 22}
								stackPosition="8%"
								scaleEndPosition="4%"
								baseScale={0.9}
								itemScale={0.04}
								blurAmount={0.35}
								style={{ height: isMobile ? 300 : 350 }}
								innerStyle={{
									minHeight: 'auto',
									padding: isMobile ? '8px 0 48px' : '8px 8px 56px',
								}}
							>
								{photoSlides.length > 1 ? (
									<ScrollStackItem
										itemClassName="timeline-event-stack-card"
										itemStyle={{
											height: isMobile ? 178 : 210,
											margin: '0 0 18px',
											padding: isMobile ? 16 : 24,
											borderRadius: 8,
										}}
									>
										<Stack h="100%" justify="flex-start" gap={0}>
											<Title
												order={3}
												className="timeline-event-stack-title"
											>
												Imagens do evento
											</Title>

											<Group className="timeline-event-folder-group" justify="center">
												<Folder
													color="var(--palette-rose)"
													size={isMobile ? 1 : 1.35}
													items={photoSlides.map((photo) => (
														<button
															key={photo.id}
															type="button"
															className="timeline-event-photo-button"
															style={{
																width: '100%',
																height: '100%',
																borderRadius: 10,
																overflow: 'hidden',
															}}
															aria-label={`Ampliar imagem ${photo.caption || activeEvent.title}`}
															onClick={(event) => {
																event.stopPropagation()
																onPhotoPreview({
																	src: photo.signedUrl!,
																	alt: photo.caption || activeEvent.title,
																})
															}}
														>
															<Image
																src={photo.signedUrl}
																alt={photo.caption || activeEvent.title}
																h="100%"
																w="100%"
																fit="cover"
															/>
														</button>
													))}
												/>
											</Group>
										</Stack>
									</ScrollStackItem>
								) : null}

								{activeEvent.music_url ? (
									<ScrollStackItem
										itemClassName="timeline-event-stack-card"
										itemStyle={{
											height: isMobile ? 230 : 260,
											margin: '0 0 18px',
											padding: isMobile ? 16 : 24,
											borderRadius: 8,
										}}
									>
										<Stack h="100%" justify="space-between" gap="md">
											<Title
												order={3}
												className="timeline-event-stack-title"
											>
												Trilha sonora
											</Title>

											<MusicEmbed url={activeEvent.music_url} />
										</Stack>
									</ScrollStackItem>
								) : null}
							</ScrollStack>
						) : null}

						{canEdit ? (
							<>
								<Group justify="flex-end" grow >
									<Button
										variant="light"
										color="pink"
										leftSection={<Edit size={16} />}
										onClick={() => navigate(`/timeline/${activeEvent.couple_id}/eventos/${activeEvent.id}/editar`)}
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
