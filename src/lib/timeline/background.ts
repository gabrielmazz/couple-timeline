import type { TimelineEventWithPhotos, TimelinePhotoWithUrl } from '../../types/timeline'

type BackgroundPhoto = Pick<TimelinePhotoWithUrl, 'signedUrl'>

export const MAX_BACKGROUND_IMAGES = 12

export function getBackgroundImagesFromUrls(urls: Array<string | null | undefined>) {
	return Array.from(new Set(urls.filter((url): url is string => Boolean(url)))).slice(0, MAX_BACKGROUND_IMAGES)
}

export function getTimelineBackgroundImages(events: TimelineEventWithPhotos[]) {
	const coverUrls = events.map((event) => event.coverUrl).filter((url): url is string => Boolean(url))
	const photoUrls = events.flatMap((event) =>
		event.photos.map((photo) => photo.signedUrl).filter((url): url is string => Boolean(url)),
	)

	return getBackgroundImagesFromUrls([...coverUrls, ...photoUrls])
}

export function getPhotoBackgroundImages(photos: BackgroundPhoto[]) {
	return getBackgroundImagesFromUrls(photos.map((photo) => photo.signedUrl))
}
