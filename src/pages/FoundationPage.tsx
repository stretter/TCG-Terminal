import { Link } from 'react-router-dom'

const steps = [
  { label: 'Scan', path: '/scan' },
  { label: 'Review', path: '/review' },
  { label: 'Finalize', path: '/finalize' },
  { label: 'Manager Review', path: '/manager-review' },
]

export function FoundationPage() {
  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Foundation check</p>
        <h1>TCG Terminal</h1>
        <p className="lede">
          React + TypeScript is running. Routing is connected and ready for the
          employee card-intake workflow.
        </p>
        <div className="status" role="status">
          <span className="status-dot" aria-hidden="true" />
          Application foundation ready
        </div>
        <nav className="workflow-links" aria-label="Planned workflow">
          {steps.map((step) => (
            <Link key={step.path} to={step.path}>{step.label}</Link>
          ))}
        </nav>
      </section>
    </main>
  )
}
