import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { enTranslations } from './en';
import { amTranslations } from './am';

const storedLang = (() => {
  if (typeof window === 'undefined') return 'en';
  try {
    return window.localStorage.getItem('dcfms_locale') === 'am' ? 'am' : 'en';
  } catch (error) {
    console.warn('Unable to restore the saved language preference:', error);
    return 'en';
  }
})();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enTranslations },
    am: { translation: amTranslations },
  },
  lng: storedLang,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = storedLang;
}

i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    const language = lng === 'am' ? 'am' : 'en';
    try {
      window.localStorage.setItem('dcfms_locale', language);
    } catch (error) {
      console.warn('Unable to persist the language preference:', error);
    }
    document.documentElement.lang = language;
  }
});

export default i18n;
