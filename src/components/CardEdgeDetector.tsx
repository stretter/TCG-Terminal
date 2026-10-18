import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'

type Point = { x: number; y: number }
const fallback: Point[] = [{x:.12,y:.08},{x:.88,y:.08},{x:.88,y:.92},{x:.12,y:.92}]
const clamp = (x:number) => Math.max(0,Math.min(1,x))

// Finds rectangular boundary candidates from image gradients. This is an experimental
// axis-aligned detector, not full perspective/contour recognition.
function proposeCorners(image: HTMLImageElement): Point[] | null {
  const w=256,h=256
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null
  ctx.drawImage(image,0,0,w,h)
  const raw=ctx.getImageData(0,0,w,h).data
  const gray=new Float32Array(w*h)
  for(let i=0;i<gray.length;i++)gray[i]=.299*raw[i*4]+.587*raw[i*4+1]+.114*raw[i*4+2]
  const vertical=new Float32Array(w*h), horizontal=new Float32Array(w*h)
  for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){
    const n=y*w+x
    vertical[n]=Math.abs(gray[n+1]-gray[n-1])
    horizontal[n]=Math.abs(gray[n+w]-gray[n-w])
  }
  const integral=(data:Float32Array)=>{
    const out=new Float64Array((w+1)*(h+1))
    for(let y=1;y<=h;y++)for(let x=1;x<=w;x++){
      const at=y*(w+1)+x
      out[at]=data[(y-1)*w+x-1]+out[at-1]+out[at-(w+1)]-out[at-(w+2)]
    }
    return out
  }
  const vx=integral(vertical),hy=integral(horizontal)
  const sum=(ii:Float64Array,x1:number,y1:number,x2:number,y2:number)=>{
    const stride=w+1
    return ii[y2*stride+x2]-ii[y1*stride+x2]-ii[y2*stride+x1]+ii[y1*stride+x1]
  }
  const aspect=image.naturalWidth/image.naturalHeight
  const cardRatio=63/88 // portrait MTG card
  let bestScore=0
  let best:{x:number;y:number;cw:number;ch:number}|null=null
  for(let ch=76;ch<=222;ch+=8) {
    const cw=Math.round(ch*cardRatio/aspect)
    if(cw<30||cw>220)continue
    for(let y=8;y+ch<h-8;y+=5)for(let x=8;x+cw<w-8;x+=5){
      const band=3
      const edges=(
        sum(vx,x,y,x+band,y+ch)+sum(vx,x+cw-band,y,x+cw,y+ch)
        +sum(hy,x,y,x+cw,y+band)+sum(hy,x,y+ch-band,x+cw,y+ch)
      )/(2*band*(cw+ch))
      // Weak, unconvincing borders should be left for manual correction.
      const areaFraction=cw*ch/(w*h)
      const score=edges*(1-.15*Math.abs(areaFraction-.33))
      if(score>bestScore){bestScore=score;best={x,y,cw,ch}}
    }
  }
  if(!best||bestScore<17)return null
  const b=best
  return [{x:b.x/w,y:b.y/h},{x:(b.x+b.cw)/w,y:b.y/h},
    {x:(b.x+b.cw)/w,y:(b.y+b.ch)/h},{x:b.x/w,y:(b.y+b.ch)/h}]
}

function straighten(image:HTMLImageElement, points:Point[]):string {
  const width=320,height=448
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
  const ctx=canvas.getContext('2d')
  if(!ctx)return ''
  const src=document.createElement('canvas');src.width=image.naturalWidth;src.height=image.naturalHeight
  const srcCtx=src.getContext('2d',{willReadFrequently:true});if(!srcCtx)return ''
  srcCtx.drawImage(image,0,0)
  const input=srcCtx.getImageData(0,0,src.width,src.height)
  const output=ctx.createImageData(width,height)
  // Bilinear mapping gives a usable first-pass perspective-corrected crop.
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=x/(width-1),v=y/(height-1)
    const px=(1-v)*((1-u)*points[0].x+u*points[1].x)+v*((1-u)*points[3].x+u*points[2].x)
    const py=(1-v)*((1-u)*points[0].y+u*points[1].y)+v*((1-u)*points[3].y+u*points[2].y)
    const sx=Math.max(0,Math.min(src.width-1,Math.round(px*(src.width-1))))
    const sy=Math.max(0,Math.min(src.height-1,Math.round(py*(src.height-1))))
    const from=(sy*src.width+sx)*4,to=(y*width+x)*4
    for(let i=0;i<4;i++)output.data[to+i]=input.data[from+i]
  }
  ctx.putImageData(output,0,0)
  return canvas.toDataURL('image/png')
}

export function CardEdgeDetector({photo}:{photo:string|null}) {
  const [corners,setCorners]=useState<Point[]>(fallback)
  const [cardImage,setCardImage]=useState('')
  const [slots,setSlots]=useState<Record<number,string>>({})
  const [message,setMessage]=useState('Load a photo to propose card edges.')
  const imageRef=useRef<HTMLImageElement|null>(null)
  const dragRef=useRef<number|null>(null)
  useEffect(()=>{
    if(!photo){imageRef.current=null;setCardImage('');return}
    let cancelled=false
    const img=new Image()
    img.onload=()=>{
      if(cancelled)return
      imageRef.current=img
      const proposed=proposeCorners(img)
      setCorners(proposed ?? fallback)
      setCardImage('')
      setMessage(proposed ? 'Possible card edges detected. Check the four corners before previewing.' : 'No reliable card detected. Drag the four corners onto the card manually.')
    }
    img.onerror=()=>setMessage('Could not read the image.')
    img.src=photo
    return ()=>{cancelled=true}
  },[photo])
  function correctCorner(event:PointerEvent<SVGSVGElement>) {
    const index=dragRef.current
    if(index===null)return
    const rect=event.currentTarget.getBoundingClientRect()
    if(!rect.width||!rect.height)return
    const x=clamp((event.clientX-rect.left)/rect.width)
    const y=clamp((event.clientY-rect.top)/rect.height)
    setCorners(existing=>existing.map((p,i)=>i===index?{x,y}:p))
  }
  function previewCrop() {
    if(!imageRef.current)return
    const result=straighten(imageRef.current,corners)
    if(result){setCardImage(result);setMessage('Inspect the card preview, then choose Crop ready.')}
  }
  function acceptCrop() {
    if(!cardImage){setMessage('Preview your crop first.');return}
    const next=[1,2,3,4,5,6].find(position=>!slots[position])
    if(!next){setMessage('All six preview positions are full.');return}
    setSlots(previous=>({...previous,[next]:cardImage}))
    setMessage(`Card crop added to position ${String(next).padStart(2,'0')}. These images are local previews only.`)
    setCardImage('')
  }
  return <section aria-label="Single-card edge detection workspace" style={{display:'grid',gap:10,marginTop:16}}>
    <h3>Single-card detection and crop</h3>
    <p className="scan-mode">Experimental card-shaped edge search. If the outline is wrong, move all four corners manually. Avoid glare and busy backgrounds.</p>
    {photo&&<div style={{position:'relative',width:'100%'}}>
      <img src={photo} alt="Source photo for card detection" style={{width:'100%',display:'block',borderRadius:10}}/>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" onPointerMove={correctCorner}
        onPointerUp={()=>{dragRef.current=null}} onPointerCancel={()=>{dragRef.current=null}}
        style={{position:'absolute',inset:0,width:'100%',height:'100%',touchAction:'none'}}>
        <polygon points={corners.map(p=>`${p.x*100},${p.y*100}`).join(' ')}
          fill="rgba(59,130,246,.12)" stroke="#60a5fa" strokeWidth=".8" vectorEffect="non-scaling-stroke"/>
        {corners.map((p,i)=><circle key={i} cx={p.x*100} cy={p.y*100} r="2.2"
          fill="#facc15" stroke="#111827" strokeWidth=".5" onPointerDown={e=>{dragRef.current=i;e.currentTarget.setPointerCapture(e.pointerId)}}/>)}
      </svg>
    </div>}
    <div className="scan-actions">
      <button type="button" className="scan-secondary" onClick={()=>{if(imageRef.current){const proposed=proposeCorners(imageRef.current);setCorners(proposed ?? fallback);setCardImage('');setMessage(proposed ? 'Possible card boundary found; please verify.' : 'No reliable boundary found; position corners manually.')}}} disabled={!photo}>Detect edges again</button>
      <button type="button" className="scan-primary" onClick={previewCrop} disabled={!photo}>Preview crop</button>
      <button type="button" className="scan-primary" onClick={acceptCrop} disabled={!cardImage}>Crop ready</button>
    </div>
    {cardImage&&<img src={cardImage} alt="Straightened card crop ready for approval" style={{width:160,maxWidth:'100%',borderRadius:8}}/>}
    <p className="scan-mode">Accepted card previews (filled in order, independent of identification records):</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8}}>
      {[1,2,3,4,5,6].map(n=><div key={n} style={{border:'1px solid #475569',padding:5,minHeight:85,borderRadius:8}}>
        <small>Position {String(n).padStart(2,'0')}</small>
        {slots[n]&&<img src={slots[n]} alt={`Accepted card at position ${n}`} style={{width:'100%',display:'block'}}/>}
      </div>)}
    </div>
    <button type="button" className="scan-secondary" onClick={()=>{setSlots({});setMessage('Card crop previews cleared.')}}>Clear crop previews</button>
    <p className="scan-mode" role="status">{message}</p>
  </section>
}
