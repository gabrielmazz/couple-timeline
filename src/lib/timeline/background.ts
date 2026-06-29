import type { TimelineEventWithPhotos, TimelinePhotoWithUrl } from '../../types/timeline'

type BackgroundPhoto = Pick<TimelinePhotoWithUrl, 'signedUrl'>

export function getTimelineBackgroundImages(events: TimelineEventWithPhotos[]) {
	return Array.from(
		new Set(
			events
				.flatMap((event) => [event.coverUrl, ...event.photos.map((photo) => photo.signedUrl)])
				.filter((url): url is string => Boolean(url)),
		),
	)
}

export function getPhotoBackgroundImages(photos: BackgroundPhoto[]) {
	return Array.from(new Set(photos.map((photo) => photo.signedUrl).filter((url): url is string => Boolean(url))))
}
