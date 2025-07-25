import FavoritesModal from '@/components/FavoritesModal';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTheme } from '@/contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const FAVORITE_DAILY_PRAYERS_KEY = '@favorite_daily_prayers';
const FAVORITE_AYETS_KEY = 'favoriteAyets';
const FAVORITE_SURAHS_KEY = 'favoriteSurahs';
const SELECTED_CITY_KEY = 'selectedCity';
const LAST_READ_SURAH_KEY = 'lastReadSurah';
const DAILY_VERSE_KEY = 'dailyVerse';
const APP_VERSION = '1.0.0';

// Hicri ay isimleri
const hijriMonths = [
  "Muharrem", "Safer", "Rebiülevvel", "Rebiülahir", "Cemaziyelevvel", "Cemaziyelahir",
  "Recep", "Şaban", "Ramazan", "Şevval", "Zilkade", "Zilhicce"
];

// Özel İslami günler (yaklaşık tarihler - gerçekte daha karmaşık hesaplamalar gerekir)
const specialIslamicDays: {[key: string]: string} = {
  "1-1": "Hicri Yılbaşı",
  "1-10": "Aşure Günü",
  "3-12": "Mevlid Kandili",
  "7-1": "Üç Ayların Başlangıcı",
  "7-27": "Miraç Kandili",
  "8-14": "Berat Kandili", 
  "9-1": "Ramazan Başlangıcı",
  "9-14": "Kadir Gecesi",
  "9-30": "Ramazan Bayramı Arifesi",
  "10-1": "Ramazan Bayramı (1. Gün)",
  "10-2": "Ramazan Bayramı (2. Gün)",
  "10-3": "Ramazan Bayramı (3. Gün)",
  "12-9": "Kurban Bayramı Arifesi",
  "12-10": "Kurban Bayramı (1. Gün)",
  "12-11": "Kurban Bayramı (2. Gün)",
  "12-12": "Kurban Bayramı (3. Gün)",
  "12-13": "Kurban Bayramı (4. Gün)",
};

// Günün ayeti için arayüz
interface DailyVerse {
  id: string; // "surahId-verseNumber" formatında benzersiz ID
  surahName: string;
  surahId: string;
  verseNumber: number;
  text: string;
  translation: string;
}

// Son okunan sure için arayüz
interface LastReadSurah {
  id: string;
  name: string;
  lastReadDate: string;
  lastReadVerseNumber?: number;
}

interface DailyPrayer {
  id: string;
  title: string;
  prayer: string;
  arabic?: string;
  meaning?: string;
  source?: string;
}

let dailyPrayersList: DailyPrayer[] = [];

try {
  const jsonData = require('@/assets/data/daily_prayers.json');
  if (jsonData && Array.isArray(jsonData) && jsonData.length > 0) {
    dailyPrayersList = jsonData.map((item: any) => ({
      id: item.id,
      title: item.title || 'Başlıksız Dua',
      prayer: item.meaning || item.prayer || 'Dua metni bulunamadı.',
      arabic: item.arabic,
      meaning: item.meaning || item.prayer,
      source: item.source
    }));
  } else {
    dailyPrayersList = [
      {
        id: 'fallback-prayer-0',
        title: "Varsayılan Sabah Duası",
        prayer: "Allah'ım! Bu günün başlangıcını, ortasını ve sonunu hayırlı eyle. Amin.",
        arabic: "اللهم اجعل أول هذا النهار صلاحًا، وأوسطه فلاحًا، وآخره نجاحًا.",
        meaning: "Allah'ım! Bu günün başlangıcını, ortasını ve sonunu hayırlı eyle. Amin."
      }
    ];
  }
} catch (e) {
  console.warn("assets/data/daily_prayers.json bulunamadı veya hatalı. Örnek dualar kullanılıyor.", e);
  dailyPrayersList = [
    {
      id: 'error-prayer-0',
      title: "Hata Durumu Duası",
      prayer: "Veriler yüklenirken bir sorun oluştu.",
    }
  ];
}

// Örnek ayet verileri - surahId-verseNumber formatında ID'ler
const sampleDailyVerses: DailyVerse[] = [
  {
    id: "1-1",
    surahName: "Fatiha Suresi",
    surahId: "1",
    verseNumber: 1,
    text: "بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ",
    translation: "Rahman ve Rahim olan Allah'ın adıyla."
  },
  {
    id: "2-286",
    surahName: "Bakara Suresi",
    surahId: "2",
    verseNumber: 286,
    text: "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا",
    translation: "Allah, bir kimseyi ancak gücünün yettiği şeyle yükümlü kılar."
  },
  {
    id: "112-1",
    surahName: "İhlas Suresi",
    surahId: "112",
    verseNumber: 1,
    text: "قُلْ هُوَ اللَّهُ أَحَدٌ",
    translation: "De ki: O, Allah'tır, tektir."
  },
  {
    id: "2-255",
    surahName: "Bakara Suresi",
    surahId: "2",
    verseNumber: 255,
    text: "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ",
    translation: "Allah, kendisinden başka hiçbir ilah olmayandır. Diridir, kayyumdur."
  },
  {
    id: "55-1",
    surahName: "Rahman Suresi",
    surahId: "55",
    verseNumber: 1,
    text: "الرَّحْمَٰنُ",
    translation: "Rahman (olan Allah, insanlara Kur'an okumayı ve hayatlarını onunla düzenlemeyi) öğretti."
  },
  {
    id: "36-82",
    surahName: "Yasin Suresi",
    surahId: "36",
    verseNumber: 82,
    text: "إِنَّمَا أَمْرُهُ إِذَا أَرَادَ شَيْئًا أَنْ يَقُولَ لَهُ كُنْ فَيَكُونُ",
    translation: "Bir şeyi dilediği zaman O'nun emri, ona sadece 'Ol!' demektir. O da hemen oluverir."
  },
  {
    id: "17-23",
    surahName: "İsra Suresi",
    surahId: "17",
    verseNumber: 23,
    text: "وَقَضَىٰ رَبُّكَ أَلَّا تَعْبُدُوا إِلَّا إِيَّاهُ وَبِالْوَالِدَيْنِ إِحْسَانًا",
    translation: "Rabbin, kendisinden başkasına asla ibadet etmemenizi, ana-babaya iyi davranmanızı kesin olarak emretti."
  },
  {
    id: "103-1",
    surahName: "Asr Suresi",
    surahId: "103",
    verseNumber: 1,
    text: "وَالْعَصْرِ",
    translation: "Andolsun zamana ki, insan gerçekten ziyan içindedir."
  },
  {
    id: "24-35",
    surahName: "Nur Suresi",
    surahId: "24",
    verseNumber: 35,
    text: "اللَّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ",
    translation: "Allah, göklerin ve yerin nurudur."
  },
  {
    id: "31-17",
    surahName: "Lokman Suresi",
    surahId: "31",
    verseNumber: 17,
    text: "يَا بُنَيَّ أَقِمِ الصَّلَاةَ وَأْمُرْ بِالْمَعْرُوفِ وَانْهَ عَنِ الْمُنْكَرِ وَاصْبِرْ عَلَىٰ مَا أَصَابَكَ",
    translation: "Yavrucuğum! Namazı dosdoğru kıl. İyiliği emret. Kötülükten alıkoy. Başına gelen musibetlere karşı sabırlı ol."
  }
];

const prayerOrder = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const prayerNameMap: { [key: string]: string } = {
  Fajr: 'İmsak',
  Sunrise: 'Güneş',
  Dhuhr: 'Öğle',
  Asr: 'İkindi',
  Maghrib: 'Akşam',
  Isha: 'Yatsı',
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function formatTimeRemaining(totalSeconds: number): string {
  if (totalSeconds < 0) return "00:00:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatDateToTurkish(date: Date): string {
  const options: Intl.DateTimeFormatOptions = { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric',
    weekday: 'long'
  };
  return date.toLocaleDateString('tr-TR', options);
}

// Hicri tarih hesaplama fonksiyonunu geliştirelim
function getHijriDate(date: Date): {day: number, month: number, year: number, monthName: string} {
  // Bu hesaplama yaklaşık bir değerdir ve takvim dönüşümüne tam olarak uymayabilir
  // Gerçek bir uygulama için özel Hicri takvim kütüphanesi kullanılması önerilir
  
  // 16 Temmuz 622 MS = Hicri takvimin başlangıcı
  const hijriEpoch = new Date(622, 6, 16).getTime();
  const gregorianDate = new Date(date);
  const gregorianTime = gregorianDate.getTime();
  
  // Miladi ve Hicri takvim arasındaki gün farkı (yaklaşık)
  const daysDiff = Math.floor((gregorianTime - hijriEpoch) / (1000 * 60 * 60 * 24));
  
  // Hicri yıl (365.25 yerine 354.367 gün kullanılıyor)
  const hijriYear = Math.floor(daysDiff / 354.367) + 1;
  
  // Yılın günü (kalan günler)
  const daysInYear = daysDiff % 354.367;
  
  // Ayı hesapla (Hicri takvimde ilk ay 30, ikinci ay 29 gün şeklinde değişir)
  let dayCount = 0;
  let hijriMonth = 0;
  
  const monthLengths = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29];
  
  for (let i = 0; i < 12; i++) {
    dayCount += monthLengths[i];
    if (daysInYear < dayCount) {
      hijriMonth = i;
      break;
    }
  }
  
  // Ayın gününü hesapla
  const dayOfMonth = Math.floor(daysInYear - (dayCount - monthLengths[hijriMonth]) + 1);
  
  return {
    day: dayOfMonth, 
    month: hijriMonth + 1,
    year: hijriYear,
    monthName: hijriMonths[hijriMonth]
  };
}

// Bugünün tarihini Türkçe formatla kısaltılmış şekilde göster
function formatCompactDate(date: Date): string {
  const day = date.getDate();
  
  // Ayı Türkçe kısaltılmış olarak al
  const monthsShort = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const month = monthsShort[date.getMonth()];
  
  const year = date.getFullYear();
  
  // Günü Türkçe kısaltılmış olarak al
  const daysShort = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
  const dayName = daysShort[date.getDay()];
  
  return `${day} ${month} ${year}, ${dayName}`;
}

// Günün İslami özel gün olup olmadığını kontrol eden fonksiyon
function getSpecialIslamicDay(hijriDate: {day: number, month: number}): string | null {
  const key = `${hijriDate.month}-${hijriDate.day}`;
  return specialIslamicDays[key] || null;
}

async function registerForPushNotificationsAsyncForWelcome() {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('welcome-channel', {
        name: 'Welcome Notifications',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    } catch (e) {
      console.warn("Notification channel 'welcome-channel' could not be set, it might already exist:", e);
    }
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return false;
  }
  return true;
}

// Favoriler Modalını İçe Aktaralım

export default function HomeScreen() {
  const { colors, theme } = useTheme();
  const router = useRouter();
  const [miladiDateStr, setMiladiDateStr] = useState<string>('');
  const [currentDailyPrayer, setCurrentDailyPrayer] = useState<DailyPrayer | null>(dailyPrayersList[0] || null);
  const [currentPrayerId, setCurrentPrayerId] = useState<string | null>(dailyPrayersList[0]?.id || null);
  const [favoritePrayerIds, setFavoritePrayerIds] = useState<string[]>([]);
  const [favoriteAyetIds, setFavoriteAyetIds] = useState<string[]>([]);
  const [dailyVerse, setDailyVerse] = useState<DailyVerse | null>(null);
  const [lastReadSurah, setLastReadSurah] = useState<LastReadSurah | null>(null);

  const [prayerTimesToday, setPrayerTimesToday] = useState<{ [key: string]: string } | null>(null);
  const [nextPrayerName, setNextPrayerName] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [isLoadingPrayerTimes, setIsLoadingPrayerTimes] = useState(true);
  const [locationCity, setLocationCity] = useState<string | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const intervalRef = useRef<number | null>(null);
  
  // Anlık saat için state
  const [currentTime, setCurrentTime] = useState<string>(
    new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  const [currentDate, setCurrentDate] = useState<string>(
    formatDateToTurkish(new Date())
  );
  const [shortDate, setShortDate] = useState<string>(
    formatCompactDate(new Date())
  );
  const [hijriDate, setHijriDate] = useState<{day: number, month: number, year: number, monthName: string} | null>(null);
  const [specialDay, setSpecialDay] = useState<string | null>(null);
  const [showFavoritesModal, setShowFavoritesModal] = useState<boolean>(false);
  
  // Animasyon değişkenleri
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timeOpacity = useRef(new Animated.Value(1)).current;
  const iconRotation = useRef(new Animated.Value(0)).current;
  const weatherScale = useRef(new Animated.Value(1)).current;
  const locationScale = useRef(new Animated.Value(1)).current;
  const specialDayAnim = useRef(new Animated.Value(0)).current;
  
  // Günün ayetini yükle
  useEffect(() => {
    const loadDailyVerse = async () => {
      try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const storedVerseData = await AsyncStorage.getItem(DAILY_VERSE_KEY);
        
        if (storedVerseData) {
          const { verse, date } = JSON.parse(storedVerseData);
          if (date === today) {
            // Önceden ID'si yoksa veya doğru formatta değilse düzelt
            if (!verse.id || !verse.id.includes('-')) {
              verse.id = `${verse.surahId}-${verse.verseNumber}`;
            }
            setDailyVerse(verse);
            return;
          }
        }
        
        // Her gün farklı bir ayet göster
        const randomIndex = Math.floor(Math.random() * sampleDailyVerses.length);
        const newVerse = {...sampleDailyVerses[randomIndex]};
        
        // ID'nin doğru formatta olduğundan emin ol
        if (!newVerse.id || !newVerse.id.includes('-')) {
          newVerse.id = `${newVerse.surahId}-${newVerse.verseNumber}`;
        }
        
        setDailyVerse(newVerse);
        
        await AsyncStorage.setItem(DAILY_VERSE_KEY, JSON.stringify({
          verse: newVerse,
          date: today
        }));
      } catch (error) {
        console.error('Günün ayeti yüklenirken hata:', error);
      }
    };
    
    loadDailyVerse();
  }, []);
  
  // Son okunan sureyi yükle
  useEffect(() => {
    const loadLastReadSurah = async () => {
      try {
        const storedSurahData = await AsyncStorage.getItem(LAST_READ_SURAH_KEY);
        if (storedSurahData) {
          setLastReadSurah(JSON.parse(storedSurahData));
        }
      } catch (error) {
        console.error('Son okunan sure yüklenirken hata:', error);
      }
    };
    
    loadLastReadSurah();
  }, []);
  
  // Konum iznini kontrol et
  const checkLocationPermission = async () => {
    setIsLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const hasPermission = status === 'granted';
      setHasLocationPermission(hasPermission);
      
      if (hasPermission) {
        await getUserLocation();
      } else {
        Alert.alert(
          'Konum İzni Gerekli',
          'Bulunduğunuz konuma göre namaz vakitlerini gösterebilmemiz için konum izni vermeniz gerekiyor.',
          [
            { text: 'Daha Sonra', style: 'cancel' },
            { text: 'İzin Ver', onPress: () => checkLocationPermission() }
          ]
        );
        setIsLocationLoading(false);
      }
    } catch (error) {
      console.error('Konum izni alınırken hata:', error);
      setIsLocationLoading(false);
    }
  };

  // Kullanıcının mevcut konumunu al
  const getUserLocation = async () => {
    try {
      setIsLocationLoading(true);
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      
      // Konum bilgilerinden şehri belirle
      const geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      
      if (geocode && geocode.length > 0) {
        const city = geocode[0].city || geocode[0].subregion || geocode[0].region;
        const country = geocode[0].country || '';
        
        if (city) {
          console.log('Tespit edilen şehir:', city, 'Ülke:', country);
          // Şehir ve ülke bilgisini birleştir
          const locationDisplay = country ? `${city}, ${country}` : city;
          setLocationCity(locationDisplay);
          await AsyncStorage.setItem(SELECTED_CITY_KEY, locationDisplay);
          fetchPrayerTimesForLocation(location.coords.latitude, location.coords.longitude, city);
        } else {
          console.warn('Şehir bilgisi alınamadı');
          setIsLocationLoading(false);
          Alert.alert(
            'Konum Hatası',
            'Konumunuza ait şehir bilgisi alınamadı. Lütfen tekrar deneyin.',
            [{ text: 'Tamam' }]
          );
        }
      }
    } catch (error) {
      console.error('Konum alınırken hata:', error);
      setIsLocationLoading(false);
      Alert.alert(
        'Konum Hatası',
        'Konum bilginiz alınırken bir hata oluştu. Lütfen tekrar deneyin.',
        [{ text: 'Tamam' }]
      );
    }
  };

  // Koordinatlara göre namaz vakitlerini API'den çek
  const fetchPrayerTimesForLocation = async (latitude: number, longitude: number, cityName: string) => {
    try {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD formatı
      
      // API'den namaz vakitlerini çek
      // NOT: Gerçek uygulamada burada kendi API endpoint'inizi kullanmalısınız
      const response = await fetch(
        `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${latitude}&longitude=${longitude}&method=13`
      );
      
      if (!response.ok) {
        throw new Error('Namaz vakitleri alınamadı');
      }
      
      const data = await response.json();
      
      if (data.code === 200 && data.data && data.data.timings) {
        const timings = data.data.timings;
        
        // API'den gelen verileri AsyncStorage formatına dönüştür
        const formattedTimings: {[key: string]: string} = {};
        for (const key of prayerOrder) {
          if (timings[key]) {
            formattedTimings[key] = timings[key];
          }
        }
        
        // Verileri AsyncStorage'a kaydet
        const storageObj = {
          [dateStr]: formattedTimings
        };
        
        await AsyncStorage.setItem(`prayerTimes_${cityName}`, JSON.stringify(storageObj));
        
        // State'i güncelle
        setPrayerTimesToday(formattedTimings);
        setIsLoadingPrayerTimes(false);
        setIsLocationLoading(false);
      } else {
        throw new Error('Namaz vakitleri verisi alınamadı');
      }
    } catch (error) {
      console.error('Namaz vakitleri çekilirken hata:', error);
      loadAndProcessPrayerTimes(cityName); // Yedek olarak kaydedilmiş verileri dene
      setIsLocationLoading(false);
    }
  };

  const loadInitialData = useCallback(async () => {
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    setMiladiDateStr(today.toLocaleDateString('tr-TR', options));

    if (dailyPrayersList.length > 0) {
      // Saate göre uygun duayı seç
      const currentHour = today.getHours();
      let prayerIndex: number;
      
      // Saate göre duaları sınıflandır
      if (currentHour >= 4 && currentHour < 10) {
        // Sabah duası (04:00-10:00)
        prayerIndex = dailyPrayersList.findIndex(prayer => 
          prayer.title.toLowerCase().includes('sabah') || 
          prayer.title.toLowerCase().includes('uyanış') ||
          prayer.title.toLowerCase().includes('güne başlarken')
        );
      } else if (currentHour >= 10 && currentHour < 15) {
        // Öğle duası (10:00-15:00)
        prayerIndex = dailyPrayersList.findIndex(prayer => 
          prayer.title.toLowerCase().includes('öğle') || 
          prayer.title.toLowerCase().includes('gün ortası')
        );
      } else if (currentHour >= 15 && currentHour < 18) {
        // İkindi duası (15:00-18:00)
        prayerIndex = dailyPrayersList.findIndex(prayer => 
          prayer.title.toLowerCase().includes('ikindi') || 
          prayer.title.toLowerCase().includes('ikindi vakti')
        );
      } else if (currentHour >= 18 && currentHour < 22) {
        // Akşam duası (18:00-22:00)
        prayerIndex = dailyPrayersList.findIndex(prayer => 
          prayer.title.toLowerCase().includes('akşam') || 
          prayer.title.toLowerCase().includes('akşam vakti')
        );
      } else {
        // Yatsı/Gece duası (22:00-04:00)
        prayerIndex = dailyPrayersList.findIndex(prayer => 
          prayer.title.toLowerCase().includes('yatsı') || 
          prayer.title.toLowerCase().includes('gece') ||
          prayer.title.toLowerCase().includes('uyku')
        );
      }
      
      // Eğer ilgili kategoride dua bulunamazsa, günün bir duasını rassal seç
      if (prayerIndex === -1) {
      const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
        prayerIndex = (dayOfYear - 1 + dailyPrayersList.length) % dailyPrayersList.length;
      }
      
      const selectedPrayer = dailyPrayersList[prayerIndex];
      setCurrentDailyPrayer(selectedPrayer);
      if (selectedPrayer && selectedPrayer.id) {
        setCurrentPrayerId(selectedPrayer.id);
      } else {
        setCurrentPrayerId(null);
      }
    } else {
        setCurrentDailyPrayer(null);
        setCurrentPrayerId(null);
    }

    try {
      // Favorilenen duaları yükle
      const storedFavorites = await AsyncStorage.getItem(FAVORITE_DAILY_PRAYERS_KEY);
      if (storedFavorites) {
        setFavoritePrayerIds(JSON.parse(storedFavorites));
      }
      
      // Favorilenen ayetleri yükle  
      const storedFavoriteAyets = await AsyncStorage.getItem(FAVORITE_AYETS_KEY);
      if (storedFavoriteAyets) {
        setFavoriteAyetIds(JSON.parse(storedFavoriteAyets));
      }
    } catch (e) {
      console.error("Failed to load favorites.", e);
    }
  }, []);

  const loadAndProcessPrayerTimes = useCallback(async (locationBasedCity?: string) => {
    setIsLoadingPrayerTimes(true);
    try {
      // Önce konum bazlı şehri, sonra kaydedilmiş şehri kullan
      const storedCity = locationBasedCity || await AsyncStorage.getItem(SELECTED_CITY_KEY);
      
      if (storedCity) {
        setLocationCity(storedCity);
      }
      
      const storedTimes = await AsyncStorage.getItem(`prayerTimes_${storedCity || 'default'}`);
      
      if (storedTimes) {
        const times = JSON.parse(storedTimes);
        const todayDateStr = new Date().toISOString().split('T')[0];
        const prayerDataForToday = times[todayDateStr];
        if (prayerDataForToday) {
             setPrayerTimesToday(prayerDataForToday);
        } else {
            console.warn(`Bugünün (${todayDateStr}) namaz vakitleri AsyncStorage'de bulunamadı.`);
            setPrayerTimesToday(null); 
        }
      } else {
        console.warn("AsyncStorage'da kayıtlı namaz vakti bulunamadı.");
        setPrayerTimesToday(null);
      }
    } catch (error) {
      console.error("Error loading prayer times from AsyncStorage:", error);
      setPrayerTimesToday(null);
    } finally {
        setIsLoadingPrayerTimes(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
    checkLocationPermission(); // Konum kontrolü yapalım

    const showWelcomeNotification = async () => {
      const hasPermission = await registerForPushNotificationsAsyncForWelcome();
      if (hasPermission) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Uygulamamıza Hoş Geldiniz!",
              body: "Dualar ve Namaz Vakitleri artık sizinle. Keşfetmeye başlayın!",
              sound: true,
            },
            trigger: {
              seconds: 3,
              channelId: 'welcome-channel',
            } as Notifications.TimeIntervalTriggerInput,
          });
        } catch (e) {
          console.error("Error scheduling welcome notification:", e);
        }
      }
    };
    
    // Uygulama arka plandan öne gelince favorileri güncelle
    const interval = setInterval(() => {
      loadInitialData();
    }, 10000); // 10 saniyede bir favori listesini güncelle

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      clearInterval(interval);
    };
  }, [loadInitialData]);

  useEffect(() => {
    if (!prayerTimesToday) {
        setNextPrayerName(null);
        setTimeRemaining(null);
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
    }

    const findNextPrayerAndStartCountdown = () => {
      const now = new Date();
      let nextPrayerDateTime: Date | null = null;
      let foundNextPrayerName: string | null = null;

      for (const prayerKey of prayerOrder) {
        const prayerTimeStr = prayerTimesToday[prayerKey];
        if (!prayerTimeStr || typeof prayerTimeStr !== 'string' || !prayerTimeStr.includes(':')) continue;

        const [hours, minutes] = prayerTimeStr.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) continue;

        const prayerDate = new Date(now);
        prayerDate.setHours(hours, minutes, 0, 0);

        if (prayerDate > now) {
          nextPrayerDateTime = prayerDate;
          foundNextPrayerName = prayerNameMap[prayerKey] || prayerKey;
          break;
        }
      }

      if (!nextPrayerDateTime) {
        const firstPrayerKey = prayerOrder[0];
        const firstPrayerTimeStr = prayerTimesToday[firstPrayerKey];
        if (firstPrayerTimeStr && typeof firstPrayerTimeStr === 'string' && firstPrayerTimeStr.includes(':')) {
          const [hours, minutes] = firstPrayerTimeStr.split(':').map(Number);
          if (!isNaN(hours) && !isNaN(minutes)) {
            const tomorrowPrayerDate = new Date(now);
            tomorrowPrayerDate.setDate(now.getDate() + 1);
            tomorrowPrayerDate.setHours(hours, minutes, 0, 0);
            nextPrayerDateTime = tomorrowPrayerDate;
            foundNextPrayerName = prayerNameMap[firstPrayerKey] || firstPrayerKey;
          }
        }
      }

      if (nextPrayerDateTime && foundNextPrayerName) {
        setNextPrayerName(`${foundNextPrayerName} (${formatTime(nextPrayerDateTime)})`);
        
        const calculateRemaining = () => {
          const totalSecondsRemaining = Math.floor((nextPrayerDateTime!.getTime() - new Date().getTime()) / 1000);
          if (totalSecondsRemaining < 0) {
            setTimeRemaining("00:00:00");
            if (intervalRef.current) clearInterval(intervalRef.current);
            loadAndProcessPrayerTimes();
            return; 
          }
          setTimeRemaining(formatTimeRemaining(totalSecondsRemaining));
        };

        calculateRemaining();
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(calculateRemaining, 1000) as any;
      } else {
        setNextPrayerName(null);
        setTimeRemaining(null);
      }
    };

    findNextPrayerAndStartCountdown();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [prayerTimesToday, loadAndProcessPrayerTimes]);

  // Animasyonları başlat
  const startAnimations = () => {
    // Mevcut animasyonlar
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true
        })
      ])
    ).start();

    // İkon dönüş animasyonu
    Animated.loop(
      Animated.timing(iconRotation, {
        toValue: 1,
        duration: 20000,
        useNativeDriver: true
      })
    ).start();

    // Saat opacity animasyonu
    Animated.loop(
      Animated.sequence([
        Animated.timing(timeOpacity, {
          toValue: 0.85,
          duration: 1500,
          useNativeDriver: true
        }),
        Animated.timing(timeOpacity, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true
        })
      ])
    ).start();
    
    // Hava/konum ikon animasyonu
    Animated.loop(
      Animated.sequence([
        Animated.timing(weatherScale, {
          toValue: 1.15,
          duration: 2000,
          useNativeDriver: true
        }),
        Animated.timing(weatherScale, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true
        })
      ])
    ).start();

    // Konum bilgisi animasyonu
    Animated.loop(
      Animated.sequence([
        Animated.timing(locationScale, {
          toValue: 1.05,
          duration: 1800,
          useNativeDriver: true
        }),
        Animated.timing(locationScale, {
          toValue: 0.95,
          duration: 1800,
          useNativeDriver: true
        })
      ])
    ).start();

    // Özel gün animasyonu
    if (specialDay) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(specialDayAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true
          }),
          Animated.timing(specialDayAnim, {
            toValue: 0.7,
            duration: 1000,
            useNativeDriver: true
          })
        ])
      ).start();
    }
  };

  useEffect(() => {
    // Hicri tarihi hesapla
    const now = new Date();
    const calculatedHijriDate = getHijriDate(now);
    setHijriDate(calculatedHijriDate);
    setShortDate(formatCompactDate(now));
    
    // Özel gün kontrolü
    const specialDayName = getSpecialIslamicDay(calculatedHijriDate);
    setSpecialDay(specialDayName);
    
    // Animasyonları başlat
    startAnimations();
    
    // Saati her saniye güncelle
    const clockInterval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      
      // Gün değiştiyse tarihi de güncelle
      const newDateStr = formatDateToTurkish(now);
      if (newDateStr !== currentDate) {
        setCurrentDate(newDateStr);
      }
    }, 1000);
    
    return () => clearInterval(clockInterval);
  }, [currentDate, loadInitialData]);

  const handleNewPrayer = () => {
    if (dailyPrayersList.length > 0) {
      const newIndex = (dailyPrayersList.findIndex(p => p.id === currentPrayerId) + 1 + dailyPrayersList.length) % dailyPrayersList.length;
      const newPrayer = dailyPrayersList[newIndex];
      setCurrentDailyPrayer(newPrayer);
      setCurrentPrayerId(newPrayer.id);
    }
  };

  const handleToggleFavorite = async () => {
    if (!currentDailyPrayer) return;
    const prayerId = currentDailyPrayer.id;

    // Favorilerde ise, çıkarmak için onay sor
    if (favoritePrayerIds.includes(prayerId)) {
      Alert.alert(
        "Favorilerden Çıkar",
        "Bu duayı favorilerinizden çıkarmak istediğinize emin misiniz?",
        [
          { text: "Hayır", style: "cancel" },
          { 
            text: "Evet", 
            onPress: async () => {
              const updatedFavorites = favoritePrayerIds.filter(id => id !== prayerId);
              setFavoritePrayerIds(updatedFavorites);
              try {
                await AsyncStorage.setItem(FAVORITE_DAILY_PRAYERS_KEY, JSON.stringify(updatedFavorites));
              } catch (e) {
                console.error("Failed to save favorite daily prayers.", e);
              }
            }
          }
        ]
      );
      return;
    }

    // Favorilerde değilse ekle
    const updatedFavorites = [...favoritePrayerIds, prayerId];
    setFavoritePrayerIds(updatedFavorites);
    try {
      await AsyncStorage.setItem(FAVORITE_DAILY_PRAYERS_KEY, JSON.stringify(updatedFavorites));
    } catch (e) {
      console.error("Failed to save favorite daily prayers.", e);
    }
  };

  const isPrayerFavorite = (prayerId: string | null) => prayerId ? favoritePrayerIds.includes(prayerId) : false;

  const toggleFavoriteAyet = async (ayetId: string) => {
    try {
      const isFavorite = favoriteAyetIds.includes(ayetId);
      
      if (isFavorite) {
        // Favorilerden çıkar
        const updatedFavorites = favoriteAyetIds.filter(id => id !== ayetId);
        setFavoriteAyetIds(updatedFavorites);
        await AsyncStorage.setItem(FAVORITE_AYETS_KEY, JSON.stringify(updatedFavorites));
        
        // Kullanıcıya bildirim göster
        Alert.alert("Bilgi", "Ayet favorilerden çıkarıldı");
      } else {
        // Favorilere ekle
        if (!dailyVerse) return;
        
        // Güncellenen favori listesi
        const updatedFavorites = [...favoriteAyetIds, ayetId];
        setFavoriteAyetIds(updatedFavorites);
        
        // AsyncStorage'a kaydet
        await AsyncStorage.setItem(FAVORITE_AYETS_KEY, JSON.stringify(updatedFavorites));
        
        // Kullanıcıya bildirim göster
        Alert.alert("Bilgi", "Ayet favorilere eklendi");
      }
    } catch (e) {
      console.error('Failed to save favorite ayets.', e);
      Alert.alert('Hata', 'Favorilere eklenirken bir sorun oluştu.');
    }
  };

  const isAyetFavorite = (ayetId: string) => favoriteAyetIds.includes(ayetId);

  const navigateToSurah = (surahId: string, verseNumber?: number) => {
    if (verseNumber) {
      router.push(`/duas?surahId=${surahId}&verseNumber=${verseNumber}`);
    } else {
    router.push(`/duas?surahId=${surahId}`);
    }
  };

  const renderPrayerTimesList = () => {
    if (!prayerTimesToday) return null;
    
    return (
      <View style={dynamicStyles.prayerTimesListContainer}>
        {prayerOrder.map((key) => {
          if (!prayerTimesToday[key]) return null;
          
          const prayerName = prayerNameMap[key] || key;
          return (
            <View key={key} style={dynamicStyles.prayerTimeItem}>
              <ThemedText style={dynamicStyles.prayerName}>{prayerName}</ThemedText>
              <ThemedText style={dynamicStyles.prayerTimeText}>{prayerTimesToday[key]}</ThemedText>
            </View>
          );
        })}
      </View>
    );
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollViewContent: {
      padding: 12,
      paddingBottom: 60,
      paddingTop: 12,
    },
    headerContainer: {
      marginTop: 10,
      marginBottom: 20,
    },
    welcomeText: {
      fontSize: 26,
      fontWeight: 'bold',
      color: colors.primary,
      textAlign: 'center',
      marginBottom: 15,
    },
    customHeader: {
      height: 110,
      width: '100%',
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 40 : 15,
      paddingBottom: 10,
      marginBottom: 10,
    },
    headerGradient: {
      flex: 1,
      borderRadius: 16,
      overflow: 'hidden',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
    headerContent: {
      flex: 1,
      justifyContent: 'space-between',
      padding: 15,
      paddingTop: Platform.OS === 'ios' ? 50 : 25,
    },
    timeColumn: {
      justifyContent: 'center',
    },
    timeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    timeText: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#ffffff',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 3,
      fontVariant: ['tabular-nums'],
    },
    headerDateText: {
      fontSize: 14,
      color: '#ffffff',
      opacity: 0.95,
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0.5, height: 0.5 },
      textShadowRadius: 2,
    },
    weatherColumn: {
      alignItems: 'flex-end',
    },
    weatherContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
    },
    weatherText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#ffffff',
      textShadowColor: 'rgba(0, 0, 0, 0.2)',
      textShadowOffset: { width: 0.5, height: 0.5 },
      textShadowRadius: 1.5,
    },
    sectionCard: {
      backgroundColor: colors.card,
      borderRadius: 15,
      padding: 12,
      marginBottom: 15,
      shadowColor: theme === 'dark' ? '#000' : '#888',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 8,
    },
    duaContainer: {
      paddingVertical: 8,
    },
    duaTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 10,
      textAlign: 'center',
    },
    duaText: {
      fontSize: 17,
      lineHeight: 26,
      color: colors.textSecondary,
      textAlign: 'justify',
      marginBottom: 20,
    },
    duaActionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      marginTop: 10,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderRadius: 10,
      backgroundColor: colors.primaryMuted,
    },
    actionButtonText: {
      marginLeft: 8,
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    prayerTimeContainer: {},
    prayerTimeTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 5,
    },
    prayerTimeValue: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.primary,
      textAlign: 'center',
      marginBottom: 15,
    },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      fontStyle: 'italic',
    },
    noDataText: {
      fontSize: 16,
      color: colors.error,
      textAlign: 'center',
      marginTop: 10,
    },
    locationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryMuted,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 20,
      marginTop: 15,
    },
    locationButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
      marginLeft: 8,
    },
    prayerTimesListContainer: {
      marginTop: 15,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 10,
    },
    prayerTimeItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    prayerName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    prayerTimeText: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.primary,
    },
    verseContainer: {
      alignItems: 'center',
      marginBottom: 12,
    },
    verseArabicText: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
      writingDirection: 'rtl',
      lineHeight: 32,
    },
    verseTranslationText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 8,
    },
    verseReference: {
      fontSize: 14,
      color: colors.primary,
      textAlign: 'center',
    },
    verseActions: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 8,
    },
    verseAction: {
      marginHorizontal: 10,
      padding: 8,
    },
    lastReadContainer: {
      padding: 12,
      backgroundColor: colors.primaryMuted,
      borderRadius: 10,
      marginBottom: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    lastReadInfo: {
      flex: 1,
      paddingRight: 12,
    },
    lastReadTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    lastReadText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    continueButton: {
      backgroundColor: colors.primary,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    continueButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    featuredSurahContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 10,
      marginBottom: 5,
    },
    featuredSurah: {
      width: '48%',
      backgroundColor: colors.primaryMuted,
      borderRadius: 10,
      padding: 15,
      alignItems: 'center',
    },
    featuredSurahTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 5,
      textAlign: 'center',
    },
    featuredSurahDescription: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 8,
    },
    readButton: {
      backgroundColor: colors.primary,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      marginTop: 5,
    },
    readButtonText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    iconButton: {
      marginTop: 10,
      alignSelf: 'center',
    },
    dateTimeContainer: {
      width: '100%', 
      marginTop: 15,
      alignItems: 'center',
      backgroundColor: theme === 'dark' ? 'rgba(30, 35, 50, 0.6)' : 'rgba(255, 255, 255, 0.8)',
      borderRadius: 12,
      padding: 15,
    },
    hijriDateText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    currentTimeText: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.primary,
      marginTop: 5,
    },
    dateText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 5,
    },
    dateTimeSectionCard: {
      marginBottom: 20,
    },
  });

  return (
    <ThemedView style={dynamicStyles.container}>
      <View>
      </View>
      
      <ScrollView 
        contentContainerStyle={dynamicStyles.scrollViewContent}>
        {/* Gelişmiş Animasyonlu Tarih-Saat Bileşeni */}
        <LinearGradient
          colors={theme === 'dark' 
            ? (new Date().getHours() >= 18 || new Date().getHours() < 6)
              ? ['rgba(20, 25, 50, 0.95)', 'rgba(10, 15, 35, 0.9)'] // Gece koyu mavi
              : ['rgba(30, 40, 70, 0.95)', 'rgba(15, 25, 50, 0.9)'] // Gündüz koyu mavi
            : (new Date().getHours() >= 18 || new Date().getHours() < 6)
              ? ['rgba(40, 55, 100, 0.98)', 'rgba(25, 35, 75, 0.95)'] // Gece açık mavi
              : ['rgba(65, 105, 225, 0.98)', 'rgba(30, 80, 170, 0.95)'] // Gündüz açık mavi
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 20,
            overflow: 'hidden',
            margin: 10,
            marginBottom: 20,
            shadowColor: theme === 'dark' ? '#000' : '#112',
            shadowOffset: { width: 0, height: 5 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
            elevation: 8,
            borderWidth: 1,
            borderColor: theme === 'dark' 
              ? (new Date().getHours() >= 18 || new Date().getHours() < 6) 
                ? 'rgba(60, 80, 140, 0.3)' 
                : 'rgba(80, 100, 160, 0.3)' 
              : (new Date().getHours() >= 18 || new Date().getHours() < 6)
                ? 'rgba(100, 130, 200, 0.5)'
                : 'rgba(120, 150, 220, 0.5)',
          }}
        >
          {/* Gökyüzü Efekti - Gece/Gündüz */}
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 100,
            backgroundColor: (new Date().getHours() >= 6 && new Date().getHours() < 18)
              ? theme === 'dark' ? 'rgba(50, 100, 200, 0.2)' : 'rgba(80, 130, 230, 0.3)'
              : theme === 'dark' ? 'rgba(10, 20, 40, 0.3)' : 'rgba(20, 30, 80, 0.3)',
            opacity: 0.7,
          }}>
            {/* Yıldızlar (Gece) veya Güneş Işınları (Gündüz) */}
            {(new Date().getHours() >= 18 || new Date().getHours() < 6) ? (
              // Yıldızlar - Gece
              Array.from({ length: 20 }).map((_, i) => (
                <View 
                  key={i} 
                  style={{
                    position: 'absolute',
                    top: Math.random() * 80,
                    left: Math.random() * 390,
                    width: Math.random() * 2 + 1,
                    height: Math.random() * 2 + 1,
                    backgroundColor: '#fff',
                    borderRadius: 10,
                    opacity: Math.random() * 0.8 + 0.2,
                  }}
                />
              ))
            ) : (
              // Güneş Işınları - Gündüz
              Array.from({ length: 5 }).map((_, i) => (
                <View 
                  key={i} 
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 60 + (i * 60),
                    width: 3,
                    height: 70,
                    backgroundColor: 'rgba(255, 255, 200, 0.2)',
                    transform: [{ rotate: `${15 * (i-2)}deg` }],
                    opacity: 0.6,
                  }}
                />
              ))
            )}
          </View>
          
          {/* Ana İçerik */}
          <View style={{
            alignItems: 'center',
            paddingTop: 25,
            paddingBottom: 15,
            zIndex: 2,
          }}>
            {/* Tarih Kısmı - Küçük Yazı */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 10,
            }}>
              <IconSymbol 
                name="calendar" 
                size={16} 
                color="#fff" 
                style={{ marginRight: 8, opacity: 0.9 }}
              />
              <Text style={{
                fontSize: 15,
                fontWeight: '500',
                color: '#fff',
                opacity: 0.9,
                letterSpacing: 0.5,
                textShadowColor: 'rgba(0, 0, 0, 0.4)',
                textShadowOffset: { width: 0.5, height: 0.5 },
                textShadowRadius: 2,
              }}>
                {shortDate}
              </Text>
            </View>
            
            {/* Saat Kısmı - Büyük Yazı - Animasyonlu */}
            <Animated.View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme === 'dark' 
                ? (new Date().getHours() >= 6 && new Date().getHours() < 18)
                  ? 'rgba(25, 35, 60, 0.7)' 
                  : 'rgba(15, 25, 45, 0.7)'
                : (new Date().getHours() >= 6 && new Date().getHours() < 18)
                  ? 'rgba(30, 60, 140, 0.7)'
                  : 'rgba(20, 40, 100, 0.7)',
              paddingHorizontal: 22,
              paddingVertical: 16,
              borderRadius: 20,
              minWidth: 200,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 5,
              transform: [{ scale: pulseAnim }],
              opacity: timeOpacity,
            }}>
              <Animated.View style={{
                marginRight: 12,
                transform: [{ 
                  rotate: iconRotation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg']
                  })
                }]
              }}>
                <IconSymbol 
                  name={new Date().getHours() >= 6 && new Date().getHours() < 18 ? "sun.max.fill" : "moon.stars.fill"} 
                  size={28} 
                  color={new Date().getHours() >= 6 && new Date().getHours() < 18 ? "#FFD700" : "#B8C7FF"} 
                />
              </Animated.View>
              <Text style={{
                fontSize: 36,
                fontWeight: 'bold',
                color: '#fff',
                fontVariant: ['tabular-nums'],
                letterSpacing: 2,
                textShadowColor: 'rgba(0, 0, 0, 0.4)',
                textShadowOffset: { width: 1.5, height: 1.5 },
                textShadowRadius: 3,
              }}>{currentTime}</Text>
            </Animated.View>
            
            {/* Konum Bilgisi (Hicri Tarih yerine) */}
            <Animated.View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 10,
              backgroundColor: theme === 'dark' 
                ? (new Date().getHours() >= 6 && new Date().getHours() < 18)
                  ? 'rgba(40, 55, 90, 0.6)' 
                  : 'rgba(30, 45, 80, 0.6)' 
                : (new Date().getHours() >= 6 && new Date().getHours() < 18)
                  ? 'rgba(60, 100, 190, 0.6)'
                  : 'rgba(50, 80, 160, 0.6)',
              paddingHorizontal: 15,
              paddingVertical: 8,
              borderRadius: 15,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 3,
              elevation: 3,
              transform: [{ scale: weatherScale }]
            }}>
              <IconSymbol 
                name="location.north.fill" 
                size={16} 
                color="#fff" 
                style={{ marginRight: 8 }}
              />
              <Text style={{
                fontSize: 14,
                color: '#fff',
                fontWeight: '600',
                textShadowColor: 'rgba(0, 0, 0, 0.3)',
                textShadowOffset: { width: 0.5, height: 0.5 },
                textShadowRadius: 1.5,
              }}>{locationCity || 'Konum Bilgisi'}</Text>
            </Animated.View>
          </View>
          
          {/* Özel Gün Bilgisi (Eğer Varsa) */}
          {specialDay && (
            <View style={{
              paddingHorizontal: 15,
              paddingBottom: 15,
            }}>
              <Animated.View style={{
                backgroundColor: 'rgba(255, 200, 50, 0.25)',
                paddingHorizontal: 15,
                paddingVertical: 10,
                borderRadius: 15,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 2,
                elevation: 2,
                opacity: specialDayAnim.interpolate({
                  inputRange: [0, 0.7, 1],
                  outputRange: [0.7, 1, 0.7]
                })
              }}>
                <IconSymbol 
                  name="sparkles" 
                  size={18} 
                  color="#FFE066" 
                  style={{ marginRight: 8 }}
                />
                <Text style={{
                  fontSize: 15,
                  color: '#FFE066',
                  fontWeight: '700',
                  textAlign: 'center',
                  textShadowColor: 'rgba(0, 0, 0, 0.4)',
                  textShadowOffset: { width: 0.5, height: 0.5 },
                  textShadowRadius: 2,
                }}>
                  {specialDay}
                </Text>
              </Animated.View>
            </View>
          )}
        </LinearGradient>

        {/* Günün Ayeti */}
        <ThemedView style={dynamicStyles.sectionCard}>
          <ThemedText style={dynamicStyles.sectionTitle}>Günün Ayeti</ThemedText>
          {dailyVerse ? (
            <View style={dynamicStyles.verseContainer}>
              <Text style={dynamicStyles.verseArabicText} selectable>
                {dailyVerse.text}
              </Text>
              <Text style={dynamicStyles.verseTranslationText} selectable>
                {dailyVerse.translation}
              </Text>
              <Text style={dynamicStyles.verseReference}>
                {dailyVerse.surahName} - {dailyVerse.verseNumber}. Ayet
              </Text>
              <View style={dynamicStyles.verseActions}>
                <TouchableOpacity 
                  style={dynamicStyles.verseAction}
                  onPress={() => dailyVerse && navigateToSurah(dailyVerse.surahId, dailyVerse.verseNumber)}
                >
                  <IconSymbol name="book.fill" size={22} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={dynamicStyles.verseAction}
                  onPress={() => Clipboard.setStringAsync(
                    `${dailyVerse.text}\n\n${dailyVerse.translation}\n\n${dailyVerse.surahName} - ${dailyVerse.verseNumber}. Ayet`
                  )}
                >
                  <IconSymbol name="doc.on.doc.fill" size={22} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={dynamicStyles.verseAction}
                  onPress={() => Sharing.shareAsync(
                    `${dailyVerse.text}\n\n${dailyVerse.translation}\n\n${dailyVerse.surahName} - ${dailyVerse.verseNumber}. Ayet`
                  )}
                >
                  <IconSymbol name="square.and.arrow.up.fill" size={22} color={colors.primary} />
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={dynamicStyles.verseAction}
                  onPress={() => dailyVerse && toggleFavoriteAyet(dailyVerse.id)}
                >
                  <IconSymbol 
                    name={dailyVerse && isAyetFavorite(dailyVerse.id) ? 'heart.fill' : 'heart'} 
                    size={22} 
                    color={dailyVerse && isAyetFavorite(dailyVerse.id) ? colors.error : colors.primary} 
                  />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <ActivityIndicator size="large" color={colors.primary} />
          )}
        </ThemedView>

        {/* Son Okunan Sure */}
        {lastReadSurah && (
          <ThemedView style={dynamicStyles.sectionCard}>
            <ThemedText style={dynamicStyles.sectionTitle}>Devam Et</ThemedText>
            <View style={dynamicStyles.lastReadContainer}>
              <View style={dynamicStyles.lastReadInfo}>
                <ThemedText style={dynamicStyles.lastReadTitle}>
                  {lastReadSurah.name}
                </ThemedText>
                <ThemedText style={dynamicStyles.lastReadText}>
                  {lastReadSurah.lastReadDate}
                  {lastReadSurah.lastReadVerseNumber && ` • ${lastReadSurah.lastReadVerseNumber}. Ayet`}
                </ThemedText>
              </View>
              <TouchableOpacity 
                style={dynamicStyles.continueButton}
                onPress={() => navigateToSurah(lastReadSurah.id)}
              >
                <ThemedText style={dynamicStyles.continueButtonText}>Devam Et</ThemedText>
              </TouchableOpacity>
            </View>
            
            {/* Öne Çıkan Sureler */}
            <ThemedText style={[dynamicStyles.sectionTitle, {marginTop: 15}]}>Öne Çıkan Sureler</ThemedText>
            <View style={dynamicStyles.featuredSurahContainer}>
              <TouchableOpacity 
                style={dynamicStyles.featuredSurah}
                onPress={() => navigateToSurah('1')}
              >
                <ThemedText style={dynamicStyles.featuredSurahTitle}>Fatiha Suresi</ThemedText>
                <ThemedText style={dynamicStyles.featuredSurahDescription}>Namazların her rekâtında okunan Kur'an'ın ilk suresi</ThemedText>
                <TouchableOpacity 
                  style={dynamicStyles.readButton}
                  onPress={() => navigateToSurah('1')}
                >
                  <ThemedText style={dynamicStyles.readButtonText}>Oku</ThemedText>
                </TouchableOpacity>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={dynamicStyles.featuredSurah}
                onPress={() => navigateToSurah('112')}
              >
                <ThemedText style={dynamicStyles.featuredSurahTitle}>İhlas Suresi</ThemedText>
                <ThemedText style={dynamicStyles.featuredSurahDescription}>Kur'an'ın üçte birine denk olduğu bildirilen sure</ThemedText>
                <TouchableOpacity 
                  style={dynamicStyles.readButton}
                  onPress={() => navigateToSurah('112')}
                >
                  <ThemedText style={dynamicStyles.readButtonText}>Oku</ThemedText>
                </TouchableOpacity>
              </TouchableOpacity>
            </View>
          </ThemedView>
        )}

        <ThemedView style={dynamicStyles.sectionCard}>
          <ThemedText style={dynamicStyles.sectionTitle}>Günün Duası</ThemedText>
          {currentDailyPrayer ? (
            <View style={dynamicStyles.duaContainer}>
              <ThemedText style={dynamicStyles.duaTitle}>{currentDailyPrayer.title}</ThemedText>
              {currentDailyPrayer.arabic && 
                <Text style={[dynamicStyles.duaText, { writingDirection: 'rtl', textAlign: 'right' }]} selectable>
                    {currentDailyPrayer.arabic}
                </Text>
              }
              <Text style={dynamicStyles.duaText}>{currentDailyPrayer.meaning || currentDailyPrayer.prayer}</Text>
              {currentDailyPrayer.source && 
                <ThemedText style={[dynamicStyles.duaText, { fontStyle: 'italic' }]}>
                    Kaynak: {currentDailyPrayer.source}
                </ThemedText>
              }
              <View style={dynamicStyles.duaActionsContainer}>
                <TouchableOpacity onPress={handleNewPrayer} style={dynamicStyles.actionButton}>
                  <IconSymbol name="arrow.triangle.2.circlepath" size={22} color={colors.primary} />
                  <ThemedText style={dynamicStyles.actionButtonText}>Yeni Dua</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleToggleFavorite} style={dynamicStyles.actionButton}>
                  <IconSymbol 
                    name={isPrayerFavorite(currentPrayerId) ? 'heart.fill' : 'heart'} 
                    size={22} 
                    color={isPrayerFavorite(currentPrayerId) ? colors.error : colors.primary} />
                  <ThemedText style={[dynamicStyles.actionButtonText, { color: isPrayerFavorite(currentPrayerId) ? colors.error : colors.primary }]}>
                    {isPrayerFavorite(currentPrayerId) ? 'Favoriden Çıkar' : 'Favorile'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <ActivityIndicator size="large" color={colors.primary} />
          )}
        </ThemedView>

        <ThemedView style={dynamicStyles.sectionCard}>
          <ThemedText style={dynamicStyles.sectionTitle}>Namaz Vakitleri</ThemedText>
          {isLoadingPrayerTimes || isLocationLoading ? (
            <View>
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 10 }}/>
              <ThemedText style={dynamicStyles.loadingText}>
                {isLocationLoading ? 'Konum bilgisi alınıyor...' : 'Namaz vakitleri yükleniyor...'}
              </ThemedText>
            </View>
          ) : prayerTimesToday ? (
            <View style={dynamicStyles.prayerTimeContainer}>
              {locationCity && (
                <ThemedText style={{fontSize: 18, fontWeight: '600', color: colors.primary, textAlign: 'center', marginBottom: 10}}>
                  {locationCity}
                </ThemedText>
              )}
              
              {nextPrayerName && timeRemaining && (
                <>
                  <ThemedText style={dynamicStyles.prayerTimeTitle}>
                    Sıradaki Vakit: {nextPrayerName}
                  </ThemedText>
                  <ThemedText style={dynamicStyles.prayerTimeValue}>{timeRemaining}</ThemedText>
                </>
              )}
              
              {renderPrayerTimesList()}
              
              <TouchableOpacity 
                onPress={checkLocationPermission}
                style={dynamicStyles.locationButton}
              >
                <IconSymbol name="location.north.fill" size={18} color={colors.primary} />
                <ThemedText style={dynamicStyles.locationButtonText}>Konumumu Güncelle</ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <ThemedText style={dynamicStyles.noDataText}>
                Namaz vakit bilgisi bulunamadı.
              </ThemedText>
              
              <TouchableOpacity 
                onPress={checkLocationPermission}
                style={dynamicStyles.locationButton}
              >
                <IconSymbol name="location.north.fill" size={18} color={colors.primary} />
                <ThemedText style={dynamicStyles.locationButtonText}>Konumumu Güncelle</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </ThemedView>
        
        <TouchableOpacity 
          style={dynamicStyles.iconButton}
          onPress={() => router.push('/settings')}
        >
          <IconSymbol name="gear" size={24} color={colors.primary} />
        </TouchableOpacity>
      </ScrollView>

      {/* Favoriler Modal */}
      <FavoritesModal 
        visible={showFavoritesModal}
        onClose={() => setShowFavoritesModal(false)}
      />
    </ThemedView>
  );
}
