import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { FileText, Shield, Zap, Users, ChevronRight, Moon, Sun } from 'lucide-react'
import Logo from '../components/Logo'
const API_BASE = '/api'

export default function Home() {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [darkMode, setDarkMode] = useState(() => {
  return localStorage.getItem('darkMode') === 'true'
  })
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const checkUser = async () => {
      try {
        const res = await axios.get(`${API_BASE}/contracts/me`)
        if (res.data.loggedIn) {
          setUser(res.data)
        }
      } catch (err) {
        console.error('Failed to fetch user', err)
      }
    }
    checkUser()
  }, [])

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await axios.post(`${API_BASE}/contracts/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      navigate(`/results/${response.data.contractId}`)
    } catch (err) {
      setError('Upload failed. Make sure the backend is running.')
      setUploading(false)
    }
  }, [navigate])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: uploading
  })
   
 useEffect(() => {
  if (darkMode) {
    document.documentElement.classList.add('dark')
    localStorage.setItem('darkMode', 'true')
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('darkMode', 'false')
  }
}, [darkMode])

  return (
    <div>
      <div className="min-h-screen bg-white dark:bg-gray-950 transition-colors duration-300">

        {/* Navbar */}
        <nav className="border-b border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={32} />
            <span className="font-semibold text-gray-900 dark:text-white text-lg tracking-tight">
              Claus<span className="text-blue-600">ify</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</span>
                  <span className="text-xs text-gray-500">{user.email}</span>
                </div>
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                  {user.name.charAt(0)}
                </div>
                <a href="/logout" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Sign out</a>
              </div>
            ) : (
              <a href="/oauth2/authorization/google"
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </a>
            )}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {darkMode
                ? <Sun className="w-5 h-5 text-gray-400" />
                : <Moon className="w-5 h-5 text-gray-500" />
              }
            </button>
          </div>
        </nav>

        {/* Hero */}
        <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-4 py-1.5 rounded-full text-sm font-medium mb-8">
            <Shield className="w-3.5 h-3.5" />
            Free · Private · No signup needed
          </div>

          <h1 className="text-5xl font-bold text-gray-900 dark:text-white leading-tight tracking-tight mb-6">
            Understand any contract<br />
            <span className="text-blue-600">before you sign</span>
          </h1>

          <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            Upload your contract and get instant risk analysis, plain English explanations,
            and fairer alternatives — powered by AI, completely private.
          </p>

          {/* Upload Zone */}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-2xl p-16 cursor-pointer transition-all duration-200
              ${isDragActive
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-950'
                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-gray-900'
              }
              ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-gray-900 dark:bg-white rounded-2xl flex items-center justify-center">
                <FileText className="w-8 h-8 text-white dark:text-gray-900" />
              </div>
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-600 dark:text-gray-400 font-medium">Uploading and analyzing...</p>
                </div>
              ) : isDragActive ? (
                <p className="text-blue-600 font-medium text-lg">Drop your contract here</p>
              ) : (
                <>
                  <p className="text-gray-700 dark:text-gray-300 font-medium text-lg">
                    Drop your PDF contract here
                  </p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm">
                    or click to browse · PDF files only
                  </p>
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Features */}
          <div className="grid grid-cols-3 gap-6 mt-16">
            {[
              { icon: Shield, title: 'Privacy first', desc: 'Your contract never leaves your analysis environment unredacted' },
              { icon: Zap, title: 'Instant analysis', desc: 'Full risk breakdown in under 60 seconds' },
              { icon: Users, title: 'Built for everyone', desc: 'Freelancers, students, small businesses — anyone who signs contracts' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="text-left p-6 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors">
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}