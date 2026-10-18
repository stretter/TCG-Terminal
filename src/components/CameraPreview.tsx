import { useEffect, useRef, useState } from 'react'

type Props = { occupiedPositions: number[]; selectedPosition: number }
type Area = { left: number; top: number; width: number; height: number }
const initialArea: Area = { left: 5, top: 5, width: 90, height: 90 }

export function CameraPreview({ occupiedPositions, selectedPosition }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [active, setActive] = useState(false)
  const [status, setStatus] = useState('Camera is off.')
  const [photo, setPhoto] = useState<string | null>(null)
  const [area, setArea] = useState<Area>(initialArea)
  const [crops, setCrops] = useState<Record<number, string>>({})

  function stopCamera() {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setActive(false)
    setStatus('Camera is off.')
  }

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
  }, [])

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Camera access is unavailable. Try opening the preview in a secure browser tab.')
      return
    }
    setStatus('Requesting camera permission…')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      streamRef.current = stream
      if (!videoRef.current) throw new Error('Video element unavailable')
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setActive(true)
      setStatus('Live video is running. Photos remain local to this browser.')
    } catch (error) {
      streamRef.current?.getTracks().forEach(track => track.stop())
      streamRef.current = null
      const name = error instanceof DOMException ? error.name : ''
      setStatus(name === 'NotAllowedError' ? 'Camera permission denied. Allow access in browser settings.' :
        name === 'NotFoundError' ? 'No browser camera detected.' : 'Camera could not start. Check whether another app is using it.')
      setActive(false)
    }
  }

  function capturePhoto() {
    const video = videoRef.current
    if (!active || !video?.videoWidth || !video.videoHeight) {
      setStatus('Wait for live video to start before capturing.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) { setStatus('Your browser could not capture an image.'); return }
    ctx.drawImage(video, 0, 0)
    setPhoto(canvas.toDataURL('image/png'))
    setStatus('Image captured locally. Adjust the blue boundary to fit the scanning mat.')
  }

  function choosePhoto(file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setStatus('Please choose an image file.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      setPhoto(reader.result)
      setStatus('Photo loaded locally. Adjust the scan boundary to the six-position mat.')
    }
    reader.onerror = () => setStatus('The selected image could not be loaded.')
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    if (!photo) { setCrops({}); return }
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      const result: Record<number, string> = {}
      const left = Math.floor(img.width * area.left / 100)
      const top = Math.floor(img.height * area.top / 100)
      const width = Math.floor(img.width * area.width / 100)
      const height = Math.floor(img.height * area.height / 100)
      for (const position of [1, 2, 3, 4, 5, 6]) {
        const col = (position - 1) % 3
        const row = Math.floor((position - 1) / 3)
        const x1 = left + Math.floor(width * col / 3)
        const y1 = top + Math.floor(height * row / 2)
        const x2 = left + Math.floor(width * (col + 1) / 3)
        const y2 = top + Math.floor(height * (row + 1) / 2)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, x2 - x1)
        canvas.height = Math.max(1, y2 - y1)
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, x1, y1, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
          result[position] = canvas.toDataURL('image/png')
        }
      }
      setCrops(result)
    }
    img.onerror = () => setStatus('Unable to decode the selected image.')
    img.src = photo
    return () => { cancelled = true }
  }, [photo, area])

  function setBoundary(part: keyof Area, value: number) {
    setArea(previous => {
      const next = { ...previous, [part]: value }
      if (part === 'left') next.width = Math.min(next.width, 100 - value)
      if (part === 'top') next.height = Math.min(next.height, 100 - value)
      if (part === 'width') next.width = Math.min(value, 100 - next.left)
      if (part === 'height') next.height = Math.min(value, 100 - next.top)
      return next
    })
  }

  return (
    <div aria-label="Camera and alignment test" style={{ margin: '16px 0', display: 'grid', gap: 12 }}>
      <video ref={videoRef} autoPlay muted playsInline aria-label="Webcam preview"
        style={{ width: '100%', maxHeight: 260, background: '#050913', borderRadius: 12, objectFit: 'contain' }} />
      <div className="scan-actions">
        <button type="button" className="scan-secondary" onClick={startCamera} disabled={active}>Start camera</button>
        <button type="button" className="scan-secondary" onClick={stopCamera} disabled={!active}>Stop camera</button>
        <button type="button" className="scan-primary" onClick={capturePhoto} disabled={!active}>Capture photo</button>
        {photo && <button type="button" className="scan-secondary" onClick={() => { setPhoto(null); setStatus('Photo discarded.') }}>Discard photo</button>}
      </div>
      <label className="scan-mode">Or choose a photo from your phone or computer:
        <input type="file" accept="image/*" onChange={event => { choosePhoto(event.target.files?.[0]); event.target.value = '' }} />
      </label>
      {photo && <>
        <p className="scan-mode">Alignment guide: the blue frame defines the scanning area, divided into six numbered regions.</p>
        <div style={{ position: 'relative', width: '100%' }}>
          <img src={photo} alt="Captured photograph with alignment grid" style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 10 }} />
          <div aria-label="Adjustable six-position alignment guide" style={{ position: 'absolute', boxSizing: 'border-box',
            left: `${area.left}%`, top: `${area.top}%`, width: `${area.width}%`, height: `${area.height}%`,
            border: '3px solid #60a5fa', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gridTemplateRows: 'repeat(2, minmax(0, 1fr))', pointerEvents: 'none' }}>
            {[1, 2, 3, 4, 5, 6].map(position =>
              <div key={position} style={{ border: '1px dashed #93c5fd', background: selectedPosition === position ? 'rgba(59, 130, 246, .2)' : 'transparent', color: 'white', textShadow: '0 1px 3px black', padding: 3, fontSize: 12 }}>{String(position).padStart(2, '0')}</div>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          {(['left', 'top', 'width', 'height'] as const).map(part => {
            const max = part === 'left' || part === 'top' ? 90 : 100 - (part === 'width' ? area.left : area.top)
            return <label key={part} className="scan-mode" style={{ display: 'grid' }}>
              {part.charAt(0).toUpperCase() + part.slice(1)}: {area[part]}%
              <input type="range" min={part === 'width' || part === 'height' ? 10 : 0} max={max} value={area[part]}
                onChange={event => setBoundary(part, Number(event.target.value))} />
            </label>
          })}
        </div>
        <button type="button" className="scan-secondary" onClick={() => setArea(initialArea)}>Reset alignment</button>
        <p className="scan-mode">Individual cropped previews (occupied positions only):</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {[1, 2, 3, 4, 5, 6].filter(position => occupiedPositions.includes(position)).map(position =>
            <div key={position} style={{ minWidth: 0, border: selectedPosition === position ? '2px solid #93c5fd' : '1px solid #475569', borderRadius: 8, overflow: 'hidden' }}>
              {crops[position] && <img src={crops[position]} alt={`Crop for position ${position}`} style={{ display: 'block', width: '100%', height: 'auto' }} />}
              <small style={{ display: 'block', padding: 6 }}>Position {String(position).padStart(2, '0')}</small>
            </div>
          )}
        </div>
        <p className="scan-mode">Calibration prototype: straight rectangular crop only; perspective correction, automatic card detection and record assignment are not implemented.</p>
      </>}
      <p className="scan-mode" role="status">{status}</p>
    </div>
  )
}
