import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTheme } from '@/contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const FAVORITE_DAILY_PRAYERS_KEY = '@favorite_daily_prayers';
const SELECTED_CITY_KEY = 'selectedCity';

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

export default function HomeScreen() {
  const { colors, theme } = useTheme();
  const router = useRouter();
  const [miladiDateStr, setMiladiDateStr] = useState<string>('');
  const [currentDailyPrayer, setCurrentDailyPrayer] = useState<DailyPrayer | null>(dailyPrayersList[0] || null);
  const [currentPrayerId, setCurrentPrayerId] = useState<string | null>(dailyPrayersList[0]?.id || null);
  const [favoritePrayerIds, setFavoritePrayerIds] = useState<string[]>([]);

  const [prayerTimesToday, setPrayerTimesToday] = useState<{ [key: string]: string } | null>(null);
  const [nextPrayerName, setNextPrayerName] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [isLoadingPrayerTimes, setIsLoadingPrayerTimes] = useState(true);
  const [locationCity, setLocationCity] = useState<string | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const intervalRef = useRef<number | null>(null);
  
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
            { text: 'Tamam', onPress: () => checkLocationPermission() }
          ]
        );
        setIsLocationLoading(false);
      }
    } catch (error) {
      console.error('Konum izni alınırken hata:', error);
      setIsLocationLoading(false);
    }
  };

  // Kullanıcının mevcut konumunu al ve namaz vakitlerini yükle
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
        if (city) {
          console.log('Tespit edilen şehir:', city);
          setLocationCity(city);
          await AsyncStorage.setItem(SELECTED_CITY_KEY, city);
          
          // API'den namaz vakitlerini yükle
          await fetchPrayerTimesForCity(city, location.coords.latitude, location.coords.longitude);
        } else {
          console.warn('Şehir bilgisi alınamadı');
          setIsLoadingPrayerTimes(false);
        }
      }
    } catch (error) {
      console.error('Konum alınırken hata:', error);
      setIsLoadingPrayerTimes(false);
    } finally {
      setIsLocationLoading(false);
    }
  };

  // Şehir için namaz vakitlerini API'den çek
  const fetchPrayerTimesForCity = async (city: string, latitude: number, longitude: number) => {
    try {
      // Bu kısım gerçek bir API çağrısı ile değiştirilmelidir
      // Örnek: const response = await fetch(`https://api.example.com/prayertimes?lat=${latitude}&lng=${longitude}`);
      
      // Şu anda sadece mevcut verileri kullanıyoruz
      const storedTimes = await AsyncStorage.getItem(`prayerTimes_${city}`);
      
      if (storedTimes) {
        const times = JSON.parse(storedTimes);
        const todayDateStr = new Date().toISOString().split('T')[0];
        const prayerDataForToday = times[todayDateStr];
        
        if (prayerDataForToday) {
          setPrayerTimesToday(prayerDataForToday);
        } else {
          console.warn(`Bugünün (${todayDateStr}) namaz vakitleri bulunamadı.`);
          setPrayerTimesToday(null);
        }
      } else {
        console.warn(`${city} için kayıtlı namaz vakti bulunamadı.`);
        // Gerçek uygulamada, API'den veri çekilip AsyncStorage'a kaydedilecektir
        setPrayerTimesToday(null);
      }
    } catch (error) {
      console.error("Namaz vakitleri yüklenirken hata:", error);
      setPrayerTimesToday(null);
    } finally {
      setIsLoadingPrayerTimes(false);
    }
  };

  const loadInitialData = useCallback(async () => {
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    setMiladiDateStr(today.toLocaleDateString('tr-TR', options));

    if (dailyPrayersList.length > 0) {
      const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
      const prayerIndex = (dayOfYear - 1 + dailyPrayersList.length) % dailyPrayersList.length;
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
      const storedFavorites = await AsyncStorage.getItem(FAVORITE_DAILY_PRAYERS_KEY);
      if (storedFavorites) {
        setFavoritePrayerIds(JSON.parse(storedFavorites));
      }
    } catch (e) {
      console.error("Failed to load favorite daily prayers.", e);
    }
  }, []);

  const loadAndProcessPrayerTimes = useCallback(async (locationBasedCity?: string) => {
    if (locationBasedCity) {
      setIsLoadingPrayerTimes(true);
      try {
        setLocationCity(locationBasedCity);
        
        const storedTimes = await AsyncStorage.getItem(`prayerTimes_${locationBasedCity}`);
        
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
    } else {
      // Konum bilgisi yoksa, konumu almayı deneyelim
      checkLocationPermission();
    }
  }, []);

  useEffect(() => {
    loadInitialData();
    checkLocationPermission(); // Uygulama başladığında otomatik konum kontrolü yap

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

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
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
    let updatedFavorites: string[];

    if (favoritePrayerIds.includes(prayerId)) {
      updatedFavorites = favoritePrayerIds.filter(id => id !== prayerId);
    } else {
      updatedFavorites = [...favoritePrayerIds, prayerId];
    }
    setFavoritePrayerIds(updatedFavorites);
    try {
      await AsyncStorage.setItem(FAVORITE_DAILY_PRAYERS_KEY, JSON.stringify(updatedFavorites));
    } catch (e) {
      console.error("Failed to save favorite daily prayers.", e);
    }
  };

  const isPrayerFavorite = (prayerId: string | null) => prayerId ? favoritePrayerIds.includes(prayerId) : false;

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollViewContent: {
      padding: 20,
      paddingBottom: 40,
    },
    headerContainer: {
      alignItems: 'center',
      marginBottom: 25,
      paddingVertical: 15,
      backgroundColor: colors.card,
      borderRadius: 15,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: theme === 'dark' ? 0.3 : 0.1,
      shadowRadius: 5,
      elevation: 5,
    },
    dateText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    welcomeText: {
      fontSize: 26,
      fontWeight: 'bold',
      color: colors.primary,
      textAlign: 'center',
    },
    sectionCard: {
      backgroundColor: colors.card,
      borderRadius: 15,
      padding: 20,
      marginBottom: 25,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: theme === 'dark' ? 0.25 : 0.08,
      shadowRadius: 3,
      elevation: 3,
    },
    sectionTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 15,
      textAlign: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 10,
    },
    duaContainer: {},
    duaTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
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
      backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 15,
      marginTop: 10,
    },
    locationButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.primary,
      marginLeft: 8,
    },
  });

  return (
    <ThemedView style={dynamicStyles.container}>
      <ScrollView contentContainerStyle={dynamicStyles.scrollViewContent}>
        <View style={dynamicStyles.headerContainer}>
          <ThemedText style={dynamicStyles.dateText}>{miladiDateStr}</ThemedText>
          <ThemedText style={dynamicStyles.welcomeText}>Hayırlı Günler!</ThemedText>
        </View>

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
          <ThemedText style={dynamicStyles.sectionTitle}>Sıradaki Vakit</ThemedText>
          {isLoadingPrayerTimes || isLocationLoading ? (
            <View>
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 10 }}/>
              <ThemedText style={dynamicStyles.loadingText}>
                {isLocationLoading ? 'Konum bilgisi alınıyor...' : 'Namaz vakitleri yükleniyor...'}
              </ThemedText>
            </View>
          ) : prayerTimesToday && nextPrayerName && timeRemaining ? (
            <View style={dynamicStyles.prayerTimeContainer}>
              <ThemedText style={dynamicStyles.prayerTimeTitle}>
                {nextPrayerName}
                {locationCity && <Text style={{fontSize: 14, color: colors.textSecondary}}> - {locationCity}</Text>}
              </ThemedText>
              <ThemedText style={dynamicStyles.prayerTimeValue}>{timeRemaining}</ThemedText>
              
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
                style={[dynamicStyles.locationButton, {marginTop: 15}]}
              >
                <IconSymbol name="location.north.fill" size={18} color={colors.primary} />
                <ThemedText style={dynamicStyles.locationButtonText}>Konumumu Kullan</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}
