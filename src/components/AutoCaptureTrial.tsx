import { useEffect, useRef, useState } from 'react'
import { CaptureGate, type CapturePhase } from './captureGate'

const POLL_MS = 100
const PIXEL_DELTA = 28
const MOTION_FRACTION = 0.095

/** Camera experiment only. Captures stay local; no price or inventory writes. */
export function AutoCaptureTrial() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<number | null>(null)
  const gate = useRef(new CaptureGate())
  const previous = useRef<Uint8ClampedArray | null>(null)
  const [active, setActive] = useState(false)
  const [auto, setAuto] = useState(false)
  const [phase, setPhase] = useState<CapturePhase>('ready')
  const [message, setMessage] = useState('Camera is off.')
  const [image, setImage] = useState<string | null>(null)
  const [count, setCount] = useState(0)

  function stop() {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current)
    intervalRef.current = null
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    previous.current = null
    gate.current.reset()
    setPhase('ready');setAuto(false);setActive(false);setMessage('Camera is off.')
  }
  useEffect(() => () => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current)
    streamRef.current?.getTracks().forEach(track => track.stop())
  }, [])

  function capture() {
    const v = videoRef.current
    if (!v || !v.videoWidth || !v.videoHeight) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth;canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(v,0,0)
    setImage(canvas.toDataURL('image/jpeg',0.9))
    setCount(n => n+1)
    setMessage('Test photograph captured locally; not identified or priced.')
  }
  function observe() {
    const video=videoRef.current
    if (!video?.videoWidth || !video.videoHeight) return
    const canvas=document.createElement('canvas')
    canvas.width=96;canvas.height=96
    const ctx=canvas.getContext('2d',{willReadFrequently:true})
    if (!ctx) return
    const w=video.videoWidth*.65,h=video.videoHeight*.65
    ctx.drawImage(video,(video.videoWidth-w)/2,(video.videoHeight-h)/2,w,h,0,0,96,96)
    const data=ctx.getImageData(0,0,96,96).data
    const prev=previous.current
    previous.current=new Uint8ClampedArray(data)
    if (!prev) return
    let changed=0,checked=0
    for (let i=0;i<data.length;i+=16) {
      const d=Math.abs(data[i]-prev[i])+Math.abs(data[i+1]-prev[i+1])+Math.abs(data[i+2]-prev[i+2])
      if(d>PIXEL_DELTA*3) changed++
      checked++
    }
    const decision=gate.current.update(performance.now(),changed/checked>MOTION_FRACTION)
    setPhase(decision.phase)
    if(decision.capture) capture()
  }
  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {setMessage('Camera access requires HTTPS or localhost.');return}
    try {
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false})
      streamRef.current=stream
      if (!videoRef.current) throw new Error('Preview unavailable')
      videoRef.current.srcObject=stream
      await videoRef.current.play()
      setActive(true);setMessage('Camera ready. Manual capture available.')
    } catch {
      streamRef.current?.getTracks().forEach(track=>track.stop())
      streamRef.current=null
      setActive(false);setMessage('Could not start camera or permission was denied.')
    }
  }
  function toggleAuto() {
    if (auto) {
      if(intervalRef.current!==null) window.clearInterval(intervalRef.current)
      intervalRef.current=null;setAuto(false);setMessage('Automatic test paused.')
    } else if (active) {
      gate.current.reset();previous.current=null;setPhase('ready')
      intervalRef.current=window.setInterval(observe,POLL_MS)
      setAuto(true);setMessage('Automatic test active: motion followed by 600ms stability.')
    }
  }
  return <section aria-label="Experimental automatic capture" className="scan-auto-trial">
    <p role="status"><strong>{!active?'Camera off':!auto?'Manual capture':phase==='ready'?'Ready — waiting for movement':phase==='detecting'?'Detecting — wait for stability':'Captured — waiting for new movement'}</strong></p>
    <video ref={videoRef} muted playsInline autoPlay aria-label="Automatic capture trial live preview" style={{width:'100%',aspectRatio:'4/3',objectFit:'contain',background:'#030712',borderRadius:10}}/>
    <div className="scan-actions">
      <button type="button" className="scan-secondary" disabled={active} onClick={start}>Start trial camera</button>
      <button type="button" className="scan-secondary" disabled={!active} onClick={stop}>Stop camera</button>
      <button type="button" className="scan-secondary" disabled={!active} onClick={toggleAuto}>{auto?'Pause auto':'Enable auto'}</button>
      <button type="button" className="scan-primary" disabled={!active} onClick={capture}>Manual capture</button>
    </div>
    <p className="scan-footnote" role="status">{message} · {count} test photographs. No inventory updates.</p>
    {image && <img src={image} alt="Most recent local test capture" style={{width:'100%',maxWidth:220}}/>}
    <p className="scan-footnote">Motion alone cannot prove a new card has arrived. Hand movement, foil reflections and changing light may produce false triggers. Experiment only.</p>
  </section>
}
