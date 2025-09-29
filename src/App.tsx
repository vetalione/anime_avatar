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
      // Convert image to base64
      const imageBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(selectedFile)
      })
      
      setGenerationStatus(t.alerts.generating)
      
      // Проверяем, работаем ли мы в продакшене (Vercel) или локально
      const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
      
      if (isProduction) {
        // Продакшен: используем Vercel API функцию
        console.log('🌐 Using Vercel API function...')
        const response = await fetch('/api/generate-avatar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageBase64,
            animeTitle,
            animeCharacter,
            language
          })
        })
        
        const data = await response.json()
        
        if (data.success && data.imageUrl) {
          setGeneratedAvatar(data.imageUrl)
          console.log('✅ Avatar generated successfully via API!')
          if (data.analysis) {
            console.log('👤 Character analysis:', data.analysis)
          }
        } else {
          throw new Error(data.error || 'Failed to generate avatar')
        }
      } else {
        // Локальная разработка: прямые вызовы API
        console.log('💻 Using direct API calls for local development...')
        
        // Инициализируем AI сервисы
        const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_AI_API_KEY)
        const openai = new OpenAI({
          apiKey: import.meta.env.VITE_OPENAI_API_KEY,
          dangerouslyAllowBrowser: true
        })

        // Шаг 1: Анализируем фото с Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
        
        const analysisPrompt = `Analyze this photo and describe the person's key facial features, expression, and overall appearance in detail. Focus on features that would be important for creating an anime avatar. Be specific about hair color, eye shape, face structure, and expression.`
        
        const imagePart = {
          inlineData: {
            data: imageBase64.split(',')[1],
            mimeType: selectedFile.type,
          },
        }
        
        console.log('🔍 Analyzing image with Gemini...')
        const analysisResult = await model.generateContent([analysisPrompt, imagePart])
        const analysisResponse = await analysisResult.response
        const personDescription = analysisResponse.text()
        
        console.log('👤 Person analysis:', personDescription)

        // Шаг 2: Создаем промпт для DALL-E
        const basePrompt = `Create a high-quality anime avatar in ${animeTitle} art style`
        const characterPrompt = animeCharacter ? ` resembling ${animeCharacter}` : ''
        const featuresPrompt = ` based on these characteristics: ${personDescription}`
        const stylePrompt = `. Style: vibrant colors, detailed anime/manga illustration, professional digital art, ${animeTitle} aesthetic, beautiful lighting, masterpiece quality, sharp focus`
        
        const dallePrompt = (basePrompt + characterPrompt + featuresPrompt + stylePrompt).substring(0, 1000)
        
        console.log('🎨 DALL-E prompt:', dallePrompt)
        
        // Шаг 3: Генерируем изображение с DALL-E 3
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
          console.log('✅ Avatar generated successfully via direct API!')
        } else {
          throw new Error('No image URL received from DALL-E')
        }
      }
      
    } catch (error) {
      console.error('❌ Generation error:', error)
      let errorMessage = t.alerts.generationError
      
      if (error instanceof Error) {
        if (error.message.includes('billing') || error.message.includes('BILLING_ERROR') || error.message.includes('insufficient_quota')) {
          errorMessage = language === 'ru' 
            ? 'Ошибка биллинга OpenAI. Проверьте баланс аккаунта.' 
            : 'OpenAI billing error. Please check your account balance.'
        } else if (error.message.includes('rate_limit') || error.message.includes('RATE_LIMIT_ERROR')) {
          errorMessage = language === 'ru'
            ? 'Превышен лимит запросов. Попробуйте позже.'
            : 'Rate limit exceeded. Please try again later.'
        } else if (error.message.includes('content_policy') || error.message.includes('CONTENT_POLICY_ERROR')) {
          errorMessage = language === 'ru'
            ? 'Нарушение политики контента. Попробуйте другое изображение.'
            : 'Content policy violation. Please try a different image.'
        } else if (error.message.includes('invalid_api_key')) {
          errorMessage = language === 'ru'
            ? 'Неверный API ключ. Проверьте настройки.'
            : 'Invalid API key. Please check your settings.'
        } else if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
          errorMessage = language === 'ru'
            ? 'Ошибка сети. Проверьте подключение к интернету.'
            : 'Network error. Please check your internet connection.'
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