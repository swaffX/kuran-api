export const ONBOARDING_COMPLETED_KEY = 'onboarding_completed';
export const NOTIFICATIONS_ENABLED_KEY = 'notifications_enabled';
export const LOCATION_PERMISSION_KEY = 'location_permission';
export const SELECTED_LANGUAGE_KEY = 'selected_language';
export const SELECTED_COUNTRY_KEY = 'selected_country';
export const SELECTED_CITY_KEY = 'selected_city';
export const PRAYER_NOTIFICATIONS_SETTINGS = 'prayer_notifications_settings';

// Varsayılan bildirim ayarları
export const DEFAULT_NOTIFICATION_SETTINGS = {
  fajr: true,
  dhuhr: true,
  asr: true,
  maghrib: true,
  isha: true,
  beforePrayer: 15, // Namaz vaktinden kaç dakika önce bildirim gönderilecek
};

// Desteklenen diller
export const SUPPORTED_LANGUAGES = [
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
]; 