import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'

type Point = { x: number; y: number }
const fallback: Point[] = [{x:.12,y:.08},{x:.88,y:.08},{x:.88,y:.92},{x:.12,y:.92}]
const clamp = (x:number) => Math.max(0,Math.min(1,x))

// Conservative single-object proposal based on contrast with the image's outer background.
// Not a trained recognizer; manual four-corner correction is essential.
function proposeCorners(image: HTMLImageElement): Point[] {
  const canvas=document.createElement('canvas'); canvas.width=200; canvas.height=200
  const ctx=canvas.getContext('2d',{willReadFrequently:true}); if(!ctx)return fallback
  ctx.drawImage(image,0,0,200,200)
  const data=ctx.getImageData(0,0,200,200).data
  const rgb=(x:number,y:number)=>{const k=(y*200+x)*4;return [data[k],data[k+1],data[k+2]]}
  const edge=[rgb(2,2),rgb(197,2),rgb(2,197),rgb(197,197)]
  const bg=[0,1,2].map(i=>edge.reduce((s,p)=>s+p[i],0)/4)
  let minX=200,minY=200,maxX=0,maxY=0,count=0
  for(let y=5;y<195;y+=2)for(let x=5;x<195;x+=2){
    const p=rgb(x,y)
    const contrast=Math.hypot(p[0]-bg[0],p[1]-bg[1],p[2]-bg[2])
    if(contrast>65){minX=Math.min(x,minX);maxX=Math.max(x,maxX);minY=Math.min(y,minY);maxY=Math.max(y,maxY);count++}
  }
  if(count<350 || maxX-minX<45 || maxY-minY<55) return fallback
  const pad=3
  return [{x:clamp((minX-pad)/200),y:clamp((minY-pad)/200)},
    {x:clamp((maxX+pad)/200),y:clamp((minY-pad)/200)},
    {x:clamp((maxX+pad)/200),y:clamp((maxY+pad)/200)},
    {x:clamp((minX-pad)/200),y:clamp((maxY+pad)/200)}]
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
      setCorners(proposeCorners(img))
      setCardImage('')
      setMessage('Suggested edges are approximate. Drag the four corner handles onto the card.')
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
    <p className="scan-mode">Automatic boundary suggestion (experimental). Adjust the four corners manually if needed.</p>
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
      <button type="button" className="scan-secondary" onClick={()=>{if(imageRef.current){setCorners(proposeCorners(imageRef.current));setCardImage('')}}} disabled={!photo}>Detect edges again</button>
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
