import { useState } from 'react'
import './App.css'
import TTSView from './components/TTSView'
import ScraperView from './components/ScraperView'
import AllInOneView from './components/AllInOneView'

function App() {
  const [selectedOption, setSelectedOption] = useState(null)

  if (selectedOption === 'TTS') {
    return <TTSView onBack={() => setSelectedOption(null)} />
  }

  if (selectedOption === 'Scraper') {
    return <ScraperView onBack={() => setSelectedOption(null)} />
  }

  if (selectedOption === 'All in One Set Up') {
    return <AllInOneView onBack={() => setSelectedOption(null)} />
  }

  return (
    <div className="app">
      {/* Hero Section */}
      <div className="hero">
        <h1 className="hero-title">🎧 Audiobook Creator Utilities</h1>
        <p className="hero-subtitle">
          Create professional audiobooks from webnovels with scraping and text-to-speech
        </p>
      </div>

      {/* Options Grid */}
      <div className="options-container">
        <div className="option-card" onClick={() => setSelectedOption('Scraper')}>
          <div className="option-icon">📥</div>
          <h2 className="option-title">Scraper</h2>
          <p className="option-description">
            Extract chapters from webnovels automatically.
            <br />
            Get clean and organized text.
          </p>
          <div className="option-features">
            <span className="feature-tag">✓ Auto detection</span>
            <span className="feature-tag">✓ Multiple chapters</span>
            <span className="feature-tag">✓ Clean text</span>
          </div>
          <button className="option-btn">Use Scraper</button>
        </div>

        <div className="option-card" onClick={() => setSelectedOption('TTS')}>
          <div className="option-icon">🔊</div>
          <h2 className="option-title">TTS</h2>
          <p className="option-description">
            Convert text to audio using text-to-speech.
            <br />
            Perfect if you already have the text ready.
          </p>
          <div className="option-features">
            <span className="feature-tag">✓ Multiple voices</span>
            <span className="feature-tag">✓ Speed control</span>
            <span className="feature-tag">✓ Export MP3</span>
          </div>
          <button className="option-btn">Use TTS</button>
        </div>

        <div className="option-card featured" onClick={() => setSelectedOption('All in One Set Up')}>
          <div className="option-badge">⭐ Recommended</div>
          <div className="option-icon">🚀</div>
          <h2 className="option-title">All in One Set Up</h2>
          <p className="option-description">
            Complete workflow: from URL to audiobook.
            <br />
            Scraping + TTS integrated in one process.
          </p>
          <div className="option-features">
            <span className="feature-tag">✓ Fully integrated</span>
            <span className="feature-tag">✓ Batch processing</span>
            <span className="feature-tag">✓ ~3 hour audios</span>
          </div>
          <button className="option-btn primary">Start Project</button>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer">
        <p>Audiobook Creator Utilities v1.0.0</p>
      </footer>
    </div>
  )
}

export default App
