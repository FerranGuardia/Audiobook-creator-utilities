import { useState, useEffect } from 'react'
import './ScraperView.css'

function ScraperView({ onBack }) {
  // URL states with history
  const [baseUrl, setBaseUrl] = useState('')
  const [startUrl, setStartUrl] = useState('')
  const [baseUrlHistory, setBaseUrlHistory] = useState([])
  const [startUrlHistory, setStartUrlHistory] = useState([])
  
  // Chapter range options
  const [startChapter, setStartChapter] = useState('1')
  const [endChapter, setEndChapter] = useState('')
  const [numChapters, setNumChapters] = useState('')
  const [batchSize, setBatchSize] = useState('10')
  const [outputFolder, setOutputFolder] = useState('scraped_chapters')
  
  // State
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('Ready to scrape. Enter URL and click "Start Scraping".')
  const [chapters, setChapters] = useState([])
  const [selectedChapter, setSelectedChapter] = useState(null)
  const [logs, setLogs] = useState(['Ready to scrape. Enter URL and click "Start Scraping".'])

  // Load URL history from localStorage
  useEffect(() => {
    const savedBaseUrls = localStorage.getItem('scraper_base_urls')
    const savedStartUrls = localStorage.getItem('scraper_start_urls')
    
    if (savedBaseUrls) {
      const urls = JSON.parse(savedBaseUrls)
      setBaseUrlHistory(urls)
      if (urls.length > 0) {
        setBaseUrl(urls[0])
      }
    }
    
    if (savedStartUrls) {
      const urls = JSON.parse(savedStartUrls)
      setStartUrlHistory(urls)
      if (urls.length > 0) {
        setStartUrl(urls[0])
      }
    }
  }, [])

  // Save URLs to history
  const saveUrlToHistory = (base, start) => {
    if (base && !baseUrlHistory.includes(base)) {
      const newBaseHistory = [base, ...baseUrlHistory].slice(0, 20)
      setBaseUrlHistory(newBaseHistory)
      localStorage.setItem('scraper_base_urls', JSON.stringify(newBaseHistory))
    }
    
    if (start && !startUrlHistory.includes(start)) {
      const newStartHistory = [start, ...startUrlHistory].slice(0, 20)
      setStartUrlHistory(newStartHistory)
      localStorage.setItem('scraper_start_urls', JSON.stringify(newStartHistory))
    }
  }

  const addLog = (message) => {
    setLogs(prev => [...prev, message])
    setStatus(message)
  }

  const clearLogs = () => {
    setLogs(['Log cleared.'])
    setStatus('Log cleared.')
  }

  const clearUrlHistory = () => {
    setBaseUrlHistory([])
    setStartUrlHistory([])
    localStorage.removeItem('scraper_base_urls')
    localStorage.removeItem('scraper_start_urls')
    addLog('URL history cleared.')
  }

  const handleGetChapterUrls = async () => {
    if (!baseUrl.trim() && !startUrl.trim()) {
      addLog('❌ Please enter a base URL or start URL')
      return
    }

    setLoading(true)
    addLog('Finding chapter URLs...')

    try {
      const response = await fetch('http://127.0.0.1:8000/api/get-chapter-urls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: startUrl.trim() || baseUrl.trim(),
          base_url: baseUrl.trim() || undefined,
          start_url: startUrl.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Error getting chapter URLs')
      }

      const data = await response.json()
      addLog(`✅ Found ${data.count} chapter URLs`)
      if (data.novel_title) {
        addLog(`Novel: ${data.novel_title}`)
      }
      
      // Store chapter URLs for later use
      if (data.chapter_urls && data.chapter_urls.length > 0) {
        // You could store these in state if needed
        addLog(`Chapter URLs ready. You can now scrape them.`)
      }
    } catch (error) {
      console.error('Error:', error)
      addLog(`❌ Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleScrape = async () => {
    if (!baseUrl.trim() && !startUrl.trim()) {
      addLog('❌ Please enter a base URL or start URL')
      return
    }

    // Validate chapter range
    const start = parseInt(startChapter) || 1
    let end = null
    let num = null

    if (endChapter.trim()) {
      end = parseInt(endChapter)
      if (end < start) {
        addLog('❌ End chapter must be greater than or equal to start chapter')
        return
      }
    }

    if (numChapters.trim()) {
      num = parseInt(numChapters)
      if (num < 1) {
        addLog('❌ Number of chapters must be at least 1')
        return
      }
    }

    if (end !== null && num !== null) {
      addLog('❌ Please use either "End chapter" OR "Number of chapters", not both')
      return
    }

    // Save URLs to history
    saveUrlToHistory(baseUrl.trim(), startUrl.trim())

    setLoading(true)
    addLog('='.repeat(60))
    addLog('Starting scraping process...')
    addLog(`Base URL: ${baseUrl || 'Not specified'}`)
    addLog(`Start URL: ${startUrl || baseUrl}`)
    addLog(`Start from chapter: ${start}`)
    if (end) {
      addLog(`End chapter: ${end}`)
      addLog(`Chapters to scrape: ${end - start + 1} (chapters ${start} to ${end})`)
    } else if (num) {
      const calculatedEnd = start + num - 1
      addLog(`Chapters to scrape: ${num} (chapters ${start} to ${calculatedEnd})`)
    } else {
      addLog(`Chapters to scrape: All (starting from chapter ${start})`)
    }
    addLog(`Chapters per batch: ${batchSize}`)
    addLog('='.repeat(60))

    try {
      const response = await fetch('http://127.0.0.1:8000/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: startUrl.trim() || baseUrl.trim(),
          base_url: baseUrl.trim() || undefined,
          start_url: startUrl.trim() || undefined,
          start_chapter: start,
          end_chapter: end || undefined,
          num_chapters: num || undefined,
          batch_size: parseInt(batchSize) || 10,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Error scraping chapters')
      }

      const data = await response.json()
      setChapters(data)
      
      if (data.length > 0) {
        setSelectedChapter(0)
        addLog(`✅ ${data.length} chapter(s) scraped successfully!`)
        
        // Optionally save in batches
        const batch = parseInt(batchSize) || 10
        if (batch > 0 && data.length > 0) {
          addLog(`Saving ${data.length} chapters in batches of ${batch}...`)
          try {
            const saveResponse = await fetch('http://127.0.0.1:8000/api/save-chapters-batch', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                chapters: data,
                batch_size: batch,
                output_folder: outputFolder,
              }),
            })
            
            if (saveResponse.ok) {
              const saveData = await saveResponse.json()
              addLog(`✅ Saved ${saveData.total_chapters} chapters in ${saveData.total_files} file(s)`)
              saveData.saved_files.forEach(file => {
                addLog(`   - ${file.filename} (${file.chapters_count} chapters, ${file.characters} characters)`)
              })
            }
          } catch (saveError) {
            addLog(`⚠️ Could not save to files: ${saveError.message}`)
          }
        }
      } else {
        addLog('❌ No chapters were scraped')
      }
    } catch (error) {
      console.error('Error:', error)
      addLog(`❌ Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleScrapeAll = () => {
    setStartChapter('1')
    setEndChapter('')
    setNumChapters('')
    handleScrape()
  }

  const handleImportUrls = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.txt'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return

      try {
        const text = await file.text()
        const urls = text.split('\n').map(line => line.trim()).filter(line => line && line.startsWith('http'))
        
        if (urls.length === 0) {
          addLog('❌ No valid URLs found in file')
          return
        }

        addLog(`📋 Imported ${urls.length} URLs from file`)
        
        // Scrape using imported URLs
        setLoading(true)
        try {
          const response = await fetch('http://127.0.0.1:8000/api/scrape', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chapter_urls: urls,
              batch_size: parseInt(batchSize) || 10,
            }),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.detail || 'Error scraping chapters')
          }

          const data = await response.json()
          setChapters(data)
          
          if (data.length > 0) {
            setSelectedChapter(0)
            addLog(`✅ ${data.length} chapter(s) scraped successfully!`)
          }
        } catch (error) {
          addLog(`❌ Error: ${error.message}`)
        } finally {
          setLoading(false)
        }
      } catch (error) {
        addLog(`❌ Error reading file: ${error.message}`)
      }
    }
    input.click()
  }

  const handleClear = () => {
    setBaseUrl('')
    setStartUrl('')
    setStartChapter('1')
    setEndChapter('')
    setNumChapters('')
    setChapters([])
    setSelectedChapter(null)
    clearLogs()
  }

  const handleCopyText = () => {
    if (selectedChapter !== null && chapters[selectedChapter]) {
      const text = chapters[selectedChapter].content
      navigator.clipboard.writeText(text)
      addLog('✅ Text copied to clipboard!')
    }
  }

  const handleDownloadText = () => {
    if (selectedChapter !== null && chapters[selectedChapter]) {
      const chapter = chapters[selectedChapter]
      const blob = new Blob([chapter.content], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${chapter.title || `chapter-${chapter.chapter_number || selectedChapter + 1}`}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      addLog('✅ Text downloaded!')
    }
  }

  return (
    <div className="scraper-view">
      <div className="scraper-header">
        <button className="btn-back" onClick={onBack}>
          ← Back to Home
        </button>
        <h1>📥 Webnovel Scraper</h1>
        <p className="subtitle">Scrape chapters from webnovel websites</p>
      </div>

      <div className="scraper-container">
        {/* URL Configuration */}
        <div className="scraper-config-section">
          <h3>🌐 URL Configuration</h3>
          
          <div className="config-row">
            <label>Website URL (Base):</label>
            <div className="url-input-group">
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
              <button className="btn-clear-history" onClick={clearUrlHistory} title="Clear History">
                🗑️
              </button>
            </div>
          </div>

          <div className="config-row">
            <label>Starting URL (Table of Contents or first chapter):</label>
            <div className="url-input-group">
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

          {/* URL-related buttons */}
          <div className="url-actions">
            <button
              className="btn-get-urls"
              onClick={handleGetChapterUrls}
              disabled={loading || (!baseUrl.trim() && !startUrl.trim())}
            >
              🔍 Get Chapter URLs
            </button>
            <button
              className="btn-import"
              onClick={handleImportUrls}
              disabled={loading}
            >
              📋 Import Chapter URLs
            </button>
          </div>
        </div>

        {/* Chapter Range Settings */}
        <div className="scraper-config-section">
          <h3>📚 Chapter Range Settings</h3>
          
          <div className="config-row">
            <label>Start chapter:</label>
            <input
              type="number"
              min="1"
              value={startChapter}
              onChange={(e) => setStartChapter(e.target.value)}
              className="number-input"
            />
            <label>End chapter:</label>
            <input
              type="number"
              min="1"
              value={endChapter}
              onChange={(e) => setEndChapter(e.target.value)}
              placeholder="Leave empty for all"
              className="number-input"
            />
            <span className="help-text">(Leave empty to scrape all remaining)</span>
          </div>

          <div className="config-row">
            <label>Number of chapters:</label>
            <input
              type="number"
              min="1"
              value={numChapters}
              onChange={(e) => setNumChapters(e.target.value)}
              placeholder="Leave empty for all"
              className="number-input"
            />
            <label>Chapters per batch:</label>
            <input
              type="number"
              min="1"
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
              className="number-input"
            />
            <span className="help-text">(How many chapters to save per file)</span>
          </div>

          <div className="help-text">
            Note: Use 'Number of chapters' OR 'End chapter' - not both. Leave both empty to scrape all.
          </div>

          <div className="config-row">
            <label>Output folder:</label>
            <input
              type="text"
              value={outputFolder}
              onChange={(e) => setOutputFolder(e.target.value)}
              className="url-input"
              placeholder="scraped_chapters"
            />
          </div>
        </div>

        {/* Log/Status Area */}
        <div className="scraper-config-section">
          <h3>📋 Status Log</h3>
          <div className="log-area">
            {logs.map((log, idx) => (
              <div key={idx} className="log-line">{log}</div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="scraper-actions">
          <button
            className="btn-scrape"
            onClick={handleScrape}
            disabled={loading || (!baseUrl.trim() && !startUrl.trim())}
          >
            {loading ? '⏳ Scraping...' : '🚀 Start Scraping'}
          </button>
          <button
            className="btn-scrape-all"
            onClick={handleScrapeAll}
            disabled={loading || (!baseUrl.trim() && !startUrl.trim())}
          >
            📚 Scrape All Available Chapters
          </button>
          <button
            className="btn-clear"
            onClick={handleClear}
            disabled={loading}
          >
            🗑️ Clear
          </button>
          <button
            className="btn-clear-log"
            onClick={clearLogs}
          >
            🗑️ Clear Log
          </button>
        </div>

        {/* Chapters Display */}
        {chapters.length > 0 && (
          <div className="chapters-section">
            <div className="chapters-list">
              <h3>Chapters ({chapters.length})</h3>
              <div className="chapters-grid">
                {chapters.map((chapter, index) => (
                  <div
                    key={index}
                    className={`chapter-card ${selectedChapter === index ? 'selected' : ''}`}
                    onClick={() => setSelectedChapter(index)}
                  >
                    <div className="chapter-number">#{chapter.chapter_number || index + 1}</div>
                    <div className="chapter-title">{chapter.title || `Chapter ${index + 1}`}</div>
                    {chapter.error && (
                      <div className="chapter-error">⚠️ {chapter.error}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {selectedChapter !== null && chapters[selectedChapter] && (
              <div className="chapter-content">
                <div className="content-header">
                  <h3>{chapters[selectedChapter].title || `Chapter ${selectedChapter + 1}`}</h3>
                  <div className="content-actions">
                    <button className="btn-copy" onClick={handleCopyText}>
                      📋 Copy
                    </button>
                    <button className="btn-download" onClick={handleDownloadText}>
                      💾 Download
                    </button>
                  </div>
                </div>
                <div className="content-text">
                  {chapters[selectedChapter].content || (
                    <div className="no-content">
                      {chapters[selectedChapter].error || 'No content available'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ScraperView
