import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { enTranslations } from './en';
import { amTranslations } from './am';

const savedLang = typeof window !== 'undefined' ? localStorage.getItem('dcfms_locale') || 'en' : 'en';

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enTranslations },
    am: { translation: amTranslations },
  },
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = savedLang;
}

i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('dcfms_locale', lng);
    document.documentElement.lang = lng;
  }
});

export default i18n;
