import PDFViewer from '../components/PDFViewer'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { FileText, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, ArrowLeft, Moon, Sun } from 'lucide-react'

const API_BASE = 'http://localhost:8080/api'

const riskConfig = {
  red: {
    label: 'High Risk',
    bg: 'bg-red-50 dark:bg-red-950',
    border: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
    icon: XCircle,
    iconColor: 'text-red-500',
    dot: 'bg-red-500'
  },
  yellow: {
    label: 'Caution',
    bg: 'bg-yellow-50 dark:bg-yellow-950',
    border: 'border-yellow-200 dark:border-yellow-800',
    badge: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
    icon: AlertTriangle,
    iconColor: 'text-yellow-500',
    dot: 'bg-yellow-500'
  },
  green: {
    label: 'Fair',
    bg: 'bg-green-50 dark:bg-green-950',
    border: 'border-green-200 dark:border-green-800',
    badge: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
    icon: CheckCircle,
    iconColor: 'text-green-500',
    dot: 'bg-green-500'
  }
}

function FindingCard({  finding, onSelect, isActive }) {
  const [expanded, setExpanded] = useState(false)
  const config = riskConfig[finding.riskLevel] || riskConfig.yellow
  const Icon = config.icon

  return (
    <div className={`border rounded-xl overflow-hidden transition-all duration-200 ${config.border}`}>
      <button
        onClick={() => { setExpanded(!expanded); onSelect(); }}
        className={`w-full text-left p-4 flex items-start gap-3 ${config.bg} hover:opacity-90 transition-opacity`}
      >
        <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${config.iconColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.badge}`}>
              {config.label}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
              {finding.clauseType?.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {finding.plainEnglish || 'Click to see analysis'}
          </p>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
          : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
        }
      </button>

      {expanded && finding.suggestion && (
        <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Fairer alternative
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {finding.suggestion}
          </p>
        </div>
      )}
    </div>
  )
}

function RiskMeter({ score }) {
  const color = score >= 70 ? 'bg-red-500' : score >= 40 ? 'bg-yellow-500' : 'bg-green-500'
  const label = score >= 70 ? 'High Risk' : score >= 40 ? 'Medium Risk' : 'Low Risk'
  const textColor = score >= 70 ? 'text-red-600 dark:text-red-400' : score >= 40 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 text-center">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Risk Score</p>
      <p className={`text-6xl font-bold mb-1 ${textColor}`}>{score}</p>
      <p className={`text-sm font-medium mb-4 ${textColor}`}>{label}</p>
      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

export default function Results() {
  const { contractId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [activeFinding, setActiveFinding] = useState(null)
  const [darkMode, setDarkMode] = useState(false)
  const [polling, setPolling] = useState(true)
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])
  useEffect(() => {
    if (!polling) return

    const fetchResults = async () => {
      try {
        const statusRes = await axios.get(`${API_BASE}/contracts/${contractId}/status`)
        const status = statusRes.data.status

        if (status === 'complete') {
          const resultsRes = await axios.get(`${API_BASE}/contracts/${contractId}/results`)
          setData(resultsRes.data)
          setLoading(false)
          setPolling(false)
        } else if (status === 'failed') {
          setError('Analysis failed. Please try again.')
          setLoading(false)
          setPolling(false)
        }
      } catch (err) {
        setError('Could not fetch results.')
        setLoading(false)
        setPolling(false)
      }
    }

    fetchResults()
    const interval = setInterval(fetchResults, 5000)
    return () => clearInterval(interval)
  }, [contractId, polling])

  const filteredFindings = data?.findings?.filter(f =>
    filter === 'all' ? true : f.riskLevel === filter
  ) || []

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">

        {/* Navbar */}
        <nav className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gray-900 dark:bg-white rounded-lg flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-white dark:text-gray-900" />
              </div>
              <span className="font-semibold text-gray-900 dark:text-white tracking-tight">
                Contract<span className="text-blue-600">Scan</span>
              </span>
            </div>
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

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center min-h-96 gap-6">
            <div className="w-12 h-12 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-gray-700 dark:text-gray-300 font-medium text-lg mb-2">
                Analyzing your contract...
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-sm">
                Running 7-stage AI pipeline · Usually takes 30-60 seconds
              </p>
            </div>
            <div className="flex flex-col gap-2 w-64">
              {[
                'Parsing PDF structure',
                'Redacting personal information',
                'Detecting clause boundaries',
                'Generating embeddings',
                'Running AI analysis',
                'Mapping risk to document',
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                  <p className="text-sm text-gray-500 dark:text-gray-400">{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="max-w-lg mx-auto mt-20 p-6 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-2xl text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-700 dark:text-red-300 font-medium">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Try again
            </button>
          </div>
        )}

        {/* Results */}
        {data && (
          <div className="max-w-6xl mx-auto px-6 py-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                Contract Analysis Complete
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {data.findings?.length} clauses analyzed
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

              {/* Sidebar */}
              <div className="space-y-4">
                <RiskMeter score={data.riskScore} />

                {/* Stats */}
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
                  <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Breakdown</p>
                  <div className="space-y-3">
                    {[
                      { label: 'Red flags', count: data.redCount, dot: 'bg-red-500', filter: 'red' },
                      { label: 'Cautions', count: data.yellowCount, dot: 'bg-yellow-500', filter: 'yellow' },
                      { label: 'Fair clauses', count: data.greenCount, dot: 'bg-green-500', filter: 'green' },
                    ].map(item => (
                      <button
                        key={item.filter}
                        onClick={() => setFilter(filter === item.filter ? 'all' : item.filter)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                          filter === item.filter
                            ? 'bg-gray-100 dark:bg-gray-800'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${item.dot}`} />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.count}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => navigate('/')}
                  className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Analyze another contract
                </button>
              </div>

              {/* Findings */}
              <div className="lg:col-span-3 space-y-3">
                {/* PDF Viewer */}
  <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 mb-6 max-h-96 overflow-y-auto">
    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Original Document</p>
    <PDFViewer
      pdfUrl={`http://localhost:8080/api/contracts/${contractId}/pdf`}
      findings={data?.findings || []}
      activeFinding={activeFinding}
    />
  </div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    {filter === 'all' ? 'All clauses' : `${filter === 'red' ? 'Red flags' : filter === 'yellow' ? 'Cautions' : 'Fair clauses'}`}
                    <span className="ml-2 text-gray-400 font-normal text-sm">({filteredFindings.length})</span>
                  </h2>
                  {filter !== 'all' && (
                    <button
                      onClick={() => setFilter('all')}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Show all
                    </button>
                  )}
                </div>
               {filteredFindings.map(finding => (
  <FindingCard 
    key={finding.id} 
    finding={finding}
    onSelect={() => setActiveFinding(finding)}
    isActive={activeFinding?.id === finding.id}
  />
))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}