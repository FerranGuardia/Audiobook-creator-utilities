import { useState, useEffect } from 'react'
import './AllInOneView.css'

function AllInOneView({ onBack }) {
  // URL states with history
  const [baseUrl, setBaseUrl] = useState('https://novelbin.com/')
  const [startUrl, setStartUrl] = useState('https://novelbin.com/b/naruto-uchihas-unserious-saga#tab-chapters-title')
  const [baseUrlHistory, setBaseUrlHistory] = useState([])
  const [startUrlHistory, setStartUrlHistory] = useState([])
  
  // Chapter range
  const [startChapter, setStartChapter] = useState('1')
  const [endChapter, setEndChapter] = useState('390')
  const [numChapters, setNumChapters] = useState('')
  const [batchSize, setBatchSize] = useState('10')
  
  // TTS Settings
  const [selectedVoice, setSelectedVoice] = useState('en-US-AndrewNeural')
  const [rate, setRate] = useState(0)
  const [pitch, setPitch] = useState(0)
  const [volume, setVolume] = useState(0)
  const [voices, setVoices] = useState([])
  const [loadingVoices, setLoadingVoices] = useState(true)
  
  // Processing state
  const [processing, setProcessing] = useState(false)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    currentChapter: null,
    status: 'idle',
    completedBatches: 0,
    totalBatches: 0
  })
  const [logs, setLogs] = useState(['Ready to start. Configure settings and click "Start Processing".'])
  const [audioFiles, setAudioFiles] = useState([])

  // Load URL history
  useEffect(() => {
    const savedBaseUrls = localStorage.getItem('allinone_base_urls')
    const savedStartUrls = localStorage.getItem('allinone_start_urls')
    
    if (savedBaseUrls) {
      const urls = JSON.parse(savedBaseUrls)
      setBaseUrlHistory(urls)
    }
    
    if (savedStartUrls) {
      const urls = JSON.parse(savedStartUrls)
      setStartUrlHistory(urls)
    }
  }, [])

  // Load voices
  useEffect(() => {
    loadVoices()
  }, [])

  const loadVoices = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/voices?locale=en')
      if (response.ok) {
        const data = await response.json()
        const englishVoices = data.voices || []
        setVoices(englishVoices)
        if (englishVoices.length > 0) {
          setSelectedVoice(englishVoices[0].ShortName)
        }
      }
    } catch (error) {
      addLog(`⚠️ Could not load voices: ${error.message}`)
    } finally {
      setLoadingVoices(false)
    }
  }

  const saveUrlToHistory = (base, start) => {
    if (base && !baseUrlHistory.includes(base)) {
      const newBaseHistory = [base, ...baseUrlHistory].slice(0, 20)
      setBaseUrlHistory(newBaseHistory)
      localStorage.setItem('allinone_base_urls', JSON.stringify(newBaseHistory))
    }
    
    if (start && !startUrlHistory.includes(start)) {
      const newStartHistory = [start, ...startUrlHistory].slice(0, 20)
      setStartUrlHistory(newStartHistory)
      localStorage.setItem('allinone_start_urls', JSON.stringify(newStartHistory))
    }
  }

  const addLog = (message) => {
    setLogs(prev => [...prev, message])
  }

  const clearLogs = () => {
    setLogs(['Log cleared.'])
  }

  const handleStartProcessing = async () => {
    if (!baseUrl.trim() && !startUrl.trim()) {
      addLog('❌ Please enter URLs')
      return
    }

    // Validate
    const start = parseInt(startChapter) || 1
    let end = null
    let num = null

    if (endChapter.trim()) {
      end = parseInt(endChapter)
      if (end < start) {
        addLog('❌ End chapter must be >= start chapter')
        return
      }
    }

    if (numChapters.trim()) {
      num = parseInt(numChapters)
      if (num < 1) {
        addLog('❌ Number of chapters must be >= 1')
        return
      }
    }

    if (end !== null && num !== null) {
      addLog('❌ Use either "End chapter" OR "Number of chapters", not both')
      return
    }

    if (!end && !num) {
      addLog('❌ Please specify end chapter or number of chapters')
      return
    }

    // Save URLs
    saveUrlToHistory(baseUrl.trim(), startUrl.trim())

    setProcessing(true)
    setPaused(false)
    setProgress({
      current: 0,
      total: end ? (end - start + 1) : num,
      currentChapter: null,
      status: 'starting',
      completedBatches: 0,
      totalBatches: 0
    })

    addLog('='.repeat(60))
    addLog('🚀 Starting All-in-One Processing')
    addLog(`Base URL: ${baseUrl || 'Not specified'}`)
    addLog(`Start URL: ${startUrl || baseUrl}`)
    addLog(`Chapters: ${start} to ${end || (start + num - 1)}`)
    addLog(`Batch size: ${batchSize} chapters per audio file`)
    addLog(`Voice: ${selectedVoice}`)
    addLog('='.repeat(60))

    try {
      const response = await fetch('http://127.0.0.1:8000/api/process-all-in-one', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base_url: baseUrl.trim() || undefined,
          start_url: startUrl.trim() || baseUrl.trim(),
          start_chapter: start,
          end_chapter: end || undefined,
          num_chapters: num || undefined,
          batch_size: parseInt(batchSize) || 10,
          voice: selectedVoice,
          rate: rate,
          pitch: pitch,
          volume: volume,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Error starting processing')
      }

      // Start polling for progress
      pollProgress()
    } catch (error) {
      addLog(`❌ Error: ${error.message}`)
      setProcessing(false)
    }
  }

  const pollProgress = async () => {
    const interval = setInterval(async () => {
      if (paused) {
        clearInterval(interval)
        return
      }

      try {
        const response = await fetch('http://127.0.0.1:8000/api/process-status')
        if (response.ok) {
          const status = await response.json()
          setProgress(status)
          
          if (status.currentChapter) {
            addLog(`📖 Processing chapter ${status.currentChapter.chapter_number}: ${status.currentChapter.title || 'Untitled'}`)
          }

          if (status.status === 'completed') {
            clearInterval(interval)
            setProcessing(false)
            addLog('✅ Processing completed!')
            addLog(`📁 Generated ${status.completedBatches} audio file(s)`)
            
            // Get list of generated files
            try {
              const filesResponse = await fetch('http://127.0.0.1:8000/api/list-audio-files')
              if (filesResponse.ok) {
                const files = await filesResponse.json()
                setAudioFiles(files.files || [])
                addLog(`📋 Available audio files: ${files.files?.length || 0}`)
              }
            } catch (e) {
              console.error('Error getting file list:', e)
            }
          } else if (status.status === 'error') {
            clearInterval(interval)
            setProcessing(false)
            addLog(`❌ Processing failed: ${status.error || 'Unknown error'}`)
          }
        }
      } catch (error) {
        console.error('Error polling progress:', error)
      }
    }, 2000) // Poll every 2 seconds
  }

  const handlePause = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/process-pause', {
        method: 'POST',
      })
      if (response.ok) {
        setPaused(true)
        addLog('⏸️ Processing paused')
      }
    } catch (error) {
      addLog(`❌ Error pausing: ${error.message}`)
    }
  }

  const handleResume = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/process-resume', {
        method: 'POST',
      })
      if (response.ok) {
        setPaused(false)
        addLog('▶️ Processing resumed')
        pollProgress()
      }
    } catch (error) {
      addLog(`❌ Error resuming: ${error.message}`)
    }
  }

  const handleStop = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/process-stop', {
        method: 'POST',
      })
      if (response.ok) {
        setProcessing(false)
        setPaused(false)
        addLog('⏹️ Processing stopped')
      }
    } catch (error) {
      addLog(`❌ Error stopping: ${error.message}`)
    }
  }

  const handleDownloadAudio = (filename) => {
    window.open(`http://127.0.0.1:8000/api/download-audio/${filename}`, '_blank')
  }

  return (
    <div className="allinone-view">
      <div className="allinone-header">
        <button className="btn-back" onClick={onBack}>
          ← Back to Home
        </button>
        <h1>🚀 All in One Set Up</h1>
        <p className="subtitle">Automated workflow: Scrape → TTS → Audio files</p>
      </div>

      <div className="allinone-container">
        {/* Configuration Section */}
        <div className="config-section">
          <h3>⚙️ Configuration</h3>
          
          {/* URLs */}
          <div className="config-group">
            <h4>🌐 URLs</h4>
            <div className="config-row">
              <label>Base URL:</label>
              <input
                type="text"
                list="base-url-history"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://novelbin.com/"
                className="url-input"
              />
              <datalist id="base-url-history">
                {baseUrlHistory.map((url, idx) => (
                  <option key={idx} value={url} />
                ))}
              </datalist>
            </div>
            <div className="config-row">
              <label>Start URL:</label>
              <input
                type="text"
                list="start-url-history"
                value={startUrl}
                onChange={(e) => setStartUrl(e.target.value)}
                placeholder="https://novelbin.com/b/novel-name"
                className="url-input"
              />
              <datalist id="start-url-history">
                {startUrlHistory.map((url, idx) => (
                  <option key={idx} value={url} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Chapter Range */}
          <div className="config-group">
            <h4>📚 Chapters</h4>
            <div className="config-row">
              <label>Start:</label>
              <input
                type="number"
                min="1"
                value={startChapter}
                onChange={(e) => setStartChapter(e.target.value)}
                className="number-input"
              />
              <label>End:</label>
              <input
                type="number"
                min="1"
                value={endChapter}
                onChange={(e) => setEndChapter(e.target.value)}
                className="number-input"
              />
              <label>Or Number:</label>
              <input
                type="number"
                min="1"
                value={numChapters}
                onChange={(e) => setNumChapters(e.target.value)}
                placeholder="Leave empty if using End"
                className="number-input"
              />
            </div>
            <div className="config-row">
              <label>Batch Size (chapters per audio):</label>
              <input
                type="number"
                min="1"
                value={batchSize}
                onChange={(e) => setBatchSize(e.target.value)}
                className="number-input"
              />
            </div>
          </div>

          {/* TTS Settings */}
          <div className="config-group">
            <h4>🔊 TTS Settings</h4>
            <div className="config-row">
              <label>Voice:</label>
              {loadingVoices ? (
                <span>Loading voices...</span>
              ) : (
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="voice-select"
                >
                  {voices.map((voice) => (
                    <option key={voice.ShortName} value={voice.ShortName}>
                      {voice.ShortName} - {voice.Gender} ({voice.Locale})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="config-row">
              <label>Rate:</label>
              <input
                type="number"
                min="-50"
                max="100"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="number-input"
              />
              <label>Pitch:</label>
              <input
                type="number"
                min="-50"
                max="50"
                value={pitch}
                onChange={(e) => setPitch(Number(e.target.value))}
                className="number-input"
              />
              <label>Volume:</label>
              <input
                type="number"
                min="-50"
                max="50"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="number-input"
              />
            </div>
          </div>
        </div>

        {/* Progress Section */}
        <div className="progress-section">
          <h3>📊 Progress</h3>
          {processing && (
            <div className="progress-bar-container">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <div className="progress-text">
                {progress.current} / {progress.total} chapters ({Math.round((progress.current / progress.total) * 100)}%)
              </div>
              {progress.currentChapter && (
                <div className="current-chapter">
                  Current: Chapter {progress.currentChapter.chapter_number} - {progress.currentChapter.title || 'Untitled'}
                </div>
              )}
              <div className="batch-info">
                Batch {progress.completedBatches} / {progress.totalBatches}
              </div>
            </div>
          )}
        </div>

        {/* Logs */}
        <div className="logs-section">
          <h3>📋 Logs</h3>
          <div className="log-area">
            {logs.map((log, idx) => (
              <div key={idx} className="log-line">{log}</div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="controls-section">
          {!processing ? (
            <button
              className="btn-start"
              onClick={handleStartProcessing}
              disabled={!baseUrl.trim() && !startUrl.trim()}
            >
              🚀 Start Processing
            </button>
          ) : (
            <div className="control-buttons">
              {paused ? (
                <button className="btn-resume" onClick={handleResume}>
                  ▶️ Resume
                </button>
              ) : (
                <button className="btn-pause" onClick={handlePause}>
                  ⏸️ Pause
                </button>
              )}
              <button className="btn-stop" onClick={handleStop}>
                ⏹️ Stop
              </button>
            </div>
          )}
          <button className="btn-clear-log" onClick={clearLogs}>
            🗑️ Clear Log
          </button>
        </div>

        {/* Generated Files */}
        {audioFiles.length > 0 && (
          <div className="files-section">
            <h3>📁 Generated Audio Files</h3>
            <div className="files-list">
              {audioFiles.map((file, idx) => (
                <div key={idx} className="file-item">
                  <span className="file-name">{file.filename}</span>
                  <span className="file-size">{file.size || 'N/A'}</span>
                  <button
                    className="btn-download"
                    onClick={() => handleDownloadAudio(file.filename)}
                  >
                    💾 Download
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AllInOneView

