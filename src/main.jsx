import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Starter from './styles/Starter.jsx'
import { EventsProvider } from './context/EventsContext.jsx'

// AppProvider used to wrap this tree. Its only remaining consumer was the
// sidebar badge, and its state came from src/data/seed.js — mock packages and
// reservations shipped to every visitor. Both are gone; the badge now reads
// Appwrite (see usePendingReservations).

// GoogleReCaptchaProvider used to wrap this whole tree, loading Google's
// script (and its framed iframe) on every single page — the admin login,
// every marketing page, all of it — even though only the two booking flows
// (BookingFlow.jsx, OmraBooking.jsx) ever call useGoogleReCaptcha(). It's
// scoped locally around each of those now instead.

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <EventsProvider>
      <Starter />
    </EventsProvider>
  </StrictMode>,
)
