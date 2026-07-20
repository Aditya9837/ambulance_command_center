import { useEffect, useRef, useState } from 'react'

/** Design size Wren Realtime is built for (full vitals dashboard). */
const DESIGN_WIDTH = 1440
const DESIGN_HEIGHT = 900

interface ScaledIframeProps {
  src: string
  title: string
}

/**
 * Embeds a full-page app by scaling it to fit the container so nothing is cropped.
 */
export default function ScaledIframe({ src, title }: ScaledIframeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.3)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const update = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width <= 0 || height <= 0) return
      // Fit entire design into the panel (letterbox if needed).
      setScale(Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT))
    }

    const observer = new ResizeObserver(update)
    observer.observe(el)
    update()
    return () => observer.disconnect()
  }, [])

  const scaledW = DESIGN_WIDTH * scale
  const scaledH = DESIGN_HEIGHT * scale

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-0 overflow-hidden bg-[#0a0a0a]">
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: scaledW,
          height: scaledH,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <iframe
          title={title}
          src={src}
          allow="microphone; camera; clipboard-write; autoplay"
          referrerPolicy="no-referrer-when-downgrade"
          style={{
            width: DESIGN_WIDTH,
            height: DESIGN_HEIGHT,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            background: '#000',
            display: 'block',
          }}
        />
      </div>
    </div>
  )
}
