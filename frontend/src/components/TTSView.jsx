import { useState, useEffect } from 'react'
import './TTSView.css'

function TTSView({ onBack }) {
  const [text, setText] = useState('')
  const [allVoices, setAllVoices] = useState([]) // All loaded voices
  const [voices, setVoices] = useState([]) // Filtered voices
  const [selectedVoice, setSelectedVoice] = useState('en-US-AndrewNeural')
  const [rate, setRate] = useState(0)
  const [pitch, setPitch] = useState(0)
  const [volume, setVolume] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingVoices, setLoadingVoices] = useState(true)
  const [status, setStatus] = useState('')
  const [showVoiceModifications, setShowVoiceModifications] = useState(false)
  
  // Filters
  const [filterGender, setFilterGender] = useState('all') // 'all', 'Male', 'Female'
  const [filterLocale, setFilterLocale] = useState('all') // 'all' or country code like 'en-US', 'en-GB', etc.

  useEffect(() => {
    loadVoices()
  }, [])

  // Function to apply filters
  const applyFilters = (voicesToFilter, gender, locale, currentSelectedVoice) => {
    let filtered = [...voicesToFilter]
    
    // Filter by gender
    if (gender !== 'all') {
      filtered = filtered.filter(v => v.Gender === gender)
    }
    
    // Filter by country/locale
    if (locale !== 'all') {
      filtered = filtered.filter(v => v.Locale === locale)
    }
    
    setVoices(filtered)
    
    // If selected voice is not in filtered results, select first available
    if (filtered.length > 0) {
      const isSelectedAvailable = filtered.some(v => v.ShortName === currentSelectedVoice)
      if (!isSelectedAvailable) {
        setSelectedVoice(filtered[0].ShortName)
      }
    }
  }

  // Effect to apply filters when they change
  useEffect(() => {
    if (allVoices.length > 0) {
      applyFilters(allVoices, filterGender, filterLocale, selectedVoice)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterGender, filterLocale, allVoices])

  // Get unique locales from voices
  const getUniqueLocales = () => {
    const locales = [...new Set(allVoices.map(v => v.Locale))]
    return locales.sort()
  }

  const loadVoices = async () => {
    try {
      setStatus('Loading voices...')
      const response = await fetch('http://127.0.0.1:8000/api/voices?locale=en')
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }
      const data = await response.json()
      const englishVoices = data.voices || []
      
      if (englishVoices.length === 0) {
        setStatus('⚠️ No English voices found. Loading all voices...')
        // If no English voices, load all
        const allResponse = await fetch('http://127.0.0.1:8000/api/voices')
        const allData = await allResponse.json()
        setVoices(allData.voices || [])
        if (allData.voices && allData.voices.length > 0) {
          setSelectedVoice(allData.voices[0].ShortName)
        }
      } else {
        setAllVoices(englishVoices)
        applyFilters(englishVoices, filterGender, filterLocale, selectedVoice)
        if (englishVoices.length > 0) {
          setSelectedVoice(englishVoices[0].ShortName)
        }
        setStatus(`✅ ${englishVoices.length} English voices loaded`)
      }
      setLoadingVoices(false)
    } catch (error) {
      console.error('Error loading voices:', error)
      setStatus(`❌ Error: ${error.message}. Make sure the backend is running at http://127.0.0.1:8000`)
      setLoadingVoices(false)
    }
  }

  const handleGenerate = async () => {
    if (!text.trim()) {
      setStatus('Please enter some text')
      return
    }

    setLoading(true)
    setStatus('Generating audio...')

    try {
      const response = await fetch('http://127.0.0.1:8000/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice: selectedVoice,
          rate,
          pitch,
          volume,
        }),
      })

      if (!response.ok) {
        throw new Error('Error generating audio')
      }

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audio_${Date.now()}.mp3`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      setStatus('✅ Audio generated and downloaded successfully!')
    } catch (error) {
      console.error('Error:', error)
      setStatus('❌ Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePreview = async () => {
    if (!text.trim()) {
      setStatus('Please enter some text to preview')
      return
    }

    const previewText = text.substring(0, 500)
    setLoading(true)
    setStatus('Generating preview...')

    try {
      const response = await fetch('http://127.0.0.1:8000/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: previewText,
          voice: selectedVoice,
          rate,
          pitch,
          volume,
        }),
      })

      if (!response.ok) {
        throw new Error('Error generating preview')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.play()
      
      setStatus('🔊 Playing preview...')
    } catch (error) {
      setStatus('❌ Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClearAudio = () => {
    setText('')
    setStatus('')
  }

  return (
    <div className="tts-view">
      <div className="tts-header">
        <button className="btn-back" onClick={onBack}>
          ← Back to Home
        </button>
        <h1>🔊 Text-to-Speech</h1>
        <p className="subtitle">Convert text to high-quality audio</p>
      </div>

      {status && (
        <div className={`status-message ${status.includes('❌') ? 'error' : status.includes('✅') ? 'success' : 'info'}`}>
          {status}
        </div>
      )}

      <div className="tts-container">
        {/* Voice Configuration Section - All voice-related settings in one box */}
        <div className="voice-config-section">
          <h3>🎤 Voice Configuration</h3>
          
          <div className="voice-config-grid">
            {/* 1. Voice Filters */}
            {!loadingVoices && allVoices.length > 0 && (
              <div className="voice-filters-subsection">
                <label>Gender:</label>
                <select
                  value={filterGender}
                  onChange={(e) => setFilterGender(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
                
                <label>Country/Region:</label>
                <select
                  value={filterLocale}
                  onChange={(e) => setFilterLocale(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All</option>
                  {getUniqueLocales().map(locale => (
                    <option key={locale} value={locale}>{locale}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 2. Voice Selection */}
            <div className="voice-selection-subsection">
              <label>Voice:</label>
              {loadingVoices ? (
                <div className="loading">Loading voices...</div>
              ) : voices.length === 0 ? (
                <div>
                  <div className="loading">No voices available</div>
                  <button onClick={() => { setFilterGender('all'); setFilterLocale('all'); }} className="btn-retry">
                    🔄 Clear filters
                  </button>
                </div>
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

            {/* 3. Voice Modifications */}
            <div className="voice-modifications-subsection">
              <button
                type="button"
                className="voice-modifications-toggle"
                onClick={() => setShowVoiceModifications(!showVoiceModifications)}
              >
                {showVoiceModifications ? '▼' : '▶'} Modifications
              </button>
              {showVoiceModifications && (
                <div className="voice-modifications-panel">
                  <div className="modification-item">
                    <label>Rate:</label>
                    <select
                      value={rate}
                      onChange={(e) => setRate(Number(e.target.value))}
                      className="voice-select"
                    >
                      {Array.from({ length: 151 }, (_, i) => i - 50).map(value => (
                        <option key={value} value={value}>
                          {value > 0 ? '+' : ''}{value}%
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="modification-item">
                    <label>Pitch:</label>
                    <select
                      value={pitch}
                      onChange={(e) => setPitch(Number(e.target.value))}
                      className="voice-select"
                    >
                      {Array.from({ length: 101 }, (_, i) => i - 50).map(value => (
                        <option key={value} value={value}>
                          {value > 0 ? '+' : ''}{value}%
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="modification-item">
                    <label>Volume:</label>
                    <select
                      value={volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                      className="voice-select"
                    >
                      {Array.from({ length: 101 }, (_, i) => i - 50).map(value => (
                        <option key={value} value={value}>
                          {value > 0 ? '+' : ''}{value}%
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="tts-text-area">
          <label>Text to convert:</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste the text you want to convert to audio..."
            className="text-input"
            rows={12}
          />
          <div className="text-stats">
            {text.length} characters
            {text.length > 0 && (
              <span> • ~{Math.round(text.length / 150)} seconds of audio</span>
            )}
          </div>
        </div>

        <div className="tts-actions">
          <button
            className="btn-clear"
            onClick={handleClearAudio}
            disabled={loading || !text.trim()}
          >
            🗑️ Clear Audio
          </button>
          <button
            className="btn-preview"
            onClick={handlePreview}
            disabled={loading || !text.trim()}
          >
            🎵 Preview
          </button>
          <button
            className="btn-generate"
            onClick={handleGenerate}
            disabled={loading || !text.trim()}
          >
            {loading ? '⏳ Generating...' : '▶ Generate Audio'}
          </button>
        </div>

        {status && (
          <div className={`status-message ${status.includes('✅') ? 'success' : status.includes('❌') ? 'error' : 'info'}`}>
            {status}
          </div>
        )}
      </div>
    </div>
  )
}

export default TTSView

