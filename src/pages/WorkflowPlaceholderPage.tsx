import { Link } from 'react-router-dom'

interface WorkflowPlaceholderPageProps {
  step: string
  title: string
  description: string
}

export function WorkflowPlaceholderPage({ step, title, description }: WorkflowPlaceholderPageProps) {
  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Workflow step {step}</p>
        <h1>{title}</h1>
        <p className="lede">{description}</p>
        <Link className="back-link" to="/">Back to foundation</Link>
      </section>
    </main>
  )
}
