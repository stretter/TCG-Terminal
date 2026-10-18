import { useEffect, useRef, useState } from 'react'

type Props = { occupiedPositions: number[]; selectedPosition: number }
const FRAME_WIDTH = 900
const FRAME_HEIGHT = 600

export function CameraPreview({ occupiedPositions, selectedPosition }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [active, setActive] = useState(false)
  const [status, setStatus] = useState('Camera is off.')
  const [photo, setPhoto] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [alignedPhoto, setAlignedPhoto] = useState<string | null>(null)
  const dragRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null)
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
    setStatus('Image captured locally. Drag and zoom the photo under the fixed six-position guide.')
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
      setStatus('Photo loaded locally. Drag and zoom the photo to align the cards.')
    }
    reader.onerror = () => setStatus('The selected image could not be loaded.')
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    if (!photo) { setAlignedPhoto(null); setCrops({}); return }
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      const canvas = document.createElement('canvas')
      canvas.width = FRAME_WIDTH
      canvas.height = FRAME_HEIGHT
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#101827'
      ctx.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT)
      // Cover the fixed frame without distorting the photograph; drag and zoom alter placement.
      const scale = Math.max(FRAME_WIDTH / img.width, FRAME_HEIGHT / img.height) * zoom
      const width = img.width * scale
      const height = img.height * scale
      const x = (FRAME_WIDTH - width) / 2 + offset.x * FRAME_WIDTH / 100
      const y = (FRAME_HEIGHT - height) / 2 + offset.y * FRAME_HEIGHT / 100
      ctx.drawImage(img, x, y, width, height)
      const result: Record<number, string> = {}
      for (let position = 1; position <= 6; position++) {
        const col = (position - 1) % 3
        const row = Math.floor((position - 1) / 3)
        const part = document.createElement('canvas')
        part.width = FRAME_WIDTH / 3
        part.height = FRAME_HEIGHT / 2
        const partCtx = part.getContext('2d')
        if (partCtx) {
          partCtx.drawImage(canvas, col * part.width, row * part.height, part.width, part.height,
            0, 0, part.width, part.height)
          result[position] = part.toDataURL('image/png')
        }
      }
      setAlignedPhoto(canvas.toDataURL('image/png'))
      setCrops(result)
    }
    img.onerror = () => setStatus('Unable to decode the selected image.')
    img.src = photo
    return () => { cancelled = true }
  }, [photo, zoom, offset])

  function resetAlignment() {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }

  function onDragStart(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY, startX: offset.x, startY: offset.y }
  }

  function onDragMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = dragRef.current
    if (!start) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    setOffset({
      x: start.startX + (event.clientX - start.x) / bounds.width * 100,
      y: start.startY + (event.clientY - start.y) / bounds.height * 100,
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
        <p className="scan-mode">Drag the photograph to position it, then zoom to fit cards beneath the fixed blue six-position guide.</p>
        <div aria-label="Drag photo to align cards" onPointerDown={onDragStart} onPointerMove={onDragMove}
          onPointerUp={() => { dragRef.current = null }} onPointerCancel={() => { dragRef.current = null }}
          style={{ position: 'relative', width: '100%', aspectRatio: '3 / 2', touchAction: 'none',
            cursor: 'grab', overflow: 'hidden', borderRadius: 10, background: '#101827' }}>
          {alignedPhoto && <img src={alignedPhoto} alt="Photo aligned beneath fixed card grid"
            draggable={false} style={{ display: 'block', width: '100%', height: '100%', userSelect: 'none', pointerEvents: 'none' }} />}
          <div aria-label="Fixed six-position alignment guide"
            style={{ position: 'absolute', inset: 0, border: '3px solid #60a5fa', boxSizing: 'border-box',
              display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gridTemplateRows: 'repeat(2, minmax(0, 1fr))', pointerEvents: 'none' }}>
            {[1, 2, 3, 4, 5, 6].map(position =>
              <div key={position} style={{ border: '1px dashed #93c5fd',
                background: selectedPosition === position ? 'rgba(59, 130, 246, .2)' : 'transparent',
                color: 'white', textShadow: '0 1px 3px black', padding: 5, fontSize: 12 }}>
                {String(position).padStart(2, '0')}
              </div>)}
          </div>
        </div>
        <label className="scan-mode" style={{ display: 'grid', gap: 6 }}>
          Photo zoom: {Math.round(zoom * 100)}%
          <input type="range" min="100" max="300" step="5" value={Math.round(zoom * 100)}
            onChange={event => setZoom(Number(event.target.value) / 100)} />
        </label>
        <button type="button" className="scan-secondary" onClick={resetAlignment}>Reset photo position and zoom</button>
        <p className="scan-mode">Individual cropped previews (occupied positions only):</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {[1, 2, 3, 4, 5, 6].filter(position => occupiedPositions.includes(position)).map(position =>
            <div key={position} style={{ minWidth: 0, border: selectedPosition === position ? '2px solid #93c5fd' : '1px solid #475569', borderRadius: 8, overflow: 'hidden' }}>
              {crops[position] && <img src={crops[position]} alt={`Crop for position ${position}`} style={{ display: 'block', width: '100%', height: 'auto' }} />}
              <small style={{ display: 'block', padding: 6 }}>Position {String(position).padStart(2, '0')}</small>
            </div>
          )}
        </div>
        <p className="scan-mode">The grid stays fixed while you move and resize the photo. Perspective correction, automatic detection and record assignment are not implemented.</p>
      </>}
      <p className="scan-mode" role="status">{status}</p>
    </div>
  )
}
