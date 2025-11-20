import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import SessionsList from './pages/SessionsList'
import ConversationView from './pages/ConversationView'
import AnalyticsPage from './pages/AnalyticsPage'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        {/* Navigation */}
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <span className="text-xl font-bold text-gray-900">AI Support Admin</span>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <Link
                    to="/"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Sessions
                  </Link>
                  <Link
                    to="/analytics"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Analytics
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<SessionsList />} />
          <Route path="/sessions/:sessionId" element={<ConversationView />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App

