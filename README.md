# 🎌 Генератор Аниме Аватаров

Превращайте свои селфи в потрясающие аватары в стиле аниме с помощью ИИ!

## ✨ Возможности

- **📸 Загрузка фото**: Простая загрузка селфи методом перетаскивания
- **🎭 Выбор персонажа**: Выберите любого аниме персонажа в качестве стилевого образца
- **🤖 ИИ генерация**: Работает на основе Gemini Nano Banana API
- **⚡ Предпросмотр в реальном времени**: Просмотрите загруженное фото перед генерацией
- **🎨 Современный интерфейс**: Красивый дизайн с градиентами и плавными анимациями
- **📱 Адаптивность**: Отлично работает на всех устройствах
- **🌐 Многоязычность**: Поддержка русского и английского языков

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd anime-avatar
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## 🎯 Логика генерации

Приложение предлагает два режима создания аватара:

1. **🌟 Уникальный персонаж**: Указываете только название аниме - становитесь оригинальным персонажем этого мира
2. **� Конкретный персонаж**: Указываете и аниме, и персонажа - становитесь этим персонажем

## �🛠️ Технологический стек

- **Frontend**: React 18 + TypeScript
- **Инструмент сборки**: Vite
- **Стилизация**: CSS3 с градиентами и анимациями
- **ИИ интеграция**: Gemini Nano Banana API (интеграция в процессе)

## 📖 How to Use

1. **Загрузите фото**: Нажмите на поле ввода файла, чтобы выбрать свое селфи
2. **Укажите аниме**: Введите название аниме для стилистики (например, "Наруто", "Атака Титанов", "Сейлор Мун")
3. **Выберите персонажа (опционально)**: Укажите конкретного персонажа или оставьте пустым для уникального образа
4. **Сгенерируйте аватар**: Нажмите кнопку "Создать Аватар"
5. **Скачайте результат**: Сохраните свой новый аниме аватар!

### 🌐 Переключение языка

В правом верхнем углу находится кнопка переключения между русским (🇷🇺 RU) и английским (🇺🇸 EN) языками. Выбранный язык сохраняется в браузере.

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Project Structure

```
src/
├── App.tsx          # Main application component
├── App.css          # Application styles
├── main.tsx         # React entry point
└── index.css        # Global styles
```

## 🎨 Customization

### Adding New Character Styles
To add preset character options:
1. Create character data in `src/data/characters.ts`
2. Update the character selection component
3. Add character-specific prompts for the AI

### Styling
The app uses CSS custom properties for theming. Main colors:
- Primary gradient: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- Accent colors: `#ff6b6b`, `#4ecdc4`, `#45b7d1`

## 🤖 AI Integration

Currently using placeholder functionality. To integrate Gemini Nano Banana:

1. Get API credentials from Banana
2. Add environment variables:
```env
VITE_BANANA_API_KEY=your_api_key
VITE_BANANA_MODEL_ID=your_model_id
```
3. Update the `handleGenerate` function in `App.tsx`

## 📝 TODO

- [ ] Integrate Gemini Nano Banana API
- [ ] Add character preset options
- [ ] Implement image enhancement filters
- [ ] Add social sharing functionality
- [ ] Create user gallery for saved avatars
- [ ] Add batch processing support

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Anime character art styles inspired by various anime series
- UI design inspired by modern glass-morphism trends
- Powered by Gemini Nano Banana AI technology

---

Made with ❤️ for anime lovers worldwide! 🌟