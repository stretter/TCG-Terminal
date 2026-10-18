import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'

type Point = { x: number; y: number }
const fallback: Point[] = [{x:.12,y:.08},{x:.88,y:.08},{x:.88,y:.92},{x:.12,y:.92}]
const clamp = (x:number) => Math.max(0,Math.min(1,x))

// Experimental rotation-aware contour detector. Sobel edges are linked into
// connected components; large card-shaped contours are scored and four corner
// extrema are extracted. This is not trained card recognition.
function proposeCorners(image: HTMLImageElement): Point[] | null {
  const size=280,w=size,h=size
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null
  ctx.drawImage(image,0,0,w,h)
  const rgba=ctx.getImageData(0,0,w,h).data
  const gray=new Float32Array(w*h)
  for(let i=0;i<gray.length;i++)gray[i]=.299*rgba[4*i]+.587*rgba[4*i+1]+.114*rgba[4*i+2]
  const strength=new Float32Array(w*h)
  let total=0,valid=0
  for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){
    const i=y*w+x
    const gx=-gray[i-w-1]+gray[i-w+1]-2*gray[i-1]+2*gray[i+1]-gray[i+w-1]+gray[i+w+1]
    const gy=-gray[i-w-1]-2*gray[i-w]-gray[i-w+1]+gray[i+w-1]+2*gray[i+w]+gray[i+w+1]
    const value=Math.hypot(gx,gy)
    strength[i]=value;total+=value;valid++
  }
  const threshold=Math.max(95,Math.min(220,(total/Math.max(1,valid))*2.25))
  const edges=new Uint8Array(w*h)
  // Small dilation links weak breaks around rounded card corners.
  for(let y=3;y<h-3;y++)for(let x=3;x<w-3;x++)
    if(strength[y*w+x]>threshold)
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)
        edges[(y+dy)*w+x+dx]=1
  const seen=new Uint8Array(w*h)
  const offsets=[-w-1,-w,-w+1,-1,1,w-1,w,w+1]
  let best:Point[]|null=null,bestScore=-Infinity
  for(let y=5;y<h-5;y+=2)for(let x=5;x<w-5;x+=2){
    const index=y*w+x
    if(!edges[index]||seen[index])continue
    const queue=[index];seen[index]=1
    let head=0,minX=w,minY=h,maxX=0,maxY=0
    const boundary:number[]=[]
    while(head<queue.length){
      const i=queue[head++],px=i%w,py=Math.floor(i/w)
      minX=Math.min(minX,px);maxX=Math.max(maxX,px)
      minY=Math.min(minY,py);maxY=Math.max(maxY,py)
      boundary.push(i)
      if(px<3||px>=w-3||py<3||py>=h-3)continue
      for(const off of offsets){const at=i+off;if(edges[at]&&!seen[at]){seen[at]=1;queue.push(at)}}
    }
    const width=maxX-minX,height=maxY-minY
    if(boundary.length<120||width<35||height<45||width*height<3500)continue
    // Reject components extending into the edge of the photograph.
    if(minX<3||minY<3||maxX>=w-3||maxY>=h-3)continue
    // Extract outer quadrilateral by the farthest points in four diagonal directions.
    let tl=boundary[0],tr=tl,br=tl,bl=tl
    let minSum=Infinity,maxSum=-Infinity,minDiff=Infinity,maxDiff=-Infinity
    for(const p of boundary){
      const px=p%w,py=Math.floor(p/w),sum=px+py,diff=py-px
      if(sum<minSum){minSum=sum;tl=p}
      if(sum>maxSum){maxSum=sum;br=p}
      if(diff<minDiff){minDiff=diff;tr=p}
      if(diff>maxDiff){maxDiff=diff;bl=p}
    }
    const points=[tl,tr,br,bl].map(p=>({x:(p%w)/w,y:Math.floor(p/w)/h}))
    const length=(a:Point,b:Point)=>Math.hypot((a.x-b.x)*image.naturalWidth,(a.y-b.y)*image.naturalHeight)
    const top=length(points[0],points[1]),bottom=length(points[3],points[2])
    const left=length(points[0],points[3]),right=length(points[1],points[2])
    const ww=(top+bottom)/2,hh=(left+right)/2
    if(ww<1||hh<1)continue
    const ratio=ww/hh
    if(ratio<.48||ratio>.98)continue
    const cross=(a:Point,b:Point,d:Point)=>(b.x-a.x)*(d.y-a.y)-(b.y-a.y)*(d.x-a.x)
    if(cross(points[0],points[1],points[2])<=0||cross(points[1],points[2],points[3])<=0)continue
    const polygonArea=Math.abs(points.reduce((sum,p,i)=>{
      const q=points[(i+1)%4];return sum+p.x*q.y-q.x*p.y
    },0))/2
    if(polygonArea<.08||polygonArea>.85)continue
    const ratioFit=Math.exp(-Math.pow(Math.log(ratio/(63/88))/.3,2))
    // Favor the physical outer contour over the usually smaller artwork frame.
    const score=polygonArea*(.4+.6*ratioFit)+Math.min(boundary.length/10000,.08)
    if(score>bestScore){bestScore=score;best=points}
  }
  return best
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
  const [slots,setSlots]=useState<Record<number,{image:string;approved:boolean}>>({})
  const [message,setMessage]=useState('Load a photo to propose card edges.')
  const imageRef=useRef<HTMLImageElement|null>(null)
  const dragRef=useRef<number|null>(null)
  useEffect(()=>{
    if(!photo){imageRef.current=null;return}
    let cancelled=false
    const img=new Image()
    img.onload=()=>{
      if(cancelled)return
      imageRef.current=img
      const proposed=proposeCorners(img)
      setCorners(proposed ?? fallback)
      setMessage(proposed ? 'Candidate crop placed in the next open position. Check its borders and approve or reject it.' : 'No reliable card detected. Adjust the four corners before approving.')
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
  const nextPosition=[1,2,3,4,5,6].find(position => slots[position]?.approved !== true)
  const [draftImage,setDraftImage]=useState('')
  useEffect(()=>{
    if (!imageRef.current || !photo) { setDraftImage(''); return }
    // Keep the currently active position in sync when corners move.
    setDraftImage(straighten(imageRef.current,corners))
  },[corners,photo])

  function approve(position:number) {
    if(!draftImage || position!==nextPosition)return
    setSlots(previous=>({...previous,[position]:{image:draftImage,approved:true}}))
    setMessage(`Position ${String(position).padStart(2,'0')} accepted. Capture or upload another card.`)
  }
  function reject(position:number) {
    if(position!==nextPosition)return
    setDraftImage('')
    setMessage('Retake selected. Adjust the corners or capture/upload another photo.')
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
      <button type="button" className="scan-secondary" onClick={()=>{if(imageRef.current){const proposed=proposeCorners(imageRef.current);setCorners(proposed ?? fallback);setMessage(proposed ? 'Possible card boundary found; please verify.' : 'No reliable boundary found; position corners manually.')}}} disabled={!photo}>Detect edges again</button>
    </div>
    <p className="scan-mode">Card crop positions: proposed crops appear automatically. Accept the crop or retake it directly in its position.</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8}}>
      {[1,2,3,4,5,6].map(n=>{
        const approved=slots[n]?.approved===true
        const image=approved?slots[n].image:n===nextPosition?draftImage:''
        return <div key={n} style={{border:approved?'2px solid #22c55e':n===nextPosition?'2px solid #60a5fa':'1px solid #475569',padding:5,minHeight:85,borderRadius:8}}>
          <small>Position {String(n).padStart(2,'0')} {approved?'· accepted':n===nextPosition?'· awaiting review':''}</small>
          {image&&<img src={image} alt={`Card crop at position ${n}`} style={{width:'100%',display:'block',marginTop:5}}/>}
          {n===nextPosition&&image&&<div className="scan-actions">
            <button type="button" onClick={()=>approve(n)}>Accept</button>
            <button type="button" onClick={()=>reject(n)}>Retake</button>
          </div>}
        </div>
      })}
    </div>
    <button type="button" className="scan-secondary" onClick={()=>{setSlots({});setMessage('Card positions cleared.')}}>Clear crop previews</button>
    <p className="scan-mode" role="status">{message}</p>
  </section>
}
