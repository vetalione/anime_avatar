import React, { useState, useEffect } from 'react'
import './App.css'
import { translations } from './translations'
import { Translations, Language } from './types'
import { GoogleGenerativeAI } from '@google/generative-ai'

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [animeTitle, setAnimeTitle] = useState('')
  const [animeCharacter, setAnimeCharacter] = useState('')
  const [generatedAvatar, setGeneratedAvatar] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
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

    setIsGenerating(true)
    
    try {
      // Initialize Google AI
      const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_AI_API_KEY)
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
      
      // Convert image to base64
      const imageBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(selectedFile)
      })
      
      // Prepare prompt based on user input
      const basePrompt = `Transform this photo into ${animeTitle} anime style`
      const characterPrompt = animeCharacter 
        ? `, making the person look like ${animeCharacter}` 
        : ', creating a unique character in this anime world'
      
      const fullPrompt = basePrompt + characterPrompt + `. Create a beautiful anime avatar that captures the person's essence while staying true to the ${animeTitle} art style. Make it vibrant, detailed, and high-quality.`
      
      console.log('Generating with prompt:', fullPrompt)
      
      // Generate content with image and text
      const imagePart = {
        inlineData: {
          data: imageBase64.split(',')[1], // Remove data:image/...;base64, prefix
          mimeType: selectedFile.type,
        },
      }
      
      const result = await model.generateContent([fullPrompt, imagePart])
      const response = await result.response
      const generatedText = response.text()
      
      console.log('AI Response:', generatedText)
      
      // Since Gemini is text-only, we'll show the description for now
      // In a real implementation, you'd use an image generation API like DALL-E
      alert(`${t.alerts.generationComplete}\n\n${generatedText}`)
      
      // For demo purposes, use a placeholder image
      setGeneratedAvatar('/placeholder-avatar.png')
      
    } catch (error) {
      console.error('Generation error:', error)
      alert(t.alerts.generationError || 'Ошибка при генерации аватара. Попробуйте снова.')
    } finally {
      setIsGenerating(false)
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
            {language === 'ru' ? '🇺🇸 EN' : '🇷� RU'}
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
          {isGenerating ? t.generate.generating : t.generate.button}
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