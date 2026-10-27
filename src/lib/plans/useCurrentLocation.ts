import { useCallback, useState } from 'react'

type LocationStatus = 'idle' | 'loading' | 'granted' | 'denied' | 'error'

export function useCurrentLocation() {
  const [status, setStatus] = useState<LocationStatus>('idle')
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const requestLocation = useCallback(() => new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
    const localHostnames = new Set(['localhost', '127.0.0.1', '[::1]'])

    if (!window.isSecureContext && !localHostnames.has(window.location.hostname)) {
      setStatus('error')
      setError('A localização só funciona em uma conexão HTTPS. Informe a cidade manualmente.')
      resolve(null)
      return
    }

    if (!('geolocation' in navigator)) {
      setStatus('error')
      setError('Seu navegador não oferece localização. Informe a cidade manualmente.')
      resolve(null)
      return
    }

    setStatus('loading')
    setError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }
        setCoordinates(nextCoordinates)
        setStatus('granted')
        resolve(nextCoordinates)
      },
      (positionError) => {
        const nextStatus = positionError.code === positionError.PERMISSION_DENIED ? 'denied' : 'error'
        setStatus(nextStatus)
        setError(
          nextStatus === 'denied'
            ? 'Localização recusada. Você pode continuar informando a cidade.'
            : 'Não foi possível obter sua localização. Informe a cidade manualmente.',
        )
        resolve(null)
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    )
  }), [])

  return { status, coordinates, error, requestLocation }
}
