import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import { SettingsProvider, applyTheme, readSettings } from './lib/settings'
import { PasswordProvider } from './lib/hooks'

// Paint the first frame in the right theme, before React mounts.
applyTheme(readSettings().theme)

// Files dropped outside a drop zone would otherwise open in the window.
window.addEventListener('dragover', (e) => e.preventDefault())
window.addEventListener('drop', (e) => e.preventDefault())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <PasswordProvider>
        <App />
      </PasswordProvider>
    </SettingsProvider>
  </StrictMode>
)
