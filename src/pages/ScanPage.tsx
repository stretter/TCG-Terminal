import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

type Source = 'overhead' | 'phone' | 'manual'
type IntakeCard = { id: string; position: number; name: string; set: string; confirmed: boolean }
const positions = [1, 2, 3, 4, 5, 6]

export function ScanPage() {
  const [source, setSource] = useState<Source>('overhead')
  const [cards, setCards] = useState<IntakeCard[]>([])
  const [selected, setSelected] = useState<number>(1)
  const [occupied, setOccupied] = useState<number[]>([1, 2, 3])
  const [name, setName] = useState('')
  const [printing, setPrinting] = useState('')
  const [batch, setBatch] = useState(0)
  const [notice, setNotice] = useState('This is a simulated intake screen. No camera, image recognition, or inventory service is connected.')

  const card = cards.find((item) => item.position === selected)
  const confirmed = cards.filter((item) => item.confirmed).length
  const pending = useMemo(() => cards.filter((item) => !item.confirmed).sort((a, b) => a.position - b.position), [cards])

  function simulateCapture() {
    if (occupied.length === 0) {
      setNotice('Select at least one occupied grid position before simulating a capture.')
      return
    }
    const nextBatch = batch + 1
    const next = [...occupied].sort((a, b) => a - b).map((position) => ({
      id: `INT-${String(nextBatch).padStart(3, '0')}-${String(position).padStart(2, '0')}`,
      position, name: '', set: '', confirmed: false,
    }))
    setBatch(nextBatch)
    setCards(next)
    setSelected(next[0].position)
    setName('')
    setPrinting('')
    setNotice(`Simulation: created ${next.length} individual intake records. Identify each card before condition review.`)
  }

  function selectPosition(position: number) {
    setSelected(position)
    const existing = cards.find((item) => item.position === position)
    setName(existing?.name ?? '')
    setPrinting(existing?.set ?? '')
  }

  function confirmCard() {
    if (!card || !name.trim() || !printing.trim()) {
      setNotice('Choose a captured position and enter both card name and set/printing before confirming.')
      return
    }
    const updated = cards.map((item) => item.position === selected ? { ...item, name: name.trim(), set: printing.trim(), confirmed: true } : item)
    setCards(updated)
    const next = updated.find((item) => !item.confirmed)
    setNotice(`${card.id} confirmed for this simulation. Condition review is not connected yet.`)
    if (next) {
      setSelected(next.position)
      setName(next.name)
      setPrinting(next.set)
    }
  }

  function toggleOccupied(position: number) {
    if (cards.length) return
    setOccupied((previous) => previous.includes(position) ? previous.filter((value) => value !== position) : [...previous, position].sort((a, b) => a - b))
  }

  return (
    <main className="scan-shell">
      <div className="scan-container">
        <header className="scan-header">
          <div><p className="eyebrow">Workflow step 1 · Card intake</p><h1>Scan cards</h1><p className="scan-muted">Batch capture, individual identification, and a clear review queue.</p></div>
          <Link className="scan-home" to="/">← Foundation</Link>
        </header>
        <div className="scan-banner" role="status"><strong>Prototype mode</strong> — camera capture and card recognition are simulated. No photographs are taken or uploaded.</div>
        <div className="scan-layout">
          <section className="scan-panel" aria-label="Capture station">
            <h2>Capture station</h2>
            <p className="scan-muted">Select occupied grid positions, then simulate a capture. Cards must not overlap.</p>
            <div className="scan-source" aria-label="Capture method">
              <button type="button" className={source === 'overhead' ? 'active' : ''} onClick={() => setSource('overhead')}>Overhead camera</button>
              <button type="button" className={source === 'phone' ? 'active' : ''} onClick={() => setSource('phone')}>Use phone instead</button>
              <button type="button" className={source === 'manual' ? 'active' : ''} onClick={() => setSource('manual')}>Manual entry</button>
            </div>
            <p className="scan-mode">{source === 'overhead' ? 'Overhead USB camera: not connected (simulation)' : source === 'phone' ? 'Phone backup: simulated; secure upload link not implemented' : 'Manual fallback: enter a card identity after simulating capture'}</p>
            <div className="scan-grid" aria-label="Six-position scanning grid">
              {positions.map((position) => {
                const entry = cards.find((item) => item.position === position)
                const on = cards.length ? Boolean(entry) : occupied.includes(position)
                return <button key={position} type="button" className={`scan-slot ${on ? 'occupied' : ''} ${cards.length && selected === position ? 'selected' : ''}`} aria-pressed={cards.length ? selected === position : on} onClick={() => cards.length ? entry && selectPosition(position) : toggleOccupied(position)}>
                  <span className="scan-slot-number">Position {String(position).padStart(2, '0')}</span>
                  <span className="scan-slot-symbol">{entry?.confirmed ? '✓' : on ? '▣' : '+'}</span>
                  <span>{entry ? entry.confirmed ? 'Confirmed' : 'Needs ID' : on ? 'Occupied' : 'Empty'}</span>
                </button>
              })}
            </div>
            <div className="scan-actions">
              <button type="button" className="scan-primary" onClick={simulateCapture}>Simulate capture</button>
              <button type="button" className="scan-secondary" onClick={() => {setCards([]);setSelected(1);setName('');setPrinting('');setNotice('Grid reset. Choose occupied positions for your next simulated capture.')}}>Reset grid</button>
            </div>
          </section>
          <section className="scan-panel" aria-label="Identification queue">
            <h2>Identification queue</h2>
            <p className="scan-muted">{cards.length ? `${confirmed} of ${cards.length} confirmed · ${pending.length} pending` : 'Capture a simulated batch to create intake records.'}</p>
            {cards.length ? <div className="scan-queue">{cards.map((item) => <button type="button" key={item.id} onClick={() => selectPosition(item.position)} className={`scan-queue-item ${selected === item.position ? 'selected' : ''}`}>
              <span><strong>Position {String(item.position).padStart(2, '0')}</strong><small>{item.id}</small></span><span>{item.confirmed ? '✓ Confirmed' : 'Needs ID'}</span>
            </button>)}</div> : <p className="scan-empty">No cards captured yet.</p>}
            <div className="scan-identify">
              <h3>Individual identification</h3>
              <p className="scan-muted">{card ? `Position ${String(card.position).padStart(2,'0')} · ${card.id}` : 'Select a captured card to begin.'}</p>
              <label htmlFor="card-name">Card name</label>
              <input id="card-name" value={name} onChange={(event) => setName(event.target.value)} disabled={!card} placeholder="Enter card name" />
              <label htmlFor="card-set">Set / printing</label>
              <input id="card-set" value={printing} onChange={(event) => setPrinting(event.target.value)} disabled={!card} placeholder="Enter set and printing" />
              <button type="button" className="scan-primary" disabled={!card} onClick={confirmCard}>{card?.confirmed ? 'Update confirmed identity' : 'Confirm identity'}</button>
              <p className="scan-footnote">Names are entered manually in this prototype; they are not verified against a card database.</p>
            </div>
          </section>
        </div>
        <p className="scan-notice" role="status">{notice}</p>
        <div className="scan-next"><span>Next: condition review — not yet connected.</span><Link to="/review">Preview review screen →</Link></div>
      </div>
    </main>
  )
}
