import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'
import { ServerHealthProvider } from './context/ServerHealthContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <ServerHealthProvider>
        <App />
      </ServerHealthProvider>
    </ThemeProvider>
  </StrictMode>,
)

