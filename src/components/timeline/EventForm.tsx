import {
	Alert,
	Button,
	Divider,
	Group,
	Paper,
	Select,
	SimpleGrid,
	Stack,
	TagsInput,
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
import {
	createTimelineEvent,
	eventCategories,
	updateTimelineEvent,
} from '../../lib/timeline/actions'
import { getErrorMessage, getYearFromDate } from '../../lib/utils'
import type { TimelineEvent } from '../../types/database'
import type { EventFormModel, EventTimelineDestination, TimelinePhotoWithUrl } from '../../types/timeline'
import { PhotoUploader } from './PhotoUploader'

type EditableEvent = TimelineEvent & {
	photos: TimelinePhotoWithUrl[]
}

export function EventForm({
	coupleId,
	event,
	timelineDestinations = [],
	loadingTimelineDestinations = false,
}: {
	coupleId: string
	event?: EditableEvent
	timelineDestinations?: EventTimelineDestination[]
	loadingTimelineDestinations?: boolean
}) {
	const navigate = useNavigate()
	const [targetTimelineId, setTargetTimelineId] = useState<string | null>(event?.couple_id ?? null)
	const [files, setFiles] = useState<File[]>([])
	const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([])
	const [existingPhotoOrder, setExistingPhotoOrder] = useState<string[]>(
		() => event?.photos.map((photo) => photo.id) ?? [],
	)
	const [coverPhotoPath, setCoverPhotoPath] = useState<string | null>(event?.cover_photo_path ?? null)
	const [coverFileIndex, setCoverFileIndex] = useState<number | null>(null)
	const [saving, setSaving] = useState(false)
	const form = useForm<EventFormModel>({
		initialValues: {
			title: event?.title ?? '',
			subtitle: event?.subtitle ?? '',
			eventDate: event?.event_date ?? new Date().toISOString().slice(0, 10),
			locationName: event?.location_name ?? '',
			eventTime: event?.event_time ?? '',
			category: event?.category ?? '',
			tags: event?.tags ?? [],
			description: event?.description ?? '',
			musicUrl: event?.music_url ?? '',
			coverPhotoPath: event?.cover_photo_path ?? null,
		},
		validate: {
			title: (value) => (value.trim().length < 2 ? 'Informe um título.' : null),
			subtitle: (value) =>
				value.trim().length > 160 ? 'Use até 160 caracteres.' : null,
			eventDate: (value) => (!value ? 'Informe uma data.' : null),
			locationName: (value) =>
				value.trim().length > 120 ? 'Use até 120 caracteres.' : null,
			eventTime: (value) =>
				value.trim().length > 40 ? 'Use até 40 caracteres.' : null,
			tags: (value) =>
				value.length > 8
					? 'Adicione no máximo 8 tags.'
					: value.some((tag) => tag.trim().length > 30)
						? 'Cada tag pode ter até 30 caracteres.'
						: null,
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
	const rootTimelineId = timelineDestinations.find((timeline) => timeline.parent_id === null)?.id ?? coupleId
	const linkedTimelineDestinations = timelineDestinations.filter((timeline) => timeline.parent_id !== null)
	const selectedTimelineId = linkedTimelineDestinations.some((timeline) => timeline.id === targetTimelineId)
		? targetTimelineId
		: null
	const destinationTimelineId = selectedTimelineId ?? rootTimelineId

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
					coupleId: destinationTimelineId,
					sourceCoupleId: coupleId,
					eventId: event.id,
					title: values.title,
					subtitle: values.subtitle,
					eventDate: values.eventDate,
					locationName: values.locationName,
					eventTime: values.eventTime,
					category: values.category,
					tags: values.tags,
					description: values.description,
					musicUrl: values.musicUrl,
					files,
					removedPhotoIds,
					existingPhotoOrder,
					coverPhotoPath,
					coverFileIndex,
				})
			} else {
				await createTimelineEvent({
					coupleId: destinationTimelineId,
					title: values.title,
					subtitle: values.subtitle,
					eventDate: values.eventDate,
					locationName: values.locationName,
					eventTime: values.eventTime,
					category: values.category,
					tags: values.tags,
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
			navigate(`/timeline/${destinationTimelineId}`)
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

					<Divider
						label="Informações principais"
						size="sm"
						color="var(--palette-blush)"
						styles={{
							label: { color: 'var(--palette-blush)' },
						}}
					/>

					<SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
						<TextInput
							label="Título"
							placeholder="Nossa primeira viagem"
							required
							{...form.getInputProps('title')}
						/>
						<TextInput
							label="Subtítulo curto"
							placeholder="Nossa primeira viagem juntos"
							maxLength={160}
							{...form.getInputProps('subtitle')}
						/>
						<DateInput
							label="Data do evento"
							placeholder="Escolha a data"
							valueFormat="DD/MM/YYYY"
							locale="pt-br"
							clearable={false}
							required
							value={form.values.eventDate}
							onChange={(value) => {
								const eventDate = value ?? ''
								form.setFieldValue('eventDate', eventDate)
							}}
							error={form.errors.eventDate}
						/>
						<TextInput
							label="Horário ou período"
							placeholder="19:30 ou Noite"
							maxLength={40}
							{...form.getInputProps('eventTime')}
						/>
						<TextInput
							label="Local do momento"
							placeholder="Gramado, RS"
							maxLength={120}
							{...form.getInputProps('locationName')}
						/>
						<Select
							label="Tipo de momento"
							placeholder="Selecione uma categoria"
							data={[...eventCategories]}
							clearable
							searchable
							{...form.getInputProps('category')}
							value={form.values.category || null}
							onChange={(value) =>
								form.setFieldValue('category', (value ?? '') as EventFormModel['category'])
							}
						/>
						<TextInput label="Ano da timeline" value={String(yearPreview)} readOnly />
						<TextInput
							label="Link de música"
							placeholder="Spotify ou YouTube"
							{...form.getInputProps('musicUrl')}
						/>
					</SimpleGrid>

					<Divider
						label="Timeline vinculada (opcional)"
						size="sm"
						color="var(--palette-blush)"
						styles={{ label: { color: 'var(--palette-blush)' } }}
					/>

					<Select
						label="Adicionar a uma timeline vinculada"
						description="Se não selecionar nenhuma, o evento ficará somente na timeline principal."
						placeholder="Nenhuma timeline vinculada"
						data={linkedTimelineDestinations.map((timeline) => ({
							value: timeline.id,
							label: timeline.name,
						}))}
						value={selectedTimelineId}
						onChange={setTargetTimelineId}
						disabled={loadingTimelineDestinations || linkedTimelineDestinations.length === 0}
						loading={loadingTimelineDestinations}
						clearable
					/>

					<TagsInput
						label="Tags"
						placeholder={form.values.tags.length === 0 ? 'romântico, viagem, surpresa...' : 'Adicionar outra tag'}
						maxTags={8}
						maxLength={30}
						clearable
						splitChars={[',']}
						{...form.getInputProps('tags')}
					/>

					<Divider
						label="História do momento"
						size="sm"
						color="var(--palette-blush)"
						styles={{
							label: { color: 'var(--palette-blush)'},
						}}
					/>

					<Textarea
						label="Descrição longa"
						placeholder="Conte o contexto, as sensações e os detalhes desse momento."
						autosize
						minRows={5}
						maxRows={12}
						{...form.getInputProps('description')}
					/>

					<Divider
						label="Galeria"
						size="sm"
						color="var(--palette-blush)"
						styles={{
							label: { color: 'var(--palette-blush)' },
						}}
					/>

					<Stack gap="xs">
						<Text fw={700}>Fotos do evento</Text>
						<PhotoUploader
							existingPhotos={event?.photos ?? []}
							existingPhotoOrder={existingPhotoOrder}
							removedPhotoIds={removedPhotoIds}
							files={files}
							coverPhotoPath={coverPhotoPath}
							coverFileIndex={coverFileIndex}
							loading={saving}
							onRemovedPhotoIdsChange={setRemovedPhotoIds}
							onExistingPhotoOrderChange={setExistingPhotoOrder}
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

					<Group justify="flex-end" grow>
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
