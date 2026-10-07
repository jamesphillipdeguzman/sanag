import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'
import { ServerHealthProvider } from './context/ServerHealthContext'
import { SettingsProvider } from './context/SettingsContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <SettingsProvider>
        <ServerHealthProvider>
          <App />
        </ServerHealthProvider>
      </SettingsProvider>
    </ThemeProvider>
  </StrictMode>,
)

