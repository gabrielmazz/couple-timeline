import type { TimelineEventWithPhotos, TimelinePhotoWithUrl } from '../../types/timeline'

type BackgroundPhoto = Pick<TimelinePhotoWithUrl, 'signedUrl'>

export function getBackgroundImagesFromUrls(urls: Array<string | null | undefined>) {
	// Keep the complete collection here. The AppFrame chooses which images are on
	// screen at a time, so limiting this list would permanently favour the first
	// events returned by the query.
	return Array.from(new Set(urls.filter((url): url is string => Boolean(url))))
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
