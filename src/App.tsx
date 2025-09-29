import React, { useState, useEffect } from 'react'
import './App.css'
import { translations } from './translations'
import { Translations, Language } from './types'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'

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

    setIsGenerating(true)
    setGenerationStatus(t.alerts.analyzing)
    
    try {
      // Initialize Google AI for image analysis
      const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_AI_API_KEY)
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
      
      // Convert image to base64
      const imageBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(selectedFile)
      })
      
      // First, analyze the image with Gemini to get person's features
      const analysisPrompt = `Analyze this photo and describe the person's key facial features, expression, and overall appearance in detail. Focus on features that would be important for creating an anime avatar.`
      
      const imagePart = {
        inlineData: {
          data: imageBase64.split(',')[1],
          mimeType: selectedFile.type,
        },
      }
      
      console.log('Analyzing image with Gemini...')
      const analysisResult = await model.generateContent([analysisPrompt, imagePart])
      const analysisResponse = await analysisResult.response
      const personDescription = analysisResponse.text()
      
      console.log('Person analysis:', personDescription)
      
      // Now create DALL-E prompt based on analysis and user input
      const basePrompt = `Create a high-quality anime avatar in ${animeTitle} art style`
      const characterPrompt = animeCharacter 
        ? ` resembling ${animeCharacter}` 
        : ''
      const featuresPrompt = ` with the following characteristics: ${personDescription}`
      const stylePrompt = `. Art style: vibrant colors, detailed anime/manga illustration, professional digital art, ${animeTitle} aesthetic, beautiful lighting, high resolution, masterpiece quality`
      
      const dallePrompt = basePrompt + characterPrompt + featuresPrompt + stylePrompt
      
      console.log('DALL-E prompt:', dallePrompt)
      
      setGenerationStatus(t.alerts.generating)
      
      // Initialize OpenAI and generate image
      const openai = new OpenAI({
        apiKey: import.meta.env.VITE_OPENAI_API_KEY,
        dangerouslyAllowBrowser: true // Note: In production, use a backend proxy
      })
      
      console.log('Generating image with DALL-E 3...')
      const imageResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: dallePrompt,
        n: 1,
        size: "1024x1024",
        quality: "hd",
        style: "vivid"
      })
      
      const generatedImageUrl = imageResponse.data?.[0]?.url
      
      if (generatedImageUrl) {
        setGeneratedAvatar(generatedImageUrl)
        console.log('Image generated successfully!')
      } else {
        throw new Error('No image URL received from DALL-E')
      }
      
    } catch (error) {
      console.error('Generation error:', error)
      let errorMessage = t.alerts.generationError
      
      if (error instanceof Error) {
        if (error.message.includes('billing')) {
          errorMessage = language === 'ru' 
            ? 'Ошибка биллинга OpenAI. Проверьте баланс аккаунта.' 
            : 'OpenAI billing error. Please check your account balance.'
        } else if (error.message.includes('rate_limit')) {
          errorMessage = language === 'ru'
            ? 'Превышен лимит запросов. Попробуйте позже.'
            : 'Rate limit exceeded. Please try again later.'
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