import { BrowserRouter, Routes, Route } from 'react-router-dom'
import SessionsList from './pages/SessionsList'
import ConversationView from './pages/ConversationView'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SessionsList />} />
        <Route path="/sessions/:sessionId" element={<ConversationView />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

