import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol'; // İkonlar için
import { turkishProvinces } from '@/constants/Provinces'; // Assuming you have this constant
import { useTheme } from '@/contexts/ThemeContext'; // Tema hook'u
import { Picker } from '@react-native-picker/picker';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true, // Expo Go'da banner göstermeyebilir, standalone app'te çalışır
    shouldShowList: true, // Android'de bildirim listesinde gösterir
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

async function registerForPushNotificationsAsync() {
  let token;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
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
  // Learn more about projectId: https://docs.expo.dev/push-notifications/push-notifications-setup/#configure-projectid
  // token = (await Notifications.getExpoPushTokenAsync({ projectId: 'your-project-id' })).data;
  // console.log(token);
  return true; // Indicate success
}

export default function PrayerTimesScreen() {
  const { colors, theme } = useTheme(); // Tema renklerini ve mevcut temayı al
  const [selectedCity, setSelectedCity] = useState<string | undefined>(turkishProvinces[0]);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [nextPrayerInfo, setNextPrayerInfo] = useState<NextPrayerInfo | null>(null);
  const [monthlyPrayerTimes, setMonthlyPrayerTimes] = useState<any[] | null>(null);
  // İl seçici için yeni state'ler
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProvinces, setFilteredProvinces] = useState(turkishProvinces);

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
    
    return () => clearInterval(timerId); // Cleanup timer on unmount
  }, []);

  // Function to calculate next prayer and countdown
  const calculateNextPrayer = (currentPrayerTimes: PrayerTimes, tomorrowPrayerTimes?: PrayerTimes) => {
    const now = new Date();
    let nextPrayer: NextPrayerInfo | null = null;

    // Check today's prayer times
    for (const prayerName of prayerOrder) {
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
          name: formatPrayerName(prayerName),
          time: timeStr,
          countdown: `${String(diffHours).padStart(2, '0')}:${String(diffMinutes).padStart(2, '0')}:${String(diffSeconds).padStart(2, '0')}`,
          isTomorrow: false,
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
        name: formatPrayerName('Fajr'),
        time: timeStr,
        countdown: `${String(diffHours).padStart(2, '0')}:${String(diffMinutes).padStart(2, '0')}:${String(diffSeconds).padStart(2, '0')}`,
        isTomorrow: true,
      };
    }
    setNextPrayerInfo(nextPrayer);
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (prayerTimes && monthlyPrayerTimes) {
          const today = new Date();
          const todayDateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          const tomorrowDate = new Date(today);
          tomorrowDate.setDate(today.getDate() + 1);
          const tomorrowDateString = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;

          const currentDayData = monthlyPrayerTimes.find(pt => pt.date.startsWith(todayDateString));
          const tomorrowDayData = monthlyPrayerTimes.find(pt => pt.date.startsWith(tomorrowDateString));

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
      const today = new Date();
      const todayDateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const tomorrowDate = new Date(today);
      tomorrowDate.setDate(today.getDate() + 1);
      const tomorrowDateString = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;

      const currentDayData = monthlyPrayerTimes.find(pt => pt.date.startsWith(todayDateString));
      const tomorrowDayData = monthlyPrayerTimes.find(pt => pt.date.startsWith(tomorrowDateString));
      
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
      Fajr: apiTimes.fajr || '',
      Sunrise: apiTimes.sun || '',
      Dhuhr: apiTimes.dhuhr || '',
      Asr: apiTimes.asr || '',
      Maghrib: apiTimes.maghrib || '',
      Isha: apiTimes.isha || '',
    };
  };

  const fetchLocationId = async (city: string) => {
    setLoading(true);
    setError(null);
    setPrayerTimes(null);
    setNextPrayerInfo(null);
    setMonthlyPrayerTimes(null);
    setLocationId(null);
    const normalizedUserInputCity = normalizeTurkishString(city);

    // API isteği için de normalize edilmiş şehir adını kullanalım.
    const normalizedCityForAPI = normalizeTurkishString(city);

    try {
      const apiUrl = `https://prayertimes.api.abdus.dev/api/diyanet/search?q=${encodeURIComponent(normalizedCityForAPI)}&country=turkey`;
      console.log("API İsteği Yapılıyor (Normalize Edilmiş Şehir ile): ", apiUrl);
      const response = await fetch(apiUrl);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API isteği (${response.status}): ${errorText || 'Sunucu hatası'}`);
      }
      const locationsArray = await response.json();
      console.log(`API Yanıtı (${city}):`, JSON.stringify(locationsArray, null, 2));

      if (Array.isArray(locationsArray) && locationsArray.length > 0) {
        let foundId: string | number | null = null;
        let bestMatchInfo: string | null = null;
        let match: any = null; 

        // ÖNCELİK 1: Şehir adı eşleşen ve GEÇERLİ BİR BÖLGESİ (İLÇESİ) olan ilk sonucu bul.
        match = locationsArray.find(loc => {
          const apiCityNormalized = normalizeTurkishString(loc.city);
          const apiRegion = loc.region ? normalizeTurkishString(loc.region) : "";
          return apiCityNormalized === normalizedUserInputCity && apiRegion !== "" && apiRegion !== apiCityNormalized;
        });

        if (match) {
          foundId = match.id;
          bestMatchInfo = `${match.city} (Bölge: ${match.region} - Öncelikli İlçe)`;
          console.log(`ÖNCELİKLİ İLÇE BULUNDU (${normalizedUserInputCity}): ${bestMatchInfo} - ID ${foundId}`);
        } else {
          // ÖNCELİK 1.1: Eğer yukarıdaki gibi tam bir ilçe bulunamazsa (örn. region il ile aynıysa veya boşsa diye ikinci bir arama)
          // sadece şehir adı eşleşen İLK bölgeyi/kaydı al (bu API'nin ilk ilçe kaydı olabilir)
          match = locationsArray.find(loc => normalizeTurkishString(loc.city) === normalizedUserInputCity && loc.region && normalizeTurkishString(loc.region) !== "");
          if (match) {
            foundId = match.id;
            bestMatchInfo = `${match.city} (Bölge: ${match.region} - API İlk İlçe)`;
            console.log(`API İLK İLÇE BULUNDU (${normalizedUserInputCity}): ${bestMatchInfo} - ID ${foundId}`);
          } else {
            // SON ÇARE: Hiçbir ilçe mantığıyla bulunamazsa, API'nin DÖNDÜRDÜĞÜ İLK SONUCU kullan.
            // Bu, şehir adı eşleşmese bile bir sonuç döndürebilir, dikkatli olunmalı.
            // Ya da sadece şehir adı eşleşen ilk sonucu al (bölgesiz olan ID 9541 gibi, ama veri döndürmüyor)
            // Şimdilik API'nin ilk sonucunu alalım.
            if (locationsArray.length > 0) {
                match = locationsArray[0]; 
                foundId = match.id;
                bestMatchInfo = `${match.city} (${match.region || 'Bölge Yok'} - API Mutlak İlk Sonuç)`;
                console.warn(`SON ÇARE - API MUTLAK İLK SONUÇ (${normalizedUserInputCity} için arandı): ${bestMatchInfo} - ID ${foundId}`);
            }
          }
        }

        if (foundId) {
            setLocationId(String(foundId));
            // İsteğe bağlı: UI'da göstermek için seçilen ilçe adını bir state'e atayabilirsiniz
            // Örneğin: setSelectedDistrictName(match.region || match.city);
        } else {
          // Bu else bloğuna normalde locationsArray boşsa girilmeli, yukarıdaki son çare her zaman bir şey bulmalıydı.
          // Eğer buraya giriyorsa, API gerçekten locationsArray'i boş döndürmüş demektir.
          setError(`'${city}' için konum ID'si bulunamadı (API'den hiç sonuç gelmedi). Lütfen şehir adını kontrol edin veya internet bağlantınızı doğrulayın.`);
          setLoading(false);
        }
      } else { // locationsArray boş veya gelmediyse
        setError(`'${city}' için konum bulunamadı (API'den sonuç gelmedi veya boş). Lütfen şehir adını kontrol edin veya internet bağlantınızı doğrulayın.`);
        setLoading(false);
      }
    } catch (e: any) {
      console.error("Fetch Location ID Error:", e);
      setError(`Konum ID'si alınamadı: ${e.message || 'Bağlantınızı veya şehir adını kontrol edin.'}`);
      setLoading(false);
    }
  };

  const fetchPrayerTimes = async (locId: string) => {
    setLoading(true); // Ensure loading is true at the start of fetching times
    setError(null); // Clear previous errors
    console.log(`Namaz vakitleri için istek yapılıyor - Konum ID: ${locId}`); // Kullanılan ID'yi logla
    try {
      const response = await fetch(`https://prayertimes.api.abdus.dev/api/diyanet/prayertimes?location_id=${locId}`);
      if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API isteği ${response.status} durumuyla başarısız oldu: ${errorText}`);
      }
      const monthlyData = await response.json(); // API returns an array of daily times directly

      if (Array.isArray(monthlyData) && monthlyData.length > 0) {
        setMonthlyPrayerTimes(monthlyData); // Store the full monthly response

        const today = new Date();
        const todayDateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const tomorrowDate = new Date(today);
        tomorrowDate.setDate(today.getDate() + 1);
        const tomorrowDateString = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;

        const currentDayData = monthlyData.find(pt => pt.date.startsWith(todayDateString));
        const tomorrowDayData = monthlyData.find(pt => pt.date.startsWith(tomorrowDateString));

        if (currentDayData) {
          const mappedTodayTimes = mapApiPrayerTimesToInterface(currentDayData);
          if (mappedTodayTimes) {
            setPrayerTimes(mappedTodayTimes); // Set today's prayer times for display
            schedulePrayerNotifications(mappedTodayTimes); // Schedule notifications

            const mappedTomorrowTimes = tomorrowDayData ? mapApiPrayerTimesToInterface(tomorrowDayData) : undefined;
            calculateNextPrayer(mappedTodayTimes, mappedTomorrowTimes === null ? undefined : mappedTomorrowTimes); // Calculate initial next prayer
          } else {
             setError(`Bugünün namaz vakitleri işlenemedi.`);
             setPrayerTimes(null);
          }
        } else {
          setError(`Bugün için namaz vakti bulunamadı. API yanıtı (ilk 5 gün): ${JSON.stringify(monthlyData.slice(0,5))}`);
          setPrayerTimes(null);
        }
      } else {
        setError(`Namaz vakitleri alınamadı veya boş geldi. API yanıtı: ${JSON.stringify(monthlyData)}`);
        setPrayerTimes(null);
      }
    } catch (e: any) {
      console.error("Fetch Prayer Times Error:", e);
      setError(`Namaz vakitleri alınamadı: ${e.message || 'Bağlantınızı kontrol edin.'}`);
      setPrayerTimes(null);
      setNextPrayerInfo(null);
      setMonthlyPrayerTimes(null);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCityChange = (cityValue: string) => {
    if (cityValue) {
      setSelectedCity(cityValue);
      setLocationId(null); 
      setPrayerTimes(null);
      setNextPrayerInfo(null);
      setMonthlyPrayerTimes(null);
    }
  };

  // Helper to format prayer time names for display
  const formatPrayerName = (name: keyof PrayerTimes | string) => {
    switch (name) {
      case 'Fajr': return 'İmsak';
      case 'Sunrise': return 'Güneş';
      case 'Dhuhr': return 'Öğle';
      case 'Asr': return 'İkindi';
      case 'Maghrib': return 'Akşam';
      case 'Isha': return 'Yatsı';
      default: return name as string;
    }
  };

  const schedulePrayerNotifications = async (todayPrayers: PrayerTimes) => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync(); // Önceki bildirimleri iptal et
    const now = new Date();

      const scheduleSingleNotif = async (triggerAtMs: number, title: string, body: string) => {
        const nowMs = Date.now();
        if (triggerAtMs > nowMs) {
          const secondsToTrigger = Math.max(1, Math.floor((triggerAtMs - nowMs) / 1000));
          try {
            await Notifications.scheduleNotificationAsync({
            content: {
              title: title,
              body: body,
              sound: true, 
              },
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
        title = `${formatPrayerName(prayerName)} Vaktine 10 Dakika Kaldı`;
        body = `${formatPrayerName(prayerName)} vakti ${timeStr}'de girecek.`;
        await scheduleSingleNotif(tenMinBeforeMs, title, body);

        // Tam namaz vaktinde
        // title = `${formatPrayerName(prayerName)} Vakti Girdi`;
        // body = `${formatPrayerName(prayerName)} vakti (${timeStr}) girdi.`;
        // await scheduleSingleNotif(prayerDateTime.getTime(), title, body);
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

  // Dinamik stiller
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: Platform.OS === 'android' ? 10 : 20, // Android için biraz daha az padding
      alignItems: 'center',
      paddingHorizontal: 15,
      backgroundColor: colors.background, // Tema arkaplanı
    },
    pageTitle: {
      marginVertical: 15,
      color: colors.text, // Tema metin rengi
      textAlign: 'center',
    },
    nextPrayerContainer: {
      width: '100%',
      padding: 15,
      marginBottom: 15,
      backgroundColor: theme === 'dark' ? colors.tint + '20' : colors.tint + '15', // Hafif vurgulu arkaplan
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme === 'dark' ? colors.tint + '50' : colors.tint + '30',
    },
    nextPrayerText: {
      fontSize: 18, // Biraz küçülttüm
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
    },
    countdownText: {
      fontSize: 20, // Biraz büyüttüm
      fontWeight: 'bold',
      color: colors.tint, // Vurgu rengi
      marginTop: 8,
    },
    pickerContainer: {
      width: '100%',
      borderColor: colors.icon, // Tema ikon rengi (kenarlık için)
      borderWidth: 1,
      borderRadius: 8,
      marginBottom: 15,
      backgroundColor: colors.background, // Tema arkaplanı
      overflow: 'hidden', // Android'de Picker'ın kenarlığı düzgün göstermesi için
    },
    picker: {
      width: '100%',
      height: Platform.OS === 'ios' ? 120 : 50, // iOS için daha fazla yükseklik
      color: colors.text, // Picker metin rengi
    },
    pickerItem: {
      // itemStyle Picker'da doğrudan renkleri almıyor gibi, bu yüzden Picker'ın kendisine renk verdik.
      // iOS'ta font büyüklüğü vb. ayarlanabilir.
      fontSize: Platform.OS === 'ios' ? 18 : 16,
    },
    loader: {
      marginVertical: 30, // Yükleme göstergesi için dikey boşluk
    },
    errorText: {
      color: theme === 'dark' ? '#FF7575' : '#D32F2F', // Temaya göre hata rengi
      marginVertical: 15,
      textAlign: 'center',
      paddingHorizontal: 20,
      fontSize: 16,
    },
    prayerTimesContainer: {
      width: '100%',
      marginBottom: 10,
    },
    cityName: {
      textAlign: 'center',
      marginVertical: 10,
      color: colors.text,
    },
    prayerTimeCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 18, // Dikey padding artırıldı
      paddingHorizontal: 15, // Yatay padding eklendi
      marginVertical: 6, // Kartlar arası boşluk
      backgroundColor: theme === 'dark' ? colors.background + 'E6' : colors.background, // Hafif transparan veya düz renk
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme === 'dark' ? colors.icon + '40' : colors.icon + '20', // Daha yumuşak kenarlık
      shadowColor: colors.text, // Gölgelendirme (iOS)
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2, // Gölgelendirme (Android)
    },
    prayerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    prayerIcon: {
      marginRight: 8,
    },
    prayerName: {
      fontSize: 18,
      color: colors.text,
      marginLeft: 10, // İkon ve metin arası boşluk
    },
    prayerTime: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.tint, // Vurgu rengi
    },
    dateInfoContainer: {
      width: '100%',
      paddingVertical: 15,
      marginTop: 10,
      borderTopWidth: 1, // Üstten ayırıcı çizgi
      borderTopColor: colors.icon + '30', // Yumuşak ayırıcı
      alignItems: 'center',
    },
    dateText: {
      fontSize: 16,
      color: colors.text,
      marginBottom: 5,
    },
    hijriDateText: {
      fontSize: 14,
      color: colors.icon, // İkincil renk
      marginBottom: 8,
    },
    currentTimeText: {
      fontSize: 26, // Mevcut saat daha belirgin
      fontWeight: 'bold',
      color: colors.tint, // Vurgu rengi
    },
    // İl seçici için zenginleştirilmiş stiller
    citySelector: {
      width: '100%',
      marginBottom: 15,
    },
    cityButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme === 'dark' ? colors.card : '#F5F8FF',
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme === 'dark' ? colors.tint + '30' : colors.tint + '20',
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 3,
    },
    selectedCityText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    dropdownIcon: {
      marginLeft: 8,
    },
    modalContainer: {
      flex: 1, 
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 20,
      paddingBottom: 30,
      paddingHorizontal: 15,
      maxHeight: '75%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 15,
      paddingHorizontal: 5,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    closeButton: {
      padding: 8,
    },
    citySearchInput: {
      backgroundColor: theme === 'dark' ? colors.card : '#F0F4FF',
      color: colors.text,
      paddingHorizontal: 15,
      paddingVertical: Platform.OS === 'ios' ? 12 : 8,
      borderRadius: 10,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 15,
    },
    provincesList: {
      maxHeight: '90%',
    },
    provinceItem: {
      paddingVertical: 14,
      paddingHorizontal: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '30',
    },
    provinceText: {
      fontSize: 17,
      color: colors.text,
    },
    activeProvinceItem: {
      backgroundColor: colors.tint + '15',
    },
    activeProvinceText: {
      color: colors.tint,
      fontWeight: '600',
    },
    hiddenPickerContainer: {
      display: 'none', // Eski Picker'ı gizle
    },
  });

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

  // Arama sorgusunu güncelleme ve filtreleme
  useEffect(() => {
    filterProvinces(searchQuery);
  }, [searchQuery]);

  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
    setIsPickerVisible(false);
    // Mevcut şehir seçme mantığını çağır
    if (city) {
      handleCityChange(city);
    }
  };

  return (
    <ThemedView style={dynamicStyles.container}>
      <ThemedText type="title" style={dynamicStyles.pageTitle}>Namaz Vakitleri</ThemedText>
      
      {nextPrayerInfo && (
        <ThemedView style={dynamicStyles.nextPrayerContainer}>
          <ThemedText type="defaultSemiBold" style={dynamicStyles.nextPrayerText}>
            Sıradaki Vakit: {nextPrayerInfo.name} ({nextPrayerInfo.time})
            {nextPrayerInfo.isTomorrow && " (Yarın)"}
          </ThemedText>
          <ThemedText style={dynamicStyles.countdownText}>{nextPrayerInfo.countdown}</ThemedText>
        </ThemedView>
      )}

      {/* Şehir Seçme Alanı - Zenginleştirilmiş Versyon */}
      <View style={dynamicStyles.citySelector}>
        <TouchableOpacity 
          style={dynamicStyles.cityButton}
          onPress={() => setIsPickerVisible(true)}
          activeOpacity={0.7}
        >
          <ThemedText style={dynamicStyles.selectedCityText}>
            {selectedCity || 'İl Seçiniz'}
          </ThemedText>
          <IconSymbol 
            name="chevron.down"
            size={24} 
            color={colors.icon} 
            style={dynamicStyles.dropdownIcon} 
          />
        </TouchableOpacity>

        <Modal
          visible={isPickerVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsPickerVisible(false)}
        >
          <View style={dynamicStyles.modalContainer}>
            <View style={dynamicStyles.modalContent}>
              <View style={dynamicStyles.modalHeader}>
                <ThemedText style={dynamicStyles.modalTitle}>İl Seçiniz</ThemedText>
                <TouchableOpacity 
                  onPress={() => setIsPickerVisible(false)}
                  style={dynamicStyles.closeButton}
                >
                  <IconSymbol 
                    name="xmark.circle.fill"
                    size={24} 
                    color={colors.icon} 
                  />
                </TouchableOpacity>
              </View>
              
              {/* Arama Alanı */}
              <TextInput
                style={dynamicStyles.citySearchInput}
                placeholder="İl Ara..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              
              {/* İl Listesi */}
              <ScrollView style={dynamicStyles.provincesList} showsVerticalScrollIndicator={true}>
                {filteredProvinces.map((province) => (
                  <TouchableOpacity 
                    key={province}
                    style={[
                      dynamicStyles.provinceItem,
                      selectedCity === province ? dynamicStyles.activeProvinceItem : null
                    ]}
                    onPress={() => handleCitySelect(province)}
                  >
                    <Text 
                      style={[
                        dynamicStyles.provinceText,
                        selectedCity === province ? dynamicStyles.activeProvinceText : null
                      ]}
                    >
                      {province}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
      
      {/* Eski Picker bileşeni (hala işlevsel ama görünür değil) */}
      <View style={dynamicStyles.hiddenPickerContainer}>
        <Picker
          selectedValue={selectedCity}
          style={dynamicStyles.picker}
          itemStyle={dynamicStyles.pickerItem}
          onValueChange={handleCityChange}
          dropdownIconColor={colors.icon}
        >
          {turkishProvinces.map((province) => (
            <Picker.Item key={province} label={province} value={province} color={colors.text} />
          ))}
        </Picker>
      </View>

      {loading && <ActivityIndicator size="large" color={colors.tint} style={dynamicStyles.loader} />}
      
      {error && <ThemedText style={dynamicStyles.errorText}>{error}</ThemedText>}

      {prayerTimes && !loading && (
        <ScrollView style={dynamicStyles.prayerTimesContainer} showsVerticalScrollIndicator={false}>
          {prayerOrder.map((name) => {
            const time = prayerTimes[name];
            if (!time) return null; // Vakit bilgisi yoksa gösterme
            return (
              <ThemedView key={name} style={dynamicStyles.prayerTimeCard}>
                <View style={dynamicStyles.prayerInfo}>
                    <IconSymbol 
                      name={prayerIcons[name as keyof PrayerTimes] as any}
                      size={26} 
                      color={colors.icon} 
                      style={dynamicStyles.prayerIcon} 
                    />
                    <ThemedText style={dynamicStyles.prayerName}>{formatPrayerName(name)}</ThemedText>
            </View>
                <ThemedText style={dynamicStyles.prayerTime}>{time}</ThemedText>
              </ThemedView>
            );
          })}
        </ScrollView>
      )}

      {/* Date and Time Info */}
      <View style={dynamicStyles.dateInfoContainer}>
        <ThemedText style={dynamicStyles.dateText}>{getCurrentGregorianDate()}</ThemedText>
        <ThemedText style={dynamicStyles.hijriDateText}>{getHijriDate()}</ThemedText>
        <ThemedText style={dynamicStyles.currentTimeText}>{displayedTime}</ThemedText>
      </View>
    </ThemedView>
  );
}