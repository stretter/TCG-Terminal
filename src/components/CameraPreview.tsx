import { useEffect, useRef, useState } from 'react'
import { CardEdgeDetector } from './CardEdgeDetector'

export function CameraPreview() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [active, setActive] = useState(false)
  const [status, setStatus] = useState('Camera is off.')
  const [photo, setPhoto] = useState<string | null>(null)

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
    setStatus('Image captured locally. Review the proposed card boundary below.')
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
      setStatus('Photo loaded locally. Review or correct the card boundary below.')
    }
    reader.onerror = () => setStatus('The selected image could not be loaded.')
    reader.readAsDataURL(file)
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
      <CardEdgeDetector photo={photo} />
      <p className="scan-mode" role="status">{status}</p>
    </div>
  )
}
