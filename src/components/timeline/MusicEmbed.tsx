import { Button, Stack, Text } from '@mantine/core'
import { ExternalLink } from 'lucide-react'

function getYouTubeId(url: URL) {
    if (url.hostname.includes('youtu.be')) {
        return url.pathname.replace('/', '')
    }

    if (url.hostname.includes('youtube.com')) {
        return url.searchParams.get('v') || url.pathname.split('/').pop() || null
    }

    return null
}

function getSpotifyEmbed(url: URL) {
    if (!url.hostname.includes('spotify.com')) {
        return null
    }

    const parts = url.pathname.split('/').filter(Boolean)
    const type = parts[0]
    const id = parts[1]

    if (!type || !id) {
        return null
    }

    return `https://open.spotify.com/embed/${type}/${id}`
}

export function MusicEmbed({ url }: { url: string | null }) {
    if (!url) {
        return null
    }

    let parsedUrl: URL

    try {
        parsedUrl = new URL(url)
    } catch {
        return null
    }

    const youtubeId = getYouTubeId(parsedUrl)
    const spotifyEmbed = getSpotifyEmbed(parsedUrl)

    if (youtubeId) {
        return (
            <iframe
                className="music-frame"
                title="Player do YouTube"
                src={`https://www.youtube.com/embed/${youtubeId}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
            />
        )
    }

    if (spotifyEmbed) {
        return (
            <div className="music-frame-shell">
                <iframe
                    className="music-frame music-frame--spotify"
                    title="Player do Spotify"
                    src={spotifyEmbed}
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                />
            </div>
        )
    }

    return (
        <Stack gap="xs">
            <Text c="dimmed" size="sm">
                Link de música não reconhecido para embed.
            </Text>
            <Button
                component="a"
                href={url}
                target="_blank"
                rel="noreferrer"
                leftSection={<ExternalLink size={16} />}
                variant="light"
                color="pink"
            >
                Abrir música
            </Button>
        </Stack>
    )
}
