import { useEffect, useRef, useState } from 'react'

export function CameraPreview() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState('Camera is off.')
  const [active, setActive] = useState(false)

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
      </div>
      <p className="scan-mode" role="status">{status}</p>
    </div>
  )
}
