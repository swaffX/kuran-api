import { ThemedView } from '@/components/ThemedView';
import { IconSymbol, type IconSymbolName } from '@/components/ui/IconSymbol'; // İkonlar için
import { turkishProvinces } from '@/constants/Provinces'; // Assuming you have this constant
import { useTheme } from '@/contexts/ThemeContext'; // Tema hook'u
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Dimensions, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface PrayerTimes {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
  [key: string]: string; // For other potential times
}

interface NextPrayerInfo {
  name: string;
  time: string;
  countdown: string;
  isTomorrow: boolean;
  index?: number;
}

const normalizeTurkishString = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
    .toLowerCase()
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');
};

const prayerOrder: (keyof PrayerTimes)[] = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

const prayerIcons: Record<keyof PrayerTimes, string> = {
  Fajr: 'moon.stars.fill',
  Sunrise: 'sunrise.fill',
  Dhuhr: 'sun.max.fill',
  Asr: 'cloud.sun.fill',
  Maghrib: 'sunset.fill',
  Isha: 'moon.fill',
};

// Namaz vakitleri için açıklama metinleri
const prayerDescriptions: Record<keyof PrayerTimes, string> = {
  Fajr: 'Tan yerinin ağarmasıyla başlar',
  Sunrise: 'Güneşin doğuş zamanı',
  Dhuhr: 'Güneş tam tepe noktasını geçtikten sonra',
  Asr: 'Gölgenin kendi boyu kadar olduğu zaman',
  Maghrib: 'Güneşin batış zamanı',
  Isha: 'Şafak kaybolduktan sonra',
};

const { width, height } = Dimensions.get('window');

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true, 
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

async function registerForPushNotificationsAsync() {
  let token;
  if (Platform.OS === 'android') {
    // Android için bildirim kanalı oluştur
    await Notifications.setNotificationChannelAsync('namaz-vakitleri', {
      name: 'Namaz Vakitleri',
      description: 'Namaz vakitleri için bildirimler',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3478F6',
      sound: 'adhan.wav', // ses dosyası assets klasöründe olmalı
      enableVibrate: true,
      enableLights: true,
    });
    
    // İmsak vakti için özel kanal
    await Notifications.setNotificationChannelAsync('imsak-vakti', {
      name: 'İmsak Vakti',
      description: 'İmsak vakti için özel bildirimler',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#4CAF50',
      sound: 'adhan.wav',
      enableVibrate: true,
      enableLights: true,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    Alert.alert('İzin Hatası', 'Namaz vakti bildirimlerini almak için lütfen ayarlardan bildirimlere izin verin.');
    return false;
  }
  return true;
}

export default function PrayerTimesScreen() {
  const { colors, theme } = useTheme();
  const router = useRouter();
  const [selectedCity, setSelectedCity] = useState<string | undefined>(turkishProvinces[0]);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [nextPrayerInfo, setNextPrayerInfo] = useState<NextPrayerInfo | null>(null);
  const [monthlyPrayerTimes, setMonthlyPrayerTimes] = useState<any[] | null>(null);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProvinces, setFilteredProvinces] = useState(turkishProvinces);
  const [activeTab, setActiveTab] = useState('today');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [isLocationPermissionDenied, setIsLocationPermissionDenied] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<any>(null);

  const countdownIntervalRef = useRef<number | null>(null);
  const appState = useRef(AppState.currentState);

  // State for live displayed time
  const [displayedTime, setDisplayedTime] = useState(
    new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  useEffect(() => {
    // Timer for live displayed time
    const timerId = setInterval(() => {
      setDisplayedTime(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000); // Update every second

    // Push notification registration
    registerForPushNotificationsAsync();
    
    return () => clearInterval(timerId);
  }, []);

  // Function to calculate next prayer and countdown
  const calculateNextPrayer = (currentPrayerTimes: PrayerTimes, tomorrowPrayerTimes?: PrayerTimes) => {
    const now = new Date();
    let nextPrayer: NextPrayerInfo | null = null;

    // Check today's prayer times
    for (let i = 0; i < prayerOrder.length; i++) {
      const prayerName = prayerOrder[i];
      const timeStr = currentPrayerTimes[prayerName];
      if (!timeStr) continue;
      const [hours, minutes] = timeStr.split(':').map(Number);
      const prayerDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);

      if (prayerDateTime > now) {
        const diffMs = prayerDateTime.getTime() - now.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
        nextPrayer = {
          name: formatPrayerName(prayerName.toString()),
          time: timeStr,
          countdown: `${String(diffHours).padStart(2, '0')}:${String(diffMinutes).padStart(2, '0')}:${String(diffSeconds).padStart(2, '0')}`,
          isTomorrow: false,
          index: i,
        };
        break;
      }
    }

    // If all today's prayers have passed, check tomorrow's Fajr
    if (!nextPrayer && tomorrowPrayerTimes && tomorrowPrayerTimes.Fajr) {
      const timeStr = tomorrowPrayerTimes.Fajr;
      const [hours, minutes] = timeStr.split(':').map(Number);
      const prayerDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hours, minutes);
      const diffMs = prayerDateTime.getTime() - now.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
      nextPrayer = {
        name: formatPrayerName('Fajr'.toString()),
        time: timeStr,
        countdown: `${String(diffHours).padStart(2, '0')}:${String(diffMinutes).padStart(2, '0')}:${String(diffSeconds).padStart(2, '0')}`,
        isTomorrow: true,
        index: 0,
      };
    }
    setNextPrayerInfo(nextPrayer);
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (prayerTimes && monthlyPrayerTimes) {
          // API'den gelen ilk günü bugün, ikinci günü yarın olarak kabul ediyoruz
          const currentDayData = monthlyPrayerTimes[0];
          const tomorrowDayData = monthlyPrayerTimes.length > 1 ? monthlyPrayerTimes[1] : null;

          if (currentDayData) {
            const mappedTodayTimes = mapApiPrayerTimesToInterface(currentDayData);
            if (mappedTodayTimes) {
              const mappedTomorrowTimes = tomorrowDayData ? mapApiPrayerTimesToInterface(tomorrowDayData) : undefined;
              calculateNextPrayer(mappedTodayTimes, mappedTomorrowTimes === null ? undefined : mappedTomorrowTimes);
            }
          }
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [prayerTimes, monthlyPrayerTimes]);

  useEffect(() => {
    if (selectedCity) {
      fetchLocationId(selectedCity);
    }
  }, [selectedCity]);

  useEffect(() => {
    if (locationId) {
      fetchPrayerTimes(locationId);
    }
  }, [locationId]);

  // Countdown timer effect
  useEffect(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    if (prayerTimes && monthlyPrayerTimes) {
      // API'den gelen ilk günü bugün, ikinci günü yarın olarak kabul ediyoruz
      const currentDayData = monthlyPrayerTimes[0];
      const tomorrowDayData = monthlyPrayerTimes.length > 1 ? monthlyPrayerTimes[1] : null;
      
      if (currentDayData) {
        const mappedTodayTimes = mapApiPrayerTimesToInterface(currentDayData);
        if (mappedTodayTimes) {
          const mappedTomorrowTimes = tomorrowDayData ? mapApiPrayerTimesToInterface(tomorrowDayData) : undefined;
          calculateNextPrayer(mappedTodayTimes, mappedTomorrowTimes === null ? undefined : mappedTomorrowTimes);
          countdownIntervalRef.current = setInterval(() => {
            calculateNextPrayer(mappedTodayTimes, mappedTomorrowTimes === null ? undefined : mappedTomorrowTimes);
          }, 1000);
        }
      }
    }
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [prayerTimes, monthlyPrayerTimes]);

  const mapApiPrayerTimesToInterface = (apiTimes: any): PrayerTimes | null => {
    if (!apiTimes || typeof apiTimes !== 'object') return null;
    // Mapping from abdus.dev API (lowercase) to PrayerTimes interface (PascalCase)
    return {
      Fajr: apiTimes.fajr || apiTimes.Fajr || '',
      Sunrise: apiTimes.sun || apiTimes.sunrise || apiTimes.Sunrise || '',
      Dhuhr: apiTimes.dhuhr || apiTimes.Dhuhr || '',
      Asr: apiTimes.asr || apiTimes.Asr || '',
      Maghrib: apiTimes.maghrib || apiTimes.Maghrib || '',
      Isha: apiTimes.isha || apiTimes.Isha || '',
    };
  };
  
  // Konum bazlı namaz vakitlerini almak için fonksiyon
  const fetchPrayerTimesForLocation = async (latitude: number, longitude: number, cityName?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const today = new Date();
      const month = today.getMonth() + 1;
      const year = today.getFullYear();
      
      // API isteği için tarih formatı
      const date = `${year}-${month}`;
      
      // Koordinatları kullanarak namaz vakitleri API isteği
      const response = await fetch(
        `https://api.aladhan.com/v1/calendar/${year}/${month}?latitude=${latitude}&longitude=${longitude}&method=13`
      );
      
      if (!response.ok) {
        throw new Error(`API isteği başarısız: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.data || data.data.length === 0) {
        throw new Error('Namaz vakti verileri bulunamadı');
      }
      
      const currentDay = today.getDate();
      const todayData = data.data.find((day: any) => parseInt(day.date.gregorian.day) === currentDay);
      
      if (!todayData) {
        throw new Error('Bugünün namaz vakitleri bulunamadı');
      }
      
      // Veri kaydet
      setMonthlyPrayerTimes(data.data);
      setPrayerTimes(mapApiPrayerTimesToInterface(todayData.timings));
      
      // Eğer şehir adı varsa, onu kaydet
      if (cityName && cityName.length > 0) {
        setSelectedCity(cityName);
        AsyncStorage.setItem('selectedCity', cityName);
      } else {
        // Konum bilgisinden şehir adını almaya çalış
        try {
          const reverseGeocode = await Location.reverseGeocodeAsync({
            latitude,
            longitude,
          });
          if (reverseGeocode && reverseGeocode.length > 0) {
            const cityInfo = reverseGeocode[0].city || reverseGeocode[0].region;
            if (cityInfo) {
              setSelectedCity(cityInfo);
              AsyncStorage.setItem('selectedCity', cityInfo);
            }
          }
        } catch (geoErr) {
          console.error('Şehir bilgisi alınamadı:', geoErr);
        }
      }
      
      // Varsa bildirimleri planla
      if (todayData.timings) {
        schedulePrayerNotifications(mapApiPrayerTimesToInterface(todayData.timings));
      }
      
      setError(null);
      setIsLocationPermissionDenied(false);
    } catch (err) {
      console.error('Konum bazlı namaz vakitleri alınırken hata oluştu:', err);
      setError(`Namaz vakitleri alınamadı: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`);
      
      // Hata durumunda statik veriler kullan
      useStaticPrayerTimes();
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Statik namaz vakitleri için yardımcı fonksiyon
  const useStaticPrayerTimes = () => {
    // Not: Bu statik veriler sadece örnek amaçlıdır, gerçek namaz vakitleri değildir!
    const staticTimes: PrayerTimes = {
      Fajr: "05:24",
      Sunrise: "06:52",
      Dhuhr: "12:10",
      Asr: "15:04",
      Maghrib: "17:28",
      Isha: "18:56"
    };
    
    setPrayerTimes(staticTimes);
    
    // Statik verilerle çalışabileceğimiz minimal bir veri yapısı oluşturalım
    const today = new Date();
    const staticDayData = {
      date: {
        gregorian: {
          day: today.getDate().toString(),
          month: { en: today.toLocaleString('en-US', { month: 'long' }) },
          year: today.getFullYear().toString()
        }
      },
      timings: {
        Fajr: "05:24",
        Sunrise: "06:52",
        Dhuhr: "12:10",
        Asr: "15:04",
        Maghrib: "17:28",
        Isha: "18:56"
      }
    };
    
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    
    const staticTomorrowData = {
      date: {
        gregorian: {
          day: tomorrow.getDate().toString(),
          month: { en: tomorrow.toLocaleString('en-US', { month: 'long' }) },
          year: tomorrow.getFullYear().toString()
        }
      },
      timings: {
        Fajr: "05:25",
        Sunrise: "06:53",
        Dhuhr: "12:10",
        Asr: "15:03",
        Maghrib: "17:27",
        Isha: "18:55"
      }
    };
    
    setMonthlyPrayerTimes([staticDayData, staticTomorrowData]);
  };

  const fetchLocationId = async (city: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // İlk denemede manuel şehir ismi ile deniyoruz
      const response = await fetch(`https://api.aladhan.com/v1/citySearch?q=${encodeURIComponent(city)}&country=TR`);
      
      if (!response.ok) {
        throw new Error(`API isteği başarısız: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.data || data.data.length === 0) {
        // Eğer şehir bulunamazsa veya boş gelirse, alternatif bir API deneyebiliriz
        // Ya da varsayılan bir konum ID'si kullanabiliriz
        throw new Error("Şehir bilgisi bulunamadı");
      }
      
      const locationData = data.data[0];
      const locId = locationData.id || locationData.country; // id yoksa country kullan
      
      if (!locId) {
        throw new Error("Konum ID'si bulunamadı");
      }
      
      setLocationId(locId);
      setIsLocationPermissionDenied(false);
      setRetryAttempts(0); // Başarılı olduğunda retry sayacını sıfırla
      
    } catch (err) {
      console.error("Konum ID'si alınırken hata oluştu:", err);
      
      // Hata durumunda alternatif bir yöntem deneyelim
      if (retryAttempts < 3) {
        setRetryAttempts(prev => prev + 1);
        
        try {
          // Alternatif olarak Diyanet API'sini deneyebiliriz (varsayımsal)
          // Bu örnek için şimdilik sadece İstanbul için sabit bir ID dönelim
          setLocationId("2344"); // İstanbul için varsayılan ID
          setIsLocationPermissionDenied(false);
          return;
        } catch (fallbackErr) {
          console.error("Alternatif konum yöntemi de başarısız oldu:", fallbackErr);
        }
      }
      
      setError(`Konum ID'si alınamadı: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`);
      setIsLocationPermissionDenied(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrayerTimes = async (locId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const today = new Date();
      const month = today.getMonth() + 1;
      const year = today.getFullYear();

      // API isteğini yap
      const response = await fetch(
        `https://api.aladhan.com/v1/calendarByCity/${year}/${month}?city=${encodeURIComponent(selectedCity || '')}&country=Turkey&method=13`
      );

      if (!response.ok) {
        throw new Error(`API isteği başarısız: ${response.status}`);
      }

      const data = await response.json();

      if (!data.data || data.data.length === 0) {
        throw new Error("Namaz vakti verileri bulunamadı");
      }

      const currentDay = today.getDate();
      const todayData = data.data.find((day: any) => parseInt(day.date.gregorian.day) === currentDay);

      if (!todayData) {
        throw new Error("Bugünün namaz vakitleri bulunamadı");
      }

      // Bugün ve yarın için verileri hazırla
      setMonthlyPrayerTimes(data.data);
      setPrayerTimes(mapApiPrayerTimesToInterface(todayData.timings));

      // Varsa bildirimleri planla
      if (todayData.timings) {
        schedulePrayerNotifications(mapApiPrayerTimesToInterface(todayData.timings));
      }
      
      setError(null);
    } catch (err) {
      console.error("Namaz vakitleri alınırken hata oluştu:", err);
      setError(`Namaz vakitleri alınamadı: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`);
      
      // Eğer API hata verirse statik veri kullanabiliriz
      useStaticPrayerTimes();
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };
  
  const handleCityChange = (cityValue: string) => {
    setSelectedCity(cityValue);
    setIsPickerVisible(false);
  };
  
  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
    setIsPickerVisible(false);
    // İl seçildikten sonra namaz vakitlerini yükle
    fetchLocationId(city);
  };

  // Helper to format prayer time names for display
  const formatPrayerName = (name: string) => {
    const prayerNameMap: Record<string, string> = {
      Fajr: 'İmsak',
      Sunrise: 'Güneş',
      Dhuhr: 'Öğle',
      Asr: 'İkindi',
      Maghrib: 'Akşam',
      Isha: 'Yatsı',
    };

    return prayerNameMap[name] || name;
  };

  const schedulePrayerNotifications = async (todayPrayers: PrayerTimes | null) => {
    if (!todayPrayers) return;
    try {
      await Notifications.cancelAllScheduledNotificationsAsync(); // Önceki bildirimleri iptal et
      const now = new Date();

      const scheduleSingleNotif = async (triggerAtMs: number, title: string, body: string, prayerName: string) => {
        const nowMs = Date.now();
        if (triggerAtMs > nowMs) {
          const secondsToTrigger = Math.max(1, Math.floor((triggerAtMs - nowMs) / 1000));
          try {
            // Namaz vakti için özel içerik ve stil
            const isPrayerTime = prayerName.toLowerCase() === 'fajr' ? 'imsak-vakti' : 'namaz-vakitleri';
            const prayerNameKey = prayerName as keyof typeof prayerIcons;
            const prayerIcon = prayerIcons[prayerNameKey] || 'clock.fill';
            
            // Bildirim içeriği
            const notificationContent = {
              title: title,
              body: body,
              sound: true,
              color: '#3478F6', // iOS için bildirim rengi
              // Android için bildirim stilini özelleştir
              androidBigPicture: null,
              androidBigText: `${body}\n\n${prayerDescriptions[prayerName as keyof typeof prayerDescriptions] || ''}`,
              androidChannelId: isPrayerTime,
              // iOS için bildirim kategorisi
              categoryIdentifier: 'prayer-time',
              // Bildirim verisi
              data: {
                prayerName: prayerName,
                time: todayPrayers[prayerName as keyof PrayerTimes],
                type: 'prayer-notification',
              },
            };

            await Notifications.scheduleNotificationAsync({
              content: notificationContent,
              trigger: { 
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, 
                seconds: secondsToTrigger 
              }, 
            });
            console.log(`Bildirim zamanlandı: "${title}" ${secondsToTrigger}s sonra.`);
          } catch (e) {
            console.error(`Bildirim planlama hatası (${title}):`, e);
          }
        }
      };

      for (const prayerName of prayerOrder) {
        const timeStr = todayPrayers[prayerName];
        if (!timeStr || prayerName === 'Sunrise') continue; // Güneş doğuşu için bildirim atla

        const [hours, minutes] = timeStr.split(':').map(Number);
        const prayerDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
        
        let title = ``;
        let body = ``;

        // Namaz vaktinden 10 dk önce
        const tenMinBeforeMs = prayerDateTime.getTime() - 10 * 60 * 1000;
        title = `${formatPrayerName(prayerName.toString())} Vaktine 10 Dakika Kaldı`;
        body = `${formatPrayerName(prayerName.toString())} vakti ${timeStr}'de girecek.\n${prayerDescriptions[prayerName as keyof typeof prayerDescriptions]}`;
        await scheduleSingleNotif(tenMinBeforeMs, title, body, prayerName.toString());

        // Tam namaz vaktinde
        title = `${formatPrayerName(prayerName.toString())} Vakti Girdi`;
        body = `${formatPrayerName(prayerName.toString())} vakti (${timeStr}) girdi.\n${prayerDescriptions[prayerName as keyof typeof prayerDescriptions]}`;
        await scheduleSingleNotif(prayerDateTime.getTime(), title, body, prayerName.toString());
      }
    } catch (error) {
      console.error('Bildirimleri planlarken genel hata:', error);
      // Alert.alert('Bildirim Hatası', 'Namaz vakti bildirimleri ayarlanamadı.');
    }
  };

  const getHijriDate = () => {
    return "Hicri Tarih (Yakında)";
  };

  const getCurrentGregorianDate = () => {
    return new Date().toLocaleDateString('tr-TR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  // Sayfa yenileme fonksiyonu
  const onRefresh = React.useCallback(() => {
    setIsRefreshing(true);
    if (selectedCity) {
      fetchLocationId(selectedCity);
    } else {
      checkLocationPermission();
    }
  }, [selectedCity]);

  // İl filtreleme fonksiyonu
  const filterProvinces = (query: string) => {
    const normalizedQuery = normalizeTurkishString(query.toLowerCase().trim());
    if (!normalizedQuery) {
      setFilteredProvinces(turkishProvinces);
      return;
    }
    
    const filtered = turkishProvinces.filter(
      province => normalizeTurkishString(province.toLowerCase()).includes(normalizedQuery)
    );
    setFilteredProvinces(filtered);
  };

  // Konum iznini kontrol et ve kullanıcının konumunu al
  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setIsLocationPermissionDenied(true);
        // Konum izni verilmediyse varsayılan şehir kullan
        setSelectedCity("İstanbul");
        fetchLocationId("Istanbul");
        return;
      }
      
      setIsLocationPermissionDenied(false);
      const location = await Location.getCurrentPositionAsync({});
      fetchPrayerTimesForLocation(location.coords.latitude, location.coords.longitude);
    } catch (error) {
      console.error('Konum izni alınamadı:', error);
      setIsLocationPermissionDenied(true);
      // Hata durumunda varsayılan şehir kullan
      setSelectedCity("İstanbul");
      fetchLocationId("Istanbul");
    }
  };

  // İlk yükleme sırasında konum iznini kontrol et
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Önceden seçilen şehri yükle
        const savedCity = await AsyncStorage.getItem('selectedCity');
        if (savedCity) {
          setSelectedCity(savedCity);
        } else {
          // Kayıtlı şehir yoksa, konum izni iste ve şehri otomatik belirle
          await checkLocationPermission();
        }
      } catch (error) {
        console.error("İlk veri yüklenirken hata:", error);
        setSelectedCity('İstanbul'); // Varsayılan olarak İstanbul'u seç
      }
    };

    loadInitialData();
  }, []);

  const renderCountdown = (countdownText: string) => {
    if (!countdownText) return null;
    
    const parts = countdownText.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const seconds = parseInt(parts[2]);

    return (
      <View style={styles.countdownContainer}>
        <View style={styles.countdownUnit}>
          <Text style={[styles.countdownNumber, { color: colors.tint }]}>{hours}</Text>
          <Text style={[styles.countdownLabel, { color: colors.textSecondary }]}>Saat</Text>
        </View>
        
        <Text style={[styles.countdownSeparator, { color: colors.tint, opacity: 0.5 }]}>:</Text>
        
        <View style={styles.countdownUnit}>
          <Text style={[styles.countdownNumber, { color: colors.tint }]}>{minutes}</Text>
          <Text style={[styles.countdownLabel, { color: colors.textSecondary }]}>Dakika</Text>
        </View>
        
        <Text style={[styles.countdownSeparator, { color: colors.tint, opacity: 0.5 }]}>:</Text>
        
        <View style={styles.countdownUnit}>
          <Text style={[styles.countdownNumber, { color: colors.tint }]}>{seconds}</Text>
          <Text style={[styles.countdownLabel, { color: colors.textSecondary }]}>Saniye</Text>
        </View>
      </View>
    );
  };

  // Yükleme ve hata durumlarını göster
  const renderErrorOrLoading = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Namaz vakitleri yükleniyor...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <LinearGradient
            colors={theme === 'dark' ? ['#3c162f', '#46182c'] : ['#ffcdd2', '#ffebee']}
            style={styles.errorGradient}
          >
            <IconSymbol name="exclamationmark.triangle.fill" color={theme === 'dark' ? '#ff6b6b' : '#d32f2f'} size={32} />
            <Text style={[styles.errorText, { color: theme === 'dark' ? '#ff6b6b' : '#d32f2f' }]}>
              {error}
            </Text>
            <TouchableOpacity 
              style={[styles.retryButton, { backgroundColor: theme === 'dark' ? '#ff6b6b' : '#d32f2f' }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (selectedCity) {
                  fetchLocationId(selectedCity);
                } else {
                  checkLocationPermission();
                }
              }}
            >
              <Text style={styles.retryButtonText}>Tekrar Dene</Text>
            </TouchableOpacity>
          </LinearGradient>
          
          {isLocationPermissionDenied && (
            <View style={styles.permissionMessageContainer}>
              <Text style={[styles.permissionMessage, { color: colors.text }]}>
                Konum izni olmadan vakitleri görmek için şehir seçin:
              </Text>
              <TouchableOpacity 
                style={[styles.selectCityButton, { backgroundColor: colors.tint }]}
                onPress={() => setIsPickerVisible(true)}
              >
                <Text style={styles.selectCityButtonText}>Şehir Seç</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    }

    return null;
  };
  
  // Ana içeriği render et
  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={isRefreshing} 
            onRefresh={onRefresh}
            colors={[colors.tint]}
            tintColor={colors.tint}
          />
        }
      >
        {/* Başlık ve Şehir Seçimi */}
        <View style={styles.header}>
          <Text style={[styles.headerText, { color: colors.text }]}>
            Namaz Vakitleri
          </Text>
          
          <TouchableOpacity
            style={styles.citySelector}
            onPress={() => {
              Haptics.selectionAsync();
              setIsPickerVisible(true);
            }}
          >
            <View style={[styles.cityButton, { backgroundColor: colors.card }]}>
              <Text style={[styles.cityText, { color: colors.text }]}>
                {selectedCity || "Şehir Seç"}
              </Text>
              <IconSymbol name="chevron.down" color={colors.text} size={16} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Bugün/Yarın Tabları */}
        <View style={[styles.tabContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'today' && [styles.activeTab, { backgroundColor: colors.tint }]
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('today');
            }}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'today' ? '#fff' : colors.text }
              ]}
            >
              Bugün
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'tomorrow' && [styles.activeTab, { backgroundColor: colors.tint }]
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab('tomorrow');
            }}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'tomorrow' ? '#fff' : colors.text }
              ]}
            >
              Yarın
            </Text>
          </TouchableOpacity>
        </View>

        {renderErrorOrLoading()}

        {!loading && !error && (
          <>
            {/* Sıradaki Namaz Bilgisi */}
            {nextPrayerInfo && (
              <View style={[styles.nextPrayerContainer, { backgroundColor: colors.card }]}>
                <LinearGradient
                  colors={theme === 'dark' ? ['#1a1a2e', '#16213e'] : ['#e6f2ff', '#ffffff']}
                  style={styles.nextPrayerGradient}
                >
                  <View style={styles.nextPrayerIconContainer}>
                    <IconSymbol
                      name={(prayerIcons[nextPrayerInfo.name as keyof PrayerTimes] as IconSymbolName) || "clock.fill"}
                      color={colors.tint}
                      size={32}
                    />
                  </View>
                  
                  <Text style={[styles.nextPrayerLabel, { color: colors.textSecondary }]}>
                    Sıradaki: {formatPrayerName(nextPrayerInfo.name)} ({nextPrayerInfo.time})
                  </Text>
                  
                  <View style={styles.countdownContainer}>
                    {nextPrayerInfo.countdown.split(':').map((unit, index) => (
                      <React.Fragment key={index}>
                        <View style={[styles.countdownUnit, { backgroundColor: colors.background }]}>
                          <Text style={[styles.countdownNumber, { color: colors.tint }]}>{unit}</Text>
                          <Text style={[styles.countdownLabel, { color: colors.textSecondary }]}>
                            {index === 0 ? 'Saat' : index === 1 ? 'Dakika' : 'Saniye'}
                          </Text>
                        </View>
                        {index < 2 && (
                          <Text style={[styles.countdownSeparator, { color: colors.tint }]}>:</Text>
                        )}
                      </React.Fragment>
                    ))}
                  </View>
                </LinearGradient>
              </View>
            )}

            {/* Günün Tüm Namaz Vakitleri - Scroll edilebilir bir container içinde */}
            <View style={[styles.allTimesContainer, { backgroundColor: colors.background }]}>
              {prayerTimes && 
                prayerOrder.map((prayerName) => {
                  const time = prayerTimes[prayerName];
                  const isNext = nextPrayerInfo?.name === prayerName;
                  
                  return (
                    <View
                      key={prayerName}
                      style={[
                        styles.prayerTimeItem,
                        { backgroundColor: colors.card },
                        isNext && { borderColor: colors.tint, borderWidth: 1 }
                      ]}
                    >
                      <View style={styles.prayerTimeIconContainer}>
                        <IconSymbol
                          name={(prayerIcons[prayerName] as IconSymbolName) || "clock.fill"}
                          color={isNext ? colors.tint : colors.icon}
                          size={24}
                        />
                      </View>
                      
                      <View style={styles.prayerTimeTextContainer}>
                        <Text style={[styles.prayerTimeName, { color: colors.text }]}>
                          {formatPrayerName(prayerName.toString())}
                        </Text>
                        <Text style={[styles.prayerTimeDescription, { color: colors.textSecondary }]}>
                          {prayerDescriptions[prayerName]}
                        </Text>
                      </View>
                      
                      <Text style={[styles.prayerTimeValue, { color: isNext ? colors.tint : colors.text }]}>
                        {time}
                      </Text>
                    </View>
                  );
                })}
            </View>

            {/* Günün Tarihi */}
            <View style={[styles.dateContainer, { backgroundColor: colors.card }]}>
              <Text style={[styles.gregorianDate, { color: colors.text }]}>
                {getCurrentGregorianDate()}
              </Text>
              <Text style={[styles.hijriDate, { color: colors.textSecondary }]}>
                {getHijriDate()}
              </Text>
            </View>
            
            {/* Güncel Saat */}
            <View style={[styles.currentTimeContainer, { backgroundColor: colors.card }]}>
              <IconSymbol name="clock.fill" color={colors.tint} size={20} />
              <Text style={[styles.currentTime, { color: colors.text }]}>
                {displayedTime}
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Şehir Seçim Modalı */}
      <Modal
        visible={isPickerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsPickerVisible(false)}
      >
        <View style={styles.modalContainer}>
          <BlurView intensity={80} tint={theme} style={styles.blurBackground}>
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Şehir Seçin</Text>
                <TouchableOpacity onPress={() => setIsPickerVisible(false)}>
                  <IconSymbol name="xmark.circle.fill" color={colors.text} size={24} />
                </TouchableOpacity>
              </View>

              <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
                <IconSymbol name="magnifyingglass" color={colors.icon} size={20} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Şehir ara..."
                  placeholderTextColor={colors.textSecondary}
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
                    filterProvinces(text);
                  }}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => {
                    setSearchQuery('');
                    setFilteredProvinces(turkishProvinces);
                  }}>
                    <IconSymbol name="xmark.circle.fill" color={colors.icon} size={16} />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView style={styles.cityList}>
                {filteredProvinces.map((province) => (
                  <TouchableOpacity
                    key={province}
                    style={[
                      styles.cityItem,
                      { borderBottomColor: colors.border }
                    ]}
                    onPress={() => handleCitySelect(province)}
                  >
                    <Text style={[styles.cityItemText, { color: colors.text }]}>{province}</Text>
                    {selectedCity === province && (
                      <IconSymbol name="checkmark" color={colors.tint} size={20} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </BlurView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  header: {
    padding: 16,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  citySelector: {
    alignItems: 'center',
  },
  cityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cityText: {
    fontSize: 16,
    marginRight: 8,
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 25,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    padding: 4,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 21,
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    margin: 16,
  },
  errorGradient: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 10,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  permissionMessageContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  permissionMessage: {
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 15,
  },
  selectCityButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  selectCityButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  nextPrayerContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  nextPrayerGradient: {
    padding: 16,
    alignItems: 'center',
  },
  nextPrayerIconContainer: {
    marginBottom: 8,
  },
  nextPrayerLabel: {
    fontSize: 16,
    marginBottom: 12,
    fontWeight: '600',
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownUnit: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    width: 70,
  },
  countdownNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  countdownLabel: {
    fontSize: 12,
  },
  countdownSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    paddingHorizontal: 4,
  },
  allTimesContainer: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  prayerTimeItem: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    marginBottom: 8,
    borderRadius: 12,
  },
  prayerTimeIconContainer: {
    marginRight: 16,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prayerTimeTextContainer: {
    flex: 1,
  },
  prayerTimeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  prayerTimeDescription: {
    fontSize: 13,
  },
  prayerTimeValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  dateContainer: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  gregorianDate: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  hijriDate: {
    fontSize: 14,
  },
  currentTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
  },
  currentTime: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  blurBackground: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 30,
    maxHeight: height * 0.7,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  cityList: {
    maxHeight: height * 0.5,
  },
  cityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  cityItemText: {
    fontSize: 16,
  },
});