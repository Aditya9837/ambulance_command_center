import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin } from 'lucide-react'

const DEFAULT_CENTER: [number, number] = [28.6139, 77.209]

const ambulanceIcon = L.divIcon({
  className: 'ambulance-map-marker',
  html: `<div style="
    font-size:32px;line-height:1;
    filter:drop-shadow(0 1px 2px rgba(0,0,0,.55));
  ">🚑</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
})

interface AmbulanceMapProps {
  latitude: number | null | undefined
  longitude: number | null | undefined
  label?: string
  lastUpdate?: string | null
}

export default function AmbulanceMap({
  latitude,
  longitude,
  label,
  lastUpdate,
}: AmbulanceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const hasCoords =
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(DEFAULT_CENTER, 12)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)

    mapRef.current = map

    const resize = () => map.invalidateSize()
    const observer = new ResizeObserver(resize)
    observer.observe(containerRef.current)
    requestAnimationFrame(resize)

    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !hasCoords) return

    const latlng: L.LatLngExpression = [latitude!, longitude!]

    if (!markerRef.current) {
      markerRef.current = L.marker(latlng, { icon: ambulanceIcon })
        .addTo(map)
        .bindPopup(label || 'Ambulance')
    } else {
      markerRef.current.setLatLng(latlng)
      if (label) markerRef.current.setPopupContent(label)
    }

    map.setView(latlng, Math.max(map.getZoom(), 14), { animate: true })
  }, [hasCoords, latitude, longitude, label])

  return (
    <div className="relative w-full h-full min-h-0 bg-slate-900">
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {!hasCoords && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-950/80 px-4 text-center">
          <MapPin className="w-6 h-6 text-slate-500" />
          <p className="text-xs text-slate-400">Waiting for ambulance GPS…</p>
        </div>
      )}

      {hasCoords && (
        <div className="absolute bottom-2 left-2 right-2 z-10 pointer-events-none">
          <div className="rounded-md bg-slate-950/75 border border-slate-700/60 px-2 py-1.5 backdrop-blur-sm">
            <p className="text-[10px] text-slate-200 font-mono tabular-nums truncate">
              {latitude!.toFixed(5)}, {longitude!.toFixed(5)}
            </p>
            {lastUpdate && (
              <p className="text-[9px] text-slate-500 truncate">
                Updated {new Date(lastUpdate).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
