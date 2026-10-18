import { useEffect, useRef, useState } from 'react'

export function CameraPreview() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState('Camera is off.')
  const [active, setActive] = useState(false)
  const [photo, setPhoto] = useState<string | null>(null)

  function capturePhoto() {
    const video = videoRef.current
    if (!active || !video || !video.videoWidth || !video.videoHeight) {
      setStatus('The camera is not ready to capture a frame yet.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      setStatus('Could not create a photo preview in this browser.')
      return
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    setPhoto(canvas.toDataURL('image/png'))
    setStatus('Photo captured for local preview only. It has not been saved or uploaded.')
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setActive(false)
    setStatus('Camera is off.')
  }

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Camera access is unavailable here. Open the preview in a secure browser tab.')
      return
    }
    setStatus('Requesting camera permission…')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setActive(true)
      setStatus('Live camera preview is running. No images are saved or uploaded.')
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setActive(false)
      const name = error instanceof DOMException ? error.name : ''
      setStatus(name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access in your browser and try again.'
        : name === 'NotFoundError'
          ? 'No camera was detected by the browser.'
          : 'Could not start camera. Check whether another app is using it and try again.')
    }
  }

  return (
    <div aria-label="Live camera test" style={{ margin: '16px 0', display: 'grid', gap: 10 }}>
      <video ref={videoRef} autoPlay muted playsInline aria-label="Webcam preview"
        style={{ width: '100%', maxHeight: 260, background: '#050913', borderRadius: 12, objectFit: 'contain' }} />
      <div className="scan-actions">
        <button type="button" className="scan-secondary" onClick={startCamera} disabled={active}>Start camera</button>
        <button type="button" className="scan-secondary" onClick={stopCamera} disabled={!active}>Stop camera</button>
        <button type="button" className="scan-primary" onClick={capturePhoto} disabled={!active}>Capture photo</button>
        {photo && <button type="button" className="scan-secondary" onClick={() => { setPhoto(null); setStatus('Photo discarded. Camera preview remains available.') }}>Discard photo</button>}
      </div>
      {photo && <div><p className="scan-mode">Captured frame — local preview only</p><img src={photo} alt="Captured webcam frame" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 12 }} /></div>}
      <p className="scan-mode" role="status">{status}</p>
    </div>
  )
}
