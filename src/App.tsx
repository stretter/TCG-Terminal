import { Navigate, Route, Routes } from 'react-router-dom'
import { FoundationPage } from './pages/FoundationPage'
import { WorkflowPlaceholderPage } from './pages/WorkflowPlaceholderPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<FoundationPage />} />
      <Route path="/scan" element={<WorkflowPlaceholderPage step="1" title="Scan" description="Card identification will begin here." />} />
      <Route path="/review" element={<WorkflowPlaceholderPage step="2" title="Review" description="Condition review and flagged areas will live here." />} />
      <Route path="/finalize" element={<WorkflowPlaceholderPage step="3" title="Finalize" description="Acquisition details and confirmation will live here." />} />
      <Route path="/manager-review" element={<WorkflowPlaceholderPage step="Manager" title="Manager Review" description="Remote manager assistance will be connected here." />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
