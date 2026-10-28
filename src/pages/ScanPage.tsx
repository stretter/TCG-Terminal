import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CameraPreview } from '../components/CameraPreview'

type Status = 'bulk' | 'review'
type Intake = { id: string; name: string; printing: string; value: number | null; status: Status; reason: string }
const PRICE_LIMIT = 5
const CONFIDENCE_LIMIT = 0.95

export function ScanPage() {
  const [items, setItems] = useState<Intake[]>([])
  const [counter, setCounter] = useState(0)
  const [name, setName] = useState('')
  const [printing, setPrinting] = useState('')
  const [value, setValue] = useState('')
  const [confidence, setConfidence] = useState('98')
  const [finishKnown, setFinishKnown] = useState(true)
  const [playable, setPlayable] = useState(true)
  const [scanState, setScanState] = useState<'ready' | 'accepted' | 'review'>('ready')
  const [notice, setNotice] = useState('Prototype: simulated identification only. Live card recognition, pricing, and automatic capture are not connected.')

  function submitSimulatedScan() {
    const estimated = value.trim() === '' ? null : Number(value)
    const confidenceNumber = Number(confidence) / 100
    const identified = Boolean(name.trim() && printing.trim())
    const validValue = estimated !== null && Number.isFinite(estimated) && estimated >= 0
    const automatic = identified && validValue && estimated < PRICE_LIMIT &&
      confidenceNumber >= CONFIDENCE_LIMIT && finishKnown && playable
    const reason = automatic ? 'Confident match; below bulk threshold' :
      !identified ? 'Card or printing unidentified' :
      !validValue ? 'Price unknown or invalid' :
      estimated >= PRICE_LIMIT ? 'Potentially valuable card' :
      confidenceNumber < CONFIDENCE_LIMIT ? 'Low recognition confidence' :
      !finishKnown ? 'Finish / foil status uncertain' : 'Playability concern'
    const next = counter + 1
    setCounter(next)
    setItems(previous => [{ id: `INT-${String(next).padStart(4, '0')}`, name: name.trim() || 'Unknown card',
      printing: printing.trim() || 'Unknown printing', value: validValue ? estimated : null,
      status: automatic ? 'bulk' : 'review', reason }, ...previous])
    setScanState(automatic ? 'accepted' : 'review')
    setNotice(automatic ? 'Automatically added to bulk intake. Ready for the next arriving card.' :
      `Sent to review: ${reason}. Ready for the next arriving card.`)
    resetEntry()
  }

  function resetEntry() {
    setName('')
    setPrinting('')
    setValue('')
    setConfidence('98')
    setFinishKnown(true)
    setPlayable(true)
  }

  const bulkCount = items.filter(item => item.status === 'bulk').length
  const reviewCount = items.filter(item => item.status === 'review').length
  return (
    <main className="scan-shell">
      <div className="scan-container">
        <header className="scan-header">
          <div>
            <p className="eyebrow">Workflow step 1 · Bulk intake</p>
            <h1>Single-card bulk scanner</h1>
            <p className="scan-muted">Each new card arrival triggers an independent scan. Previously scanned cards can accumulate in the output tray.</p>
          </div>
          <Link className="scan-home" to="/">← Foundation</Link>
        </header>
        <div className="scan-banner" role="status">
          <strong>Prototype simulation</strong> — recognition scores and prices are entered manually for testing.
          The simulation treats each button press as a new card arrival. In live capture, an arrival transition and stable image must be detected before each scan; no automatic recognition or inventory upload yet.
        </div>
        <div className={`scan-live-status scan-live-status--${scanState}`} role="status" aria-live="polite">
          <span className="scan-status-icon" aria-hidden="true">{scanState === 'ready' ? '◎' : scanState === 'accepted' ? '✓' : '!'}</span>
          <div className="scan-status-message"><strong>{scanState === 'ready' ? 'Ready — waiting for next card' : scanState === 'accepted' ? 'Added to bulk queue' : 'Set aside for review'}</strong>
            <span>{scanState === 'ready' ? 'Camera capture will start when the next card arrives (not yet connected).' : notice}</span>
          </div>
          <div className="scan-status-counts"><span><strong>{bulkCount}</strong> bulk accepted</span><span><strong>{reviewCount}</strong> needs review</span></div>
        </div>
        <div className="scan-layout">
          <section className="scan-panel" aria-label="Bulk scanner simulator">
            <h2>Camera station</h2>
            <p className="scan-muted">One card at a time. The collection tray can hold previously scanned cards.</p>
            <details className="scan-camera-experiment" open>
              <summary>Camera preview and existing crop experiment</summary>
              <CameraPreview />
            </details>
            <h3>Bulk scanning rules</h3>
            <p className="scan-muted">Auto-queue only if the exact card and printing are known, confidence is at least 95%, estimated value is under $5, finish is known, and the card passes a quick playability check. These are provisional settings.</p>
            <div className="scan-identify">
              <h3>Simulate one identified card</h3>
              <label htmlFor="bulk-name">Card name</label>
              <input id="bulk-name" value={name} onChange={event => setName(event.target.value)} placeholder="Example: Llanowar Elves" />
              <label htmlFor="bulk-printing">Exact set / printing</label>
              <input id="bulk-printing" value={printing} onChange={event => setPrinting(event.target.value)} placeholder="Set and collector number" />
              <label htmlFor="bulk-value">Estimated resale value in USD</label>
              <input id="bulk-value" type="number" min="0" step="0.01" value={value} onChange={event => setValue(event.target.value)} placeholder="Leave blank to test unknown value" />
              <label htmlFor="bulk-confidence">Simulated recognition confidence (%)</label>
              <input id="bulk-confidence" type="number" min="0" max="100" value={confidence} onChange={event => setConfidence(event.target.value)} />
              <label><input type="checkbox" checked={finishKnown} onChange={event => setFinishKnown(event.target.checked)} /> Finish / foil status verified</label>
              <label><input type="checkbox" checked={playable} onChange={event => setPlayable(event.target.checked)} /> Quick playability check passed</label>
              <div className="scan-actions">
                <button type="button" className="scan-primary" onClick={submitSimulatedScan}>Simulate next card arriving</button>
                <button type="button" className="scan-secondary" onClick={() => {resetEntry();setScanState("ready");setNotice("Ready to simulate the next arrival.")}}>Reset form</button>
              </div>
              <p className="scan-mode" role="status">{notice}</p>
            </div>
          </section>
          <section className="scan-panel" aria-label="Intake queue">
            <h2>Intake queue</h2>
            <p className="scan-muted">{bulkCount} automatically queued · {reviewCount} need review</p>
            {items.length === 0 ? <p className="scan-empty">No cards scanned yet.</p> :
              <div className="scan-queue">
                {items.map(item => <div key={item.id} className="scan-queue-item">
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.id} · {item.printing}</small>
                    <small>{item.value === null ? 'Price unknown' : `$${item.value.toFixed(2)}`} · {item.reason}</small>
                  </span>
                  <span>{item.status === 'bulk' ? 'Bulk queued' : 'Review'}</span>
                </div>)}
              </div>}
            <div className="scan-actions">
              <button type="button" className="scan-secondary" onClick={() => {
                setItems([]); setCounter(0); resetEntry(); setScanState('ready'); setNotice('Simulation cleared.')
              }}>Clear simulated queue</button>
            </div>
            <p className="scan-footnote">A card with unknown identity, value, or finish never automatically enters bulk. This screen does not estimate real prices or identify cards yet.</p>
          </section>
        </div>
        <div className="scan-next"><span>Next: connect real single-card capture and a card-identification service.</span><Link to="/review">Preview review screen →</Link></div>
      </div>
    </main>
  )
}
