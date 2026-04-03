import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { FileText, Calendar, Activity, ChevronRight, Moon, Sun, ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import Logo from '../components/Logo'

const API_BASE = '/api'

export default function History() {
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [user, setUser] = useState(null)
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true'
  })
  
  const navigate = useNavigate()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userRes = await axios.get(`${API_BASE}/contracts/me`)
        if (userRes.data.loggedIn) {
          setUser(userRes.data)
          const historyRes = await axios.get(`${API_BASE}/contracts/user-history`)
          setContracts(historyRes.data)
        } else {
          setError('Please sign in to view your history')
        }
      } catch (err) {
        console.error('Failed to fetch history', err)
        setError('Failed to load history. Please try again later.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('darkMode', 'true')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('darkMode', 'false')
    }
  }, [darkMode])

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const getRiskColor = (score) => {
    if (score >= 70) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30'
    if (score >= 30) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30'
    return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30'
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 transition-colors duration-300">
      {/* Navbar */}
      <nav className="border-b border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-semibold text-gray-900 dark:text-white text-lg tracking-tight">
              Claus<span className="text-blue-600">ify</span>
            </span>
          </Link>
          <div className="h-4 w-px bg-gray-200 dark:border-gray-700"></div>
          <Link to="/" className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
            Home
          </Link>
          <span className="text-sm font-medium text-blue-600">History</span>
        </div>
        
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-3 mr-2">
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-xs font-medium text-gray-900 dark:text-white">{user.name}</span>
                <span className="text-[10px] text-gray-500">{user.email}</span>
              </div>
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs border border-blue-200 dark:border-blue-800">
                {user.name.charAt(0)}
              </div>
            </div>
          )}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {darkMode ? <Sun className="w-5 h-5 text-gray-400" /> : <Moon className="w-5 h-5 text-gray-500" />}
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Analysis History</h1>
            <p className="text-gray-500 dark:text-gray-400">View and manage your past contract evaluations</p>
          </div>
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 px-4 py-2 rounded-lg transition-colors border border-blue-100 dark:border-blue-900/50"
          >
            <ArrowLeft className="w-4 h-4" />
            New Analysis
          </button>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <p className="text-gray-500 dark:text-gray-400 animate-pulse">Loading your history...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl p-12 text-center">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{error}</h2>
            {!user && (
              <a href="/oauth2/authorization/google" 
                 className="mt-4 inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                Sign in with Google
              </a>
            )}
          </div>
        ) : contracts.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-3xl">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FileText className="w-8 h-8 text-gray-300 dark:text-gray-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No analyses yet</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">
              Once you upload contracts, they will appear here for you to access anytime.
            </p>
            <button 
              onClick={() => navigate('/')}
              className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-8 py-3 rounded-xl font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
            >
              Start First Analysis
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {contracts.map((contract) => (
              <div 
                key={contract.id}
                onClick={() => navigate(`/results/${contract.id}`)}
                className="group relative flex items-center justify-between p-5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl hover:border-blue-200 dark:hover:border-blue-900 hover:shadow-lg hover:shadow-blue-500/5 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-5 flex-1 min-w-0">
                  <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <FileText className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">
                      {contract.filename}
                    </h3>
                    <div className="flex items-center gap-4 mt-1">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(contract.createdAt)}
                      </div>
                      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        contract.status === 'complete' ? 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 animate-pulse'
                      }`}>
                        {contract.status}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-right hidden sm:block">
                    <div className="flex items-center gap-2 justify-end">
                      <Activity className={`w-4 h-4 ${contract.riskScore >= 70 ? 'text-red-500' : contract.riskScore >= 30 ? 'text-yellow-500' : 'text-green-500'}`} />
                      <span className={`text-lg font-bold ${contract.riskScore >= 70 ? 'text-red-600' : contract.riskScore >= 30 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {contract.riskScore}
                      </span>
                    </div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Risk Score</p>
                  </div>
                  <div className="w-8 h-8 rounded-full border border-gray-100 dark:border-gray-800 flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:border-blue-600 group-hover:text-white transition-all">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
