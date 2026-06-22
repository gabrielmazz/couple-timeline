import {
	ActionIcon,
	Badge,
	Card,
	Group,
	Image,
	Radio,
	SimpleGrid,
	Stack,
	Text,
} from '@mantine/core'
import { Dropzone } from '@mantine/dropzone'
import { notifications } from '@mantine/notifications'
import { ChevronLeft, ChevronRight, GripVertical, ImagePlus, Trash2, UploadCloud } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE, validateImageFiles } from '../../lib/timeline/storage'
import type { TimelinePhotoWithUrl } from '../../types/timeline'

type PreviewFile = {
	file: File
	url: string
}

export function PhotoUploader({
	existingPhotos,
	existingPhotoOrder,
	removedPhotoIds,
	files,
	coverPhotoPath,
	coverFileIndex,
	loading,
	onRemovedPhotoIdsChange,
	onExistingPhotoOrderChange,
	onFilesChange,
	onCoverPhotoPathChange,
	onCoverFileIndexChange,
}: {
	existingPhotos: TimelinePhotoWithUrl[]
	existingPhotoOrder: string[]
	removedPhotoIds: string[]
	files: File[]
	coverPhotoPath: string | null
	coverFileIndex: number | null
	loading: boolean
	onRemovedPhotoIdsChange: (ids: string[]) => void
	onExistingPhotoOrderChange: (ids: string[]) => void
	onFilesChange: (files: File[]) => void
	onCoverPhotoPathChange: (path: string | null) => void
	onCoverFileIndexChange: (index: number | null) => void
}) {
	const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null)
	const photoOrderIndex = new Map(existingPhotoOrder.map((photoId, index) => [photoId, index]))
	const visibleExistingPhotos = existingPhotos
		.filter((photo) => !removedPhotoIds.includes(photo.id))
		.toSorted(
			(first, second) =>
				(photoOrderIndex.get(first.id) ?? Number.MAX_SAFE_INTEGER) -
				(photoOrderIndex.get(second.id) ?? Number.MAX_SAFE_INTEGER),
		)
	const previews = useMemo<PreviewFile[]>(
		() =>
			files.map((file) => ({
				file,
				url: URL.createObjectURL(file),
			})),
		[files],
	)

	useEffect(() => {
		return () => {
			previews.forEach((preview) => URL.revokeObjectURL(preview.url))
		}
	}, [previews])

	function addFiles(nextFiles: File[]) {
		const validationError = validateImageFiles(nextFiles)

		if (validationError) {
			notifications.show({
				color: 'red',
				title: 'Imagem inválida',
				message: validationError,
			})
			return
		}

		const mergedFiles = [...files, ...nextFiles]
		onFilesChange(mergedFiles)

		if (!coverPhotoPath && coverFileIndex === null && visibleExistingPhotos.length === 0) {
			onCoverFileIndexChange(files.length)
		}
	}

	function removeExisting(photo: TimelinePhotoWithUrl) {
		onRemovedPhotoIdsChange([...removedPhotoIds, photo.id])
		onExistingPhotoOrderChange(existingPhotoOrder.filter((photoId) => photoId !== photo.id))

		if (coverPhotoPath === photo.storage_path) {
			onCoverPhotoPathChange(null)
		}
	}

	function moveExistingPhoto(photoId: string, targetIndex: number) {
		const visibleIds = visibleExistingPhotos.map((photo) => photo.id)
		const currentIndex = visibleIds.indexOf(photoId)

		if (currentIndex < 0 || targetIndex < 0 || targetIndex >= visibleIds.length || currentIndex === targetIndex) {
			return
		}

		const nextVisibleIds = [...visibleIds]
		nextVisibleIds.splice(currentIndex, 1)
		nextVisibleIds.splice(targetIndex, 0, photoId)
		onExistingPhotoOrderChange(nextVisibleIds)
	}

	function moveDraggedPhoto(targetPhotoId: string) {
		if (!draggedPhotoId || draggedPhotoId === targetPhotoId) {
			return
		}

		const targetIndex = visibleExistingPhotos.findIndex((photo) => photo.id === targetPhotoId)
		moveExistingPhoto(draggedPhotoId, targetIndex)
	}

	function removeNew(index: number) {
		const nextFiles = files.filter((_file, fileIndex) => fileIndex !== index)
		onFilesChange(nextFiles)

		if (coverFileIndex === index) {
			onCoverFileIndexChange(null)
			return
		}

		if (coverFileIndex !== null && coverFileIndex > index) {
			onCoverFileIndexChange(coverFileIndex - 1)
		}
	}

	return (
		<Stack gap="md">
			<Dropzone
				loading={loading}
				accept={ACCEPTED_IMAGE_TYPES}
				maxSize={MAX_IMAGE_SIZE}
				onDrop={addFiles}
				onReject={() => {
					notifications.show({
						color: 'red',
						title: 'Arquivo recusado',
						message: 'Use imagens JPG, PNG ou WebP com até 5MB.',
					})
				}}
				radius="sm"
				p="xl"
			>
				<Group justify="center" gap="md" mih={120} style={{ pointerEvents: 'none' }}>
					<Dropzone.Accept>
						<UploadCloud size={34} color="var(--palette-rose)" />
					</Dropzone.Accept>
					<Dropzone.Reject>
						<Trash2 size={34} color="var(--app-danger)" />
					</Dropzone.Reject>
					<Dropzone.Idle>
						<ImagePlus size={34} color="var(--palette-blush)" />
					</Dropzone.Idle>
					<Stack gap={4} align="center">
						<Text fw={700}>Arraste fotos ou clique para selecionar</Text>
						<Text size="sm" c="dimmed">
							JPG, PNG ou WebP. Máximo de 5MB por imagem.
						</Text>
					</Stack>
				</Group>
			</Dropzone>

			{visibleExistingPhotos.length > 0 || previews.length > 0 ? (
				<Stack gap="xs">
					<SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
						{visibleExistingPhotos.map((photo, index) => (
							<Card
								key={photo.id}
								className="event-photo-sortable"
								data-dragging={draggedPhotoId === photo.id || undefined}
								radius={8}
								p={6}
								withBorder
								bg="rgba(255,255,255,0.04)"
								draggable={!loading}
								onDragStart={(dragEvent) => {
									setDraggedPhotoId(photo.id)
									dragEvent.dataTransfer.effectAllowed = 'move'
									dragEvent.dataTransfer.setData('text/plain', photo.id)
								}}
								onDragEnter={() => moveDraggedPhoto(photo.id)}
								onDragOver={(dragEvent) => {
									dragEvent.preventDefault()
									dragEvent.dataTransfer.dropEffect = 'move'
								}}
								onDrop={(dragEvent) => {
									dragEvent.preventDefault()
									moveDraggedPhoto(photo.id)
									setDraggedPhotoId(null)
								}}
								onDragEnd={() => setDraggedPhotoId(null)}
							>
								<Stack gap={6}>
									<div className="event-photo-sortable-preview">
										{photo.signedUrl ? (
											<Image src={photo.signedUrl} alt={photo.caption || 'Foto do evento'} h={130} fit="cover" radius={8} />
										) : null}
										<Badge className="event-photo-position" color="dark" variant="filled" size="sm">
											{index + 1}
										</Badge>
										<GripVertical className="event-photo-drag-handle" size={22} aria-hidden />
									</div>
									<Group justify="space-between" gap={6} wrap="nowrap">
										<Radio
											label="Capa"
											color="pink"
											checked={coverPhotoPath === photo.storage_path}
											onChange={() => {
												onCoverPhotoPathChange(photo.storage_path)
												onCoverFileIndexChange(null)
											}}
										/>
										<ActionIcon
											color="red"
											variant="subtle"
											aria-label="Remover foto"
											onClick={() => removeExisting(photo)}
										>
											<Trash2 size={16} />
										</ActionIcon>
									</Group>
									<Group gap={4} grow hiddenFrom="sm">
										<ActionIcon
											variant="subtle"
											color="gray"
											disabled={index === 0 || loading}
											aria-label="Mover foto para a esquerda"
											onClick={() => moveExistingPhoto(photo.id, index - 1)}
										>
											<ChevronLeft size={16} />
										</ActionIcon>
										<ActionIcon
											variant="subtle"
											color="gray"
											disabled={index === visibleExistingPhotos.length - 1 || loading}
											aria-label="Mover foto para a direita"
											onClick={() => moveExistingPhoto(photo.id, index + 1)}
										>
											<ChevronRight size={16} />
										</ActionIcon>
									</Group>
								</Stack>
							</Card>
						))}

						{previews.map((preview, index) => (
							<Card key={`${preview.file.name}-${index}`} radius={8} p={6} withBorder bg="rgba(255,255,255,0.04)">
								<Stack gap={6}>
									<Image src={preview.url} alt={preview.file.name} h={130} fit="cover" radius={8} />
									<Group justify="space-between" gap={6} wrap="nowrap">
										<Radio
											label="Capa"
											color="pink"
											checked={coverFileIndex === index}
											onChange={() => {
												onCoverPhotoPathChange(null)
												onCoverFileIndexChange(index)
											}}
										/>
										<ActionIcon
											color="red"
											variant="subtle"
											aria-label="Remover nova foto"
											onClick={() => removeNew(index)}
										>
											<Trash2 size={16} />
										</ActionIcon>
									</Group>
									<Badge variant="light" color="pink">
										Nova
									</Badge>
								</Stack>
							</Card>
						))}
					</SimpleGrid>
				</Stack>
			) : null}
		</Stack>
	)
}
