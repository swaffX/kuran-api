import { ONBOARDING_COMPLETED_KEY } from '@/constants/OnboardingState';
import { CustomThemeProvider } from '@/contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreenModule from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Splash screen'i tutmak için
SplashScreenModule.preventAutoHideAsync();

// Bildirim ayarları
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }) as any,
});

// Bildirim kanallarını oluştur (Android için)
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('prayer-times', {
    name: 'Namaz Vakitleri',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2E7D32',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
    description: 'Namaz vakitleri için bildirimler',
  });
  
  Notifications.setNotificationChannelAsync('fajr-time', {
    name: 'İmsak Vakti',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500],
    lightColor: '#7E57C2',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
    description: 'İmsak/Sabah namazı için özel bildirimler',
  });
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [isReady, setIsReady] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const router = useRouter();
  const segments = useSegments();
  const appState = useRef(AppState.currentState);
  
  // Onboarding durumunu kontrol et
  useEffect(() => {
    async function checkOnboardingStatus() {
      try {
        const value = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
        const isCompleted = value === 'true';
        setOnboardingCompleted(isCompleted);
        setIsReady(true);
      } catch (error) {
        console.error('Onboarding durumu kontrol edilirken hata oluştu:', error);
        setOnboardingCompleted(false);
        setIsReady(true);
      }
    }
    
    checkOnboardingStatus();
  }, []);
  
  // Yönlendirme mantığı
  useEffect(() => {
    if (!isReady) {
      return;
    }
    
    const inAuthGroup = segments[0] === '(tabs)';
    
    if (onboardingCompleted === false && inAuthGroup) {
      // Onboarding tamamlanmamışsa ve tabs içindeyse, onboarding'e yönlendir
      setTimeout(() => {
        router.replace('/onboarding');
      }, 100);
    } else if (onboardingCompleted === true && segments[0] !== '(tabs)' && segments[0] !== 'reset-onboarding') {
      // Onboarding tamamlanmışsa ve tabs dışındaysa, ana sayfaya yönlendir
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 100);
    }
  }, [isReady, onboardingCompleted, segments, router]);
  
  // Splash screen'i kapat
  useEffect(() => {
    if (isReady) {
      setTimeout(async () => {
        await SplashScreenModule.hideAsync();
      }, 300);
    }
  }, [isReady]);
  
  // Uygulama durumu değişikliklerini izle
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // Uygulama ön plana geldiğinde yapılacak işlemler
        console.log('Uygulama ön plana geldi');
      }
      
      appState.current = nextAppState;
    });
    
    return () => {
      subscription.remove();
    };
  }, []);
  
  // Bildirim izinlerini kontrol et
  useEffect(() => {
    async function checkNotificationPermissions() {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        console.log('Bildirim izni verilmedi');
      }
    }
    
    checkNotificationPermissions();
  }, []);
  
  if (!loaded || !isReady) {
    return <View style={{ flex: 1 }} />;
  }
  
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <CustomThemeProvider>
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="reset-onboarding" options={{ headerShown: false }} />
          </Stack>
        </CustomThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
