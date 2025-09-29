export type Language = 'ru' | 'en';

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

export interface Translations {
  header: {
    title: string;
    subtitle: string;
  };
  upload: {
    title: string;
  };
  animeTitle: {
    title: string;
    placeholder: string;
    description: string;
  };
  character: {
    title: string;
    optional: string;
    placeholder: string;
    description: string;
  };
  generate: {
    button: string;
    generating: string;
  };
  result: {
    title: string;
  };
  alerts: {
    missingFields: string;
    generationComplete: string;
    generationError: string;
  };
  alt: {
    selectedPhoto: string;
    generatedAvatar: string;
  };
}