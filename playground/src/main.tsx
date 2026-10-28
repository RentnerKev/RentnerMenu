import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
// oxlint-disable-next-line import/no-unassigned-import -- Vite loads the playground stylesheet.
import './styles.css'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
)
