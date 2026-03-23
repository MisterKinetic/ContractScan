import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { FileText, Shield, Zap, Users, ChevronRight, Moon, Sun } from 'lucide-react'

const API_BASE = 'http://localhost:8080/api'

export default function Home() {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [darkMode, setDarkMode] = useState(() => {
  return localStorage.getItem('darkMode') === 'true'
  })
  const navigate = useNavigate()

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
            <div className="w-8 h-8 bg-gray-900 dark:bg-white rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-white dark:text-gray-900" />
            </div>
            <span className="font-semibold text-gray-900 dark:text-white text-lg tracking-tight">
              Contract<span className="text-blue-600">Scan</span>
            </span>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {darkMode
              ? <Sun className="w-5 h-5 text-gray-400" />
              : <Moon className="w-5 h-5 text-gray-500" />
            }
          </button>
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