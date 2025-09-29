import React, { useState, useEffect, useRef } from 'react'
import './App.css'
import { translations } from './translations'
import { Translations, Language } from './types'

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [animeTitle, setAnimeTitle] = useState('')
  const [animeCharacter, setAnimeCharacter] = useState('')
  const [generatedAvatar, setGeneratedAvatar] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState('')
  const [provider, setProvider] = useState<'gemini' | 'openai'>('gemini')
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('language')
    return (saved === 'en' || saved === 'ru') ? saved : 'ru'
  })
  const inFlightRef = useRef(false)

  const t: Translations = translations[language]

  useEffect(() => {
    document.title = language === 'ru' ? 'Генератор Аниме Аватаров' : 'Anime Avatar Generator'
  }, [language])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) setSelectedFile(file)
  }

  const toggleLanguage = () => {
    const newLanguage = language === 'ru' ? 'en' : 'ru'
    setLanguage(newLanguage)
    localStorage.setItem('language', newLanguage)
  }

  const generateKey = () => {
    const arr = new Uint8Array(16)
    crypto.getRandomValues(arr)
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const resizeImageToDataUrl = (file: File, maxDim = 1024, quality = 0.85): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let { width, height } = img
          const scale = Math.min(1, maxDim / Math.max(width, height))
          width = Math.round(width * scale)
          height = Math.round(height * scale)
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) return reject(new Error('Canvas not supported'))
          ctx.drawImage(img, 0, 0, width, height)
          const dataUrl = canvas.toDataURL('image/jpeg', quality)
          resolve(dataUrl)
        }
        img.onerror = () => reject(new Error('Image load error'))
        img.src = reader.result as string
      }
      reader.onerror = () => reject(new Error('File read error'))
      reader.readAsDataURL(file)
    })
  }

  const handleGenerate = async () => {
    if (!selectedFile || !animeTitle) {
      alert(t.alerts.missingFields)
      return
    }
    if (inFlightRef.current) return
    inFlightRef.current = true

    setIsGenerating(true)
    setGenerationStatus(t.alerts.analyzing)

    try {
      // Resize image to reduce payload and API pressure
      const imageBase64 = await resizeImageToDataUrl(selectedFile, 1024, 0.85)
      setGenerationStatus(t.alerts.generating)

      const endpoint = provider === 'gemini' ? '/api/generate_google' : '/api/generate-avatar'
      const idempotencyKey = generateKey()
      const bodyPayload: Record<string, any> = {
        animeTitle,
        animeCharacter,
        imageBase64,
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client-Source': 'anime-avatar-app', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(bodyPayload)
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok) {
        // Gemini shape
        if (data?.success && data.image?.dataUrl) {
          setGeneratedAvatar(data.image.dataUrl)
          return
        }
        // OpenAI shape
        if (data?.success && data.imageUrl) {
          setGeneratedAvatar(data.imageUrl)
          return
        }
        // Legacy Gemini array shape
        if (data?.images && Array.isArray(data.images) && data.images[0]?.data) {
          const first = data.images[0]
          const dataUrl = `data:${first.mime_type || 'image/png'};base64,${first.data}`
          setGeneratedAvatar(dataUrl)
          return
        }
        throw new Error(data?.error || 'Failed to generate avatar')
      }

      // Non-OK
      if (response.status === 429 || data?.errorCode === 'RATE_LIMIT_ERROR') {
        const msg = language === 'ru'
          ? 'Превышен лимит запросов. Подождите немного и попробуйте снова.'
          : 'Rate limit exceeded. Please wait and try again.'
        throw new Error(msg)
      }
      throw new Error(data?.error || `API error: ${response.status} ${response.statusText}`)

    } catch (error) {
      console.error('❌ Generation error:', error)
      let errorMessage = t.alerts.generationError
      if (error instanceof Error && error.message) {
        errorMessage = error.message
      }
      alert(errorMessage)
    } finally {
      setIsGenerating(false)
      setGenerationStatus('')
      inFlightRef.current = false
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="language-switcher">
          <button 
            onClick={toggleLanguage}
            className="language-button"
            aria-label="Switch language"
          >
            {language === 'ru' ? '🇺🇸 EN' : '🇷🇺 RU'}
          </button>
        </div>
        <h1>{t.header.title}</h1>
        <p>{t.header.subtitle}</p>
      </header>

      <main className="main">
        <div className="upload-section">
          <h2>📷 {t.upload.title}</h2>
          <div className="file-input-wrapper">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="file-input"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="file-input-label">
              <span className="file-input-icon">📁</span>
              <span className="file-input-text">
                {selectedFile ? selectedFile.name : (language === 'ru' ? 'Выберите файл или перетащите сюда' : 'Choose file or drag here')}
              </span>
            </label>
          </div>
          {selectedFile && (
            <div className="preview">
              <img 
                src={URL.createObjectURL(selectedFile)} 
                alt={t.alt.selectedPhoto}
                className="preview-image"
              />
            </div>
          )}
        </div>

        <div className="anime-title-section">
          <h2>🎌 {t.animeTitle.title}</h2>
          <input
            type="text"
            placeholder={t.animeTitle.placeholder}
            value={animeTitle}
            onChange={(e) => setAnimeTitle(e.target.value)}
            className="anime-input"
          />
          <p className="section-description">{t.animeTitle.description}</p>
        </div>

        <div className="character-section">
          <h2>👤 {t.character.title} <span className="optional">{t.character.optional}</span></h2>
          <input
            type="text"
            placeholder={t.character.placeholder}
            value={animeCharacter}
            onChange={(e) => setAnimeCharacter(e.target.value)}
            className="character-input"
          />
          <p className="section-description">{t.character.description}</p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '12px 0' }}>
          <span style={{ opacity: 0.8 }}>{language === 'ru' ? 'Провайдер:' : 'Provider:'}</span>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="radio"
              name="provider"
              value="gemini"
              checked={provider === 'gemini'}
              onChange={() => setProvider('gemini')}
            />
            Gemini (Google)
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="radio"
              name="provider"
              value="openai"
              checked={provider === 'openai'}
              onChange={() => setProvider('openai')}
            />
            OpenAI (DALL·E)
          </label>
        </div>

        <button 
          onClick={handleGenerate}
          disabled={!selectedFile || !animeTitle || isGenerating}
          className="generate-button"
        >
          {isGenerating ? (generationStatus || t.generate.generating) : t.generate.button}
        </button>

        {generatedAvatar && (
          <div className="result-section">
            <h2>✨ {t.result.title}</h2>
            <div className="avatar-result">
              <img 
                src={generatedAvatar} 
                alt={t.alt.generatedAvatar}
                className="generated-avatar"
              />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App