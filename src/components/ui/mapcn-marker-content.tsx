/* eslint-disable react-refresh/only-export-components, react-hooks/refs, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- MapLibre owns imperative map and marker instances. */
import * as MapLibreGL from 'maplibre-gl'
import type { MarkerOptions, PopupOptions } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

function cn(...inputs: Array<string | false | null | undefined>) {
  return inputs.filter(Boolean).join(' ')
}

const defaultStyles = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
}

type Theme = 'light' | 'dark'

type MapViewport = {
  center: [number, number]
  zoom: number
  bearing: number
  pitch: number
}

type MapStyleOption = string | MapLibreGL.StyleSpecification
type MapRef = MapLibreGL.Map

type MapContextValue = {
  map: MapLibreGL.Map | null
  isLoaded: boolean
  hasError: boolean
}

const MapContext = createContext<MapContextValue | null>(null)

function getDocumentTheme(): Theme | null {
  if (typeof document === 'undefined') return null
  if (document.documentElement.classList.contains('dark')) return 'dark'
  if (document.documentElement.classList.contains('light')) return 'light'
  return null
}

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function useResolvedTheme(themeProp?: Theme): Theme {
  const [detectedTheme, setDetectedTheme] = useState<Theme>(() => getDocumentTheme() ?? getSystemTheme())

  useEffect(() => {
    if (themeProp) return

    const observer = new MutationObserver(() => {
      const documentTheme = getDocumentTheme()
      if (documentTheme) setDetectedTheme(documentTheme)
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemChange = (event: MediaQueryListEvent) => {
      if (!getDocumentTheme()) setDetectedTheme(event.matches ? 'dark' : 'light')
    }
    mediaQuery.addEventListener('change', handleSystemChange)

    return () => {
      observer.disconnect()
      mediaQuery.removeEventListener('change', handleSystemChange)
    }
  }, [themeProp])

  return themeProp ?? detectedTheme
}

export function useMap() {
  const context = useContext(MapContext)
  if (!context) throw new Error('useMap must be used within a Map component')
  return context
}

type MapProps = {
  children?: ReactNode
  className?: string
  theme?: Theme
  styles?: { light?: MapStyleOption; dark?: MapStyleOption }
  viewport?: Partial<MapViewport>
  onViewportChange?: (viewport: MapViewport) => void
  loading?: boolean
} & Omit<MapLibreGL.MapOptions, 'container' | 'style'>

function DefaultLoader() {
  return (
    <div className="map-loader" role="status" aria-label="Carregando mapa">
      <span />
      <span />
      <span />
    </div>
  )
}

function getViewport(map: MapLibreGL.Map): MapViewport {
  const center = map.getCenter()
  return {
    center: [center.lng, center.lat],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  }
}

export const Map = forwardRef<MapRef, MapProps>(function Map(
  { children, className, theme: themeProp, styles, viewport, onViewportChange, loading = false, ...props },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mapInstance, setMapInstance] = useState<MapLibreGL.Map | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isStyleLoaded, setIsStyleLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const styleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const internalUpdateRef = useRef(false)
  const resolvedTheme = useResolvedTheme(themeProp)
  const onViewportChangeRef = useRef(onViewportChange)
  onViewportChangeRef.current = onViewportChange

  const mapStyles = useMemo(
    () => ({ dark: styles?.dark ?? defaultStyles.dark, light: styles?.light ?? defaultStyles.light }),
    [styles],
  )

  useImperativeHandle(ref, () => mapInstance as MapLibreGL.Map, [mapInstance])

  const clearStyleTimeout = useCallback(() => {
    if (styleTimeoutRef.current) {
      clearTimeout(styleTimeoutRef.current)
      styleTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const map = new MapLibreGL.Map({
      container: containerRef.current,
      style: resolvedTheme === 'dark' ? mapStyles.dark : mapStyles.light,
      renderWorldCopies: false,
      attributionControl: { compact: true },
      ...props,
      ...viewport,
    })
    const styleDataHandler = () => {
      clearStyleTimeout()
      styleTimeoutRef.current = setTimeout(() => setIsStyleLoaded(true), 100)
    }
    const loadHandler = () => {
      setIsLoaded(true)
      setHasError(false)
    }
    const errorHandler = () => setHasError(true)
    const moveHandler = () => {
      if (!internalUpdateRef.current) onViewportChangeRef.current?.(getViewport(map))
    }

    map.on('load', loadHandler)
    map.on('styledata', styleDataHandler)
    map.on('error', errorHandler)
    map.on('move', moveHandler)
    setMapInstance(map)

    return () => {
      clearStyleTimeout()
      map.off('load', loadHandler)
      map.off('styledata', styleDataHandler)
      map.off('error', errorHandler)
      map.off('move', moveHandler)
      map.remove()
      setMapInstance(null)
      setIsLoaded(false)
      setIsStyleLoaded(false)
    }
  }, [])

  useEffect(() => {
    if (!mapInstance) return
    const nextStyle = resolvedTheme === 'dark' ? mapStyles.dark : mapStyles.light
    setIsStyleLoaded(false)
    setHasError(false)
    mapInstance.setStyle(nextStyle)
  }, [resolvedTheme, mapStyles, mapInstance])

  useEffect(() => {
    if (!mapInstance || !viewport) return
    internalUpdateRef.current = true
    mapInstance.jumpTo(viewport)
    requestAnimationFrame(() => {
      internalUpdateRef.current = false
    })
  }, [mapInstance, viewport])

  const contextValue = useMemo(
    () => ({ map: mapInstance, isLoaded: isLoaded && isStyleLoaded, hasError }),
    [mapInstance, isLoaded, isStyleLoaded, hasError],
  )

  return (
    <MapContext.Provider value={contextValue}>
      <div ref={containerRef} className={cn('relative h-full w-full', className)}>
        {(!isLoaded || loading) && <DefaultLoader />}
        {hasError && <div className="map-error">O mapa não carregou. A lista continua disponível.</div>}
        {mapInstance && children}
      </div>
    </MapContext.Provider>
  )
})

type MarkerContextValue = {
  marker: MapLibreGL.Marker
  map: MapLibreGL.Map | null
}

const MarkerContext = createContext<MarkerContextValue | null>(null)

function useMarkerContext() {
  const context = useContext(MarkerContext)
  if (!context) throw new Error('Marker components must be used within MapMarker')
  return context
}

type MapMarkerProps = {
  longitude: number
  latitude: number
  children: ReactNode
  onClick?: (event: MouseEvent) => void
  onMouseEnter?: (event: MouseEvent) => void
  onMouseLeave?: (event: MouseEvent) => void
  onFocus?: (event: FocusEvent) => void
  onBlur?: (event: FocusEvent) => void
  onDragStart?: (lngLat: { lng: number; lat: number }) => void
  onDrag?: (lngLat: { lng: number; lat: number }) => void
  onDragEnd?: (lngLat: { lng: number; lat: number }) => void
  ariaLabel?: string
} & Omit<MarkerOptions, 'element'>

export function MapMarker({
  longitude,
  latitude,
  children,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onDragStart,
  onDrag,
  onDragEnd,
  ariaLabel,
  draggable = false,
  ...markerOptions
}: MapMarkerProps) {
  const { map } = useMap()
  const callbacksRef = useRef({ onClick, onMouseEnter, onMouseLeave, onFocus, onBlur, onDragStart, onDrag, onDragEnd })
  callbacksRef.current = { onClick, onMouseEnter, onMouseLeave, onFocus, onBlur, onDragStart, onDrag, onDragEnd }

  const marker = useMemo(() => {
    const markerInstance = new MapLibreGL.Marker({
      ...markerOptions,
      element: document.createElement('div'),
      draggable,
    }).setLngLat([longitude, latitude])
    const element = markerInstance.getElement()
    const handleClick = (event: MouseEvent) => callbacksRef.current.onClick?.(event)
    const handleMouseEnter = (event: MouseEvent) => callbacksRef.current.onMouseEnter?.(event)
    const handleMouseLeave = (event: MouseEvent) => callbacksRef.current.onMouseLeave?.(event)
    const handleFocus = (event: FocusEvent) => callbacksRef.current.onFocus?.(event)
    const handleBlur = (event: FocusEvent) => callbacksRef.current.onBlur?.(event)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        element?.click()
      }
    }

    element?.addEventListener('click', handleClick)
    element?.addEventListener('mouseenter', handleMouseEnter)
    element?.addEventListener('mouseleave', handleMouseLeave)
    element?.addEventListener('focus', handleFocus)
    element?.addEventListener('blur', handleBlur)
    element?.addEventListener('keydown', handleKeyDown)
    markerInstance.on('dragstart', () => {
      const lngLat = markerInstance.getLngLat()
      callbacksRef.current.onDragStart?.({ lng: lngLat.lng, lat: lngLat.lat })
    })
    markerInstance.on('drag', () => {
      const lngLat = markerInstance.getLngLat()
      callbacksRef.current.onDrag?.({ lng: lngLat.lng, lat: lngLat.lat })
    })
    markerInstance.on('dragend', () => {
      const lngLat = markerInstance.getLngLat()
      callbacksRef.current.onDragEnd?.({ lng: lngLat.lng, lat: lngLat.lat })
    })

    return markerInstance
  }, [])

  useEffect(() => {
    const element = marker.getElement()
    if (element) {
      element.setAttribute('role', 'button')
      element.setAttribute('tabindex', '0')
      if (ariaLabel) element.setAttribute('aria-label', ariaLabel)
    }
  }, [ariaLabel, marker])

  useEffect(() => {
    if (!map) return
    marker.addTo(map)
    return () => {
      marker.remove()
    }
  }, [map, marker])

  const currentPosition = marker.getLngLat()
  if (currentPosition.lng !== longitude || currentPosition.lat !== latitude) marker.setLngLat([longitude, latitude])
  if (marker.isDraggable() !== draggable) marker.setDraggable(draggable)

  return <MarkerContext.Provider value={{ marker, map }}>{children}</MarkerContext.Provider>
}

type MarkerContentProps = {
  children?: ReactNode
  className?: string
}

export function MarkerContent({ children, className }: MarkerContentProps) {
  const { marker } = useMarkerContext()
  return createPortal(
    <div className={cn('map-marker-content', className)}>{children || <DefaultMarkerIcon />}</div>,
    marker.getElement(),
  )
}

function DefaultMarkerIcon() {
  return <div className="map-marker-dot" />
}

type MarkerTooltipProps = {
  children: ReactNode
  className?: string
} & Omit<PopupOptions, 'className' | 'closeButton' | 'closeOnClick'>

export function MarkerTooltip({ children, className, ...popupOptions }: MarkerTooltipProps) {
  const { marker, map } = useMarkerContext()
  const container = useMemo(() => document.createElement('div'), [])
  const tooltip = useMemo(
    () => new MapLibreGL.Popup({ offset: 18, ...popupOptions, closeOnClick: false, closeButton: true }).setMaxWidth('min(320px, calc(100vw - 32px))'),
    [],
  )
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!map) return
    tooltip.setDOMContent(container)

    const open = () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
      tooltip.setLngLat(marker.getLngLat()).addTo(map)
    }
    const scheduleClose = () => {
      closeTimerRef.current = setTimeout(() => tooltip.remove(), 180)
    }
    const element = marker.getElement()
    element?.addEventListener('mouseenter', open)
    element?.addEventListener('mouseleave', scheduleClose)
    element?.addEventListener('click', open)
    element?.addEventListener('focus', open)
    container.addEventListener('mouseenter', open)
    container.addEventListener('mouseleave', scheduleClose)

    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
      element?.removeEventListener('mouseenter', open)
      element?.removeEventListener('mouseleave', scheduleClose)
      element?.removeEventListener('click', open)
      element?.removeEventListener('focus', open)
      container.removeEventListener('mouseenter', open)
      container.removeEventListener('mouseleave', scheduleClose)
      tooltip.remove()
    }
  }, [container, map, marker, tooltip])

  return createPortal(<div className={cn('map-marker-tooltip', className)}>{children}</div>, container)
}

type MarkerLabelProps = {
  children: ReactNode
  className?: string
  position?: 'top' | 'bottom'
}

export function MarkerLabel({ children, className, position = 'top' }: MarkerLabelProps) {
  return (
    <div className={cn('map-marker-label', position === 'top' ? 'map-marker-label-top' : 'map-marker-label-bottom', className)}>
      {children}
    </div>
  )
}
