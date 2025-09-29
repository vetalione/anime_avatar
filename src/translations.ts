import { Translations } from './types';

export const translations: Record<string, Translations> = {
  ru: {
    header: {
      title: "🎌 Генератор Аниме Аватаров",
      subtitle: "Превратите свое селфи в любимого аниме персонажа!"
    },
    upload: {
      title: "Загрузите Ваше Фото"
    },
    animeTitle: {
      title: "Впишите название аниме *",
      placeholder: "например: Наруто, Атака Титанов, Сейлор Мун, Ван Пис...",
      description: "Укажите аниме, в стилистике которого хотите создать аватар"
    },
    character: {
      title: "Укажите аниме персонажа",
      optional: "(опционально)",
      placeholder: "например: Наруто Узумаки, Эрен Йегер, Усаги Цукино...",
      description: "Если не указать, вы станете уникальным персонажем этого мира. Если указать - станете этим персонажем"
    },
    generate: {
      button: "✨ Создать Аватар",
      generating: "🎨 Генерируем..."
    },
    result: {
      title: "Ваш Аниме Аватар"
    },
    alerts: {
      missingFields: "Пожалуйста, выберите фото и укажите название аниме!",
      generationComplete: "Аниме аватар успешно сгенерирован!",
      generationError: "Ошибка при генерации аватара. Попробуйте снова.",
      analyzing: "Анализируем фото...",
      generating: "Генерируем аниме аватар..."
    },
    alt: {
      selectedPhoto: "Выбранное фото",
      generatedAvatar: "Сгенерированный аниме аватар"
    }
  },
  en: {
    header: {
      title: "🎌 Anime Avatar Generator",
      subtitle: "Transform your selfie into your favorite anime character!"
    },
    upload: {
      title: "Upload Your Photo"
    },
    animeTitle: {
      title: "Enter Anime Title *",
      placeholder: "e.g., Naruto, Attack on Titan, Sailor Moon, One Piece...",
      description: "Specify the anime style you want for your avatar"
    },
    character: {
      title: "Specify Anime Character",
      optional: "(optional)",
      placeholder: "e.g., Naruto Uzumaki, Eren Yeager, Usagi Tsukino...",
      description: "If not specified, you'll become a unique character in this world. If specified - you'll become this character"
    },
    generate: {
      button: "✨ Generate Avatar",
      generating: "🎨 Generating..."
    },
    result: {
      title: "Your Anime Avatar"
    },
    alerts: {
      missingFields: "Please select a photo and specify anime title!",
      generationComplete: "Anime avatar generated successfully!",
      generationError: "Error generating avatar. Please try again.",
      analyzing: "Analyzing photo...",
      generating: "Generating anime avatar..."
    },
    alt: {
      selectedPhoto: "Selected photo",
      generatedAvatar: "Generated anime avatar"
    }
  }
};