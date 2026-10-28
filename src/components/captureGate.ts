/** Experimental motion/stability gate; does NOT establish card identity or value. */
export type CapturePhase = 'ready' | 'detecting' | 'captured'
export class CaptureGate {
  private phase: CapturePhase = 'ready'
  private movementFrames = 0
  private stableSince: number | null = null
  private lastCaptureAt = -Infinity
  constructor(private stableMs = 600, private minGapMs = 900, private requiredFrames = 2) {}
  reset() { this.phase='ready'; this.movementFrames=0; this.stableSince=null; this.lastCaptureAt=-Infinity }
  update(now: number, moving: boolean): { phase: CapturePhase; capture: boolean } {
    if (!Number.isFinite(now)) return { phase:this.phase, capture:false }
    if (moving) {
      if (this.phase !== 'detecting') {
        this.movementFrames++
        if (this.movementFrames >= this.requiredFrames && now-this.lastCaptureAt>=this.minGapMs) {
          this.phase='detecting';this.stableSince=null;this.movementFrames=0
        }
      } else this.stableSince=null
      return { phase:this.phase, capture:false }
    }
    if (this.phase === 'detecting') {
      if (this.stableSince === null) this.stableSince=now
      if (now-this.stableSince>=this.stableMs && now-this.lastCaptureAt>=this.minGapMs) {
        this.phase='captured';this.lastCaptureAt=now
        return { phase:this.phase,capture:true }
      }
    } else this.movementFrames=0
    return { phase:this.phase,capture:false }
  }
  getPhase() { return this.phase }
}
