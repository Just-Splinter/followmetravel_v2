import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppProvider } from './context/AppContext.jsx'
import Starter from './styles/Starter.jsx'
import { EventsProvider } from './context/EventsContext.jsx'
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleReCaptchaProvider reCaptchaKey="6LeNVCItAAAAACzl-EUU4hBWfoVEpgolXWNND-d_">
      <AppProvider>
        <EventsProvider>
          <Starter />
        </EventsProvider>
      </AppProvider>
    </GoogleReCaptchaProvider>
  </StrictMode>,
)
