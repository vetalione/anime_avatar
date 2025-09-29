import React, { useState, useEffect } from 'react'
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
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('language')
    return (saved === 'en' || saved === 'ru') ? saved : 'ru'
  })
  
  const t: Translations = translations[language]

  useEffect(() => {
    document.title = language === 'ru' ? 'Генератор Аниме Аватаров' : 'Anime Avatar Generator'
  }, [language])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const toggleLanguage = () => {
    const newLanguage = language === 'ru' ? 'en' : 'ru'
    setLanguage(newLanguage)
    localStorage.setItem('language', newLanguage)
  }

  const handleGenerate = async () => {
    if (!selectedFile || !animeTitle) {
      alert(t.alerts.missingFields)
      return
    }

    console.log('🚀 Starting avatar generation via Google Gemini endpoint...')

    setIsGenerating(true)
    setGenerationStatus(t.alerts.analyzing)
    
    try {
      // Convert image to base64
      const imageBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(selectedFile)
      })
      
      setGenerationStatus(t.alerts.generating)
      console.log('🌐 Calling /api/generate_google')

      const response = await fetch('/api/generate_google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          animeTitle,
          animeCharacter,
        })
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (data.success && data.image?.dataUrl) {
        setGeneratedAvatar(data.image.dataUrl)
        console.log('✅ Avatar generated via Google Gemini!')
      } else if (data.images && Array.isArray(data.images) && data.images[0]?.data) {
        // Fallback to previous shape if returned as array
        const first = data.images[0]
        const dataUrl = `data:${first.mime_type || 'image/png'};base64,${first.data}`
        setGeneratedAvatar(dataUrl)
        console.log('✅ Avatar generated via Google Gemini (array payload)!')
      } else {
        throw new Error(data.error || 'Failed to generate avatar')
      }
      
    } catch (error) {
      console.error('❌ Generation error:', error)
      let errorMessage = t.alerts.generationError
      
      if (error instanceof Error) {
        if (error.message.includes('billing') || error.message.includes('BILLING_ERROR')) {
          errorMessage = language === 'ru' 
            ? 'Ошибка биллинга. Проверьте баланс аккаунта.' 
            : 'Billing error. Please check your account balance.'
        } else if (error.message.includes('rate_limit') || error.message.includes('RATE_LIMIT_ERROR')) {
          errorMessage = language === 'ru'
            ? 'Превышен лимит запросов. Попробуйте позже.'
            : 'Rate limit exceeded. Please try again later.'
        } else if (error.message.includes('content_policy') || error.message.includes('CONTENT_POLICY_ERROR')) {
          errorMessage = language === 'ru'
            ? 'Нарушение политики контента. Попробуйте другое изображение.'
            : 'Content policy violation. Please try a different image.'
        }
      }
      
      alert(errorMessage)
    } finally {
      setIsGenerating(false)
      setGenerationStatus('')
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