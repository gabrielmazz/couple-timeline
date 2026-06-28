import type { TimelineEventWithPhotos, TimelinePhotoWithUrl } from '../../types/timeline'

type BackgroundPhoto = Pick<TimelinePhotoWithUrl, 'signedUrl'>

export const BACKGROUND_IMAGE_LIMIT = 16

export function selectBackgroundItems<T>(items: T[], limit = BACKGROUND_IMAGE_LIMIT) {
	const uniqueItems = Array.from(new Set(items))

	if (uniqueItems.length <= limit) {
		return uniqueItems
	}

	if (limit <= 1) {
		return uniqueItems.slice(0, 1)
	}

	const step = (uniqueItems.length - 1) / (limit - 1)

	return Array.from({ length: limit }, (_, index) => uniqueItems[Math.round(index * step)])
}

export function getTimelineBackgroundImages(events: TimelineEventWithPhotos[], limit = BACKGROUND_IMAGE_LIMIT) {
	const urls = events
		.flatMap((event) => [event.coverUrl, ...event.photos.map((photo) => photo.signedUrl)])
		.filter((url): url is string => Boolean(url))

	return selectBackgroundItems(urls, limit)
}

export function getPhotoBackgroundImages(photos: BackgroundPhoto[], limit = BACKGROUND_IMAGE_LIMIT) {
	const urls = photos.map((photo) => photo.signedUrl).filter((url): url is string => Boolean(url))

	return selectBackgroundItems(urls, limit)
}
