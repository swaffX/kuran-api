import { ThemedText } from '@/components/ThemedText';
import { IconSymbol, IconSymbolName } from '@/components/ui/IconSymbol';
import { useTheme } from '@/contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Easing, Platform, ScrollView, StyleSheet, Switch, TextInput, TouchableOpacity, View } from 'react-native';

const LOCATION_PREFERENCE_KEY = 'locationPreference';
const MANUAL_CITY_KEY = 'manualCity';
const FONT_SIZE_KEY = 'fontSize';
const PRAYER_NOTIFICATIONS_KEY = 'prayerNotifications';
const DAILY_PRAYER_NOTIFICATIONS_KEY = 'dailyPrayerNotifications';
const APP_VERSION = '1.0.0'; // Uygulama versiyonu

const fontSizeOptions = [
  { label: 'Küçük', value: 'small' },
  { label: 'Orta', value: 'medium' },
  { label: 'Büyük', value: 'large' },
];

export default function SettingsScreen() {
  const { colors, theme, toggleTheme } = useTheme();
  const router = useRouter();
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const slideAnimations = useRef(Array(5).fill(0).map(() => new Animated.Value(-20))).current;
  
  const [isThemeSwitchEnabled, setIsThemeSwitchEnabled] = useState(theme === 'dark');

  const [locationPreference, setLocationPreference] = useState<'auto' | 'manual' | null>(null);
  const [manualCity, setManualCity] = useState<string>('');
  const [savedCity, setSavedCity] = useState<string>('');
  const [isSavingCity, setIsSavingCity] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [currentDetectedCity, setCurrentDetectedCity] = useState<string | null>(null);
  
  // Yeni ayarlar için state'ler
  const [selectedFontSize, setSelectedFontSize] = useState<string>('medium');
  const [prayerNotificationsEnabled, setPrayerNotificationsEnabled] = useState(false);
  const [dailyPrayerNotificationsEnabled, setDailyPrayerNotificationsEnabled] = useState(false);
  const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<string | null>(null);

  // Ayarları Yükle
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedLocationPref = await AsyncStorage.getItem(LOCATION_PREFERENCE_KEY) as 'auto' | 'manual' | null;
        if (storedLocationPref) setLocationPreference(storedLocationPref);
        else setLocationPreference('auto'); // Varsayılan konum tercihi

        const storedManualCity = await AsyncStorage.getItem(MANUAL_CITY_KEY);
        if (storedManualCity) {
            setSavedCity(storedManualCity);
            if (storedLocationPref === 'manual') setManualCity(storedManualCity); 
        }

        // Yeni ayarları yükle
        const storedFontSize = await AsyncStorage.getItem(FONT_SIZE_KEY);
        if (storedFontSize) setSelectedFontSize(storedFontSize);
        
        const storedPrayerNotifications = await AsyncStorage.getItem(PRAYER_NOTIFICATIONS_KEY);
        if (storedPrayerNotifications) setPrayerNotificationsEnabled(storedPrayerNotifications === 'true');
        
        const storedDailyPrayerNotifications = await AsyncStorage.getItem(DAILY_PRAYER_NOTIFICATIONS_KEY);
        if (storedDailyPrayerNotifications) setDailyPrayerNotificationsEnabled(storedDailyPrayerNotifications === 'true');
        
        setIsThemeSwitchEnabled(theme === 'dark');

        // Bildirim izni kontrolü
        checkNotificationPermission();

      } catch (e) {
        console.error('Failed to load settings.', e);
        // Hata durumunda varsayılan değerler zaten atanmış olacak
      }
    };
    loadSettings();
  }, [theme]); // Sadece tema değiştiğinde switch için yeniden çalışsın, diğerleri ilk yüklemede yeterli.

  const checkNotificationPermission = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setNotificationPermissionStatus(status);
    } catch (error) {
      console.error('Bildirim izni kontrol edilirken hata:', error);
    }
  };

  const requestNotificationPermission = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationPermissionStatus(status);
      if (status === 'granted') {
        Alert.alert('Bildirim İzni', 'Bildirim izni verildi.');
      } else {
        Alert.alert('Bildirim İzni', 'Bildirim izni verilmedi. Ayarlardan manuel izin verebilirsiniz.');
      }
    } catch (error) {
      console.error('Bildirim izni istenirken hata:', error);
    }
  };

  const handleThemeChange = (value: boolean) => {
    setIsThemeSwitchEnabled(value);
    toggleTheme();
  };

  const handleFontSizeChange = async (itemValue: string) => {
    try {
      setSelectedFontSize(itemValue);
      await AsyncStorage.setItem(FONT_SIZE_KEY, itemValue);
      Alert.alert("Kaydedildi", "Font boyutu ayarı kaydedildi.");
    } catch (e) {
      console.error('Failed to save font size.', e);
      Alert.alert("Hata", "Font boyutu ayarı kaydedilemedi.");
    }
  };

  const handlePrayerNotificationsChange = async (value: boolean) => {
    try {
      if (value && notificationPermissionStatus !== 'granted') {
        await requestNotificationPermission();
        // İzin alındıktan sonra notificationPermissionStatus değişeceği için bu fonksiyon yeniden çağrılacak
        return;
      }
      
      setPrayerNotificationsEnabled(value);
      await AsyncStorage.setItem(PRAYER_NOTIFICATIONS_KEY, value.toString());
      Alert.alert(
        value ? "Bildirimler Açıldı" : "Bildirimler Kapatıldı", 
        value ? "Namaz vakti bildirimleri açıldı." : "Namaz vakti bildirimleri kapatıldı."
      );
    } catch (e) {
      console.error('Bildirim ayarı kaydedilirken hata:', e);
      Alert.alert("Hata", "Bildirim ayarı kaydedilemedi.");
    }
  };

  const handleDailyPrayerNotificationsChange = async (value: boolean) => {
    try {
      if (value && notificationPermissionStatus !== 'granted') {
        await requestNotificationPermission();
        return;
      }
      
      setDailyPrayerNotificationsEnabled(value);
      await AsyncStorage.setItem(DAILY_PRAYER_NOTIFICATIONS_KEY, value.toString());
      Alert.alert(
        value ? "Bildirimler Açıldı" : "Bildirimler Kapatıldı", 
        value ? "Günlük dua bildirimleri açıldı." : "Günlük dua bildirimleri kapatıldı."
      );
    } catch (e) {
      console.error('Günlük dua bildirimi ayarı kaydedilirken hata:', e);
      Alert.alert("Hata", "Günlük dua bildirimi ayarı kaydedilemedi.");
    }
  };

  const handleLocationPreferenceChange = async (preference: 'auto' | 'manual') => {
    try {
      setLocationPreference(preference);
      await AsyncStorage.setItem(LOCATION_PREFERENCE_KEY, preference);
      if (preference === 'auto') {
        setManualCity(''); // Otomatik seçilince manuel şehir inputunu temizle
        await AsyncStorage.removeItem(MANUAL_CITY_KEY); // Kayıtlı manuel şehri de temizle
        setSavedCity('');
        detectLocation(); // Otomatik konumu algıla
      } else {
        setCurrentDetectedCity(null); // Manuel seçilince algılanan şehri temizle
      }
      Alert.alert("Kaydedildi", "Konum tercihi kaydedildi.");
    } catch (e) {
      console.error('Failed to save location preference.', e);
    }
  };

  const handleSaveManualCity = async () => {
    if (locationPreference !== 'manual') {
        Alert.alert("Uyarı", "Manuel şehir kaydetmek için önce 'Manuel Şehir Seçimi' tercihini aktif edin.");
        return;
    }
    if (!manualCity.trim()) {
      Alert.alert("Geçersiz Giriş", "Lütfen geçerli bir şehir adı girin.");
      return;
    }
    setIsSavingCity(true);
    try {
      await AsyncStorage.setItem(MANUAL_CITY_KEY, manualCity.trim());
      setSavedCity(manualCity.trim());
      Alert.alert("Kaydedildi", `Şehir '${manualCity.trim()}' olarak kaydedildi.`);
    } catch (e) {
      console.error('Failed to save manual city.', e);
      Alert.alert("Hata", "Şehir kaydedilemedi.");
    } finally {
      setIsSavingCity(false);
    }
  };

  const openAppSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const openPrivacyPolicy = () => {
    Linking.openURL('https://www.example.com/privacy-policy'); // Gizlilik politikası URL'si
  };

  const openTermsOfService = () => {
    Linking.openURL('https://www.example.com/terms-of-service'); // Kullanım koşulları URL'si
  };

  const detectLocation = async () => {
    setIsDetectingLocation(true);
    setCurrentDetectedCity(null);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Konum bilgisine erişim izni reddedildi.');
      setIsDetectingLocation(false);
      // Kullanıcıyı manuel seçeneğe yönlendir veya ayarlar'dan izin vermesini iste
      if(locationPreference === 'auto') setLocationPreference(null); // Otomatik seçimi kaldır
      return;
    }
    try {
        let location = await Location.getCurrentPositionAsync({});
        // Reverse geocode to get city name
        let geocode = await Location.reverseGeocodeAsync({ latitude: location.coords.latitude, longitude: location.coords.longitude });
        if (geocode.length > 0 && geocode[0].city) {
            const detectedCity = geocode[0].city;
            setCurrentDetectedCity(detectedCity);
            // Otomatik konumu bir yere kaydetmek isteyebilirsiniz, örneğin AsyncStorage'ye
            // Veya namaz vakitleri sayfasında bu bilgi direkt kullanılabilir.
            Alert.alert("Konum Algılandı", `Mevcut şehriniz: ${detectedCity}`);
        } else {
            Alert.alert("Konum Hatası", "Şehir adı bulunamadı.");
        }
    } catch (error) {
        console.error("Error detecting location: ", error);
        Alert.alert("Konum Hatası", "Konum algılanırken bir hata oluştu.");
        if(locationPreference === 'auto') setLocationPreference(null); // Hata durumunda tercihi sıfırla
    } finally {
        setIsDetectingLocation(false);
    }
  };

  // Animasyonları başlat
  useEffect(() => {
    // Ana içerik için yavaşça belirme animasyonu
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
    
    // Başlık için slide animasyonu
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    
    // Kartların scale animasyonu
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 500,
      easing: Easing.elastic(1),
      useNativeDriver: true,
    }).start();
    
    // Kart öğelerinin sırayla slide animasyonu
    slideAnimations.forEach((anim, index) => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 400,
        delay: 100 + index * 70,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
  }, []);
  
  // Bölümler için animasyon ile doğacak bir fonksiyon
  const animatedSection = (index: number, children: React.ReactNode) => {
    return (
      <Animated.View 
        style={[
          styles.section,
          { 
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnimations[Math.min(index, slideAnimations.length - 1)] },
              { scale: scaleAnim }
            ] 
          }
        ]}
      >
        {children}
      </Animated.View>
    );
  };

  // Buton basılma animasyonu
  const pressAnimation = (ref: Animated.Value) => {
    Animated.sequence([
      Animated.timing(ref, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(ref, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Yeni basmalı buton komponenti
  interface AnimatedButtonProps {
    onPress?: () => void;
    style?: any;
    children?: React.ReactNode;
    icon?: {
      name: IconSymbolName;
      size?: number;
      color?: string;
    };
  }

  const AnimatedButton = ({ onPress, style, children, icon }: AnimatedButtonProps) => {
    const buttonScale = useRef(new Animated.Value(1)).current;
    
    const handlePress = () => {
      pressAnimation(buttonScale);
      onPress && onPress();
    };
    
    return (
      <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
        <TouchableOpacity
          style={[styles.animatedButton, style]}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          {icon && (
            <IconSymbol 
              name={icon.name} 
              size={icon.size || 18} 
              color={icon.color || '#FFF'} 
              style={{ marginRight: children ? 8 : 0 }}
            />
          )}
          {children}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const { width } = Dimensions.get('window');
  
  const styles = StyleSheet.create({
    scrollView: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      paddingBottom: 30,
    },
    headerContainer: {
      alignItems: 'center',
      padding: 20,
      paddingTop: 40,
      paddingBottom: 30,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 5,
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.text,
      opacity: 0.7,
    },
    section: {
      marginTop: 20,
      marginHorizontal: 15,
      padding: 20,
      backgroundColor: colors.card,
      borderRadius: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 5,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 15,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginLeft: 10,
    },
    settingItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    settingItemNoBorder: {
      borderBottomWidth: 0,
    },
    settingText: {
      fontSize: 16,
      flex: 1,
      color: colors.text,
    },
    pickerContainer: {
      backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.card,
      borderRadius: 12,
      marginBottom: 15,
      marginTop: 5,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    pickerStyle: {
      color: colors.text,
      height: Platform.OS === 'ios' ? 150 : 50,
    },
    textInput: {
      flex: 1,
      height: 45,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 15,
      color: colors.text,
      backgroundColor: colors.card,
      marginRight: 10,
    },
    buttonContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 15,
      marginBottom: 5,
    },
    locationPreferenceButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 15,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 10,
      backgroundColor: colors.card,
    },
    locationActiveButton: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    locationButtonText: {
      color: colors.text,
      marginLeft: 8,
      fontSize: 14,
      fontWeight: '500',
    },
    locationActiveButtonText: {
      color: '#FFFFFF',
    },
    infoText: {
      fontSize: 14,
      marginTop: 5,
      color: colors.text,
      opacity: 0.7,
    },
    linkText: {
      color: colors.primary,
      fontSize: 16,
      marginVertical: 5,
    },
    linkItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    linkIcon: {
      marginRight: 15,
    },
    versionText: {
      textAlign: 'center',
      marginTop: 25,
      color: colors.text,
      opacity: 0.7,
      fontSize: 14,
    },
    permissionButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 3,
    },
    permissionButtonText: {
      color: 'white',
      fontWeight: 'bold',
      marginLeft: 8,
      fontSize: 15,
    },
    animatedButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 3,
    },
    saveButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 15,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: 'bold',
    },
    buttonText: {
      fontSize: 16,
      marginLeft: 10,
    },
    versionContainer: {
      alignItems: 'center',
      marginTop: 20,
      paddingVertical: 10,
    },
  });

  // Onboarding'i sıfırlama sayfasına yönlendirme
  const navigateToResetOnboarding = () => {
    router.push('/reset-onboarding');
  };

  return (
    <ScrollView 
      style={styles.scrollView} 
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={[
        styles.headerContainer, 
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}>
        <ThemedText style={styles.headerTitle}>Ayarlar</ThemedText>
        <ThemedText style={styles.headerSubtitle}>Uygulamayı özelleştirin</ThemedText>
      </Animated.View>

      {/* Tema ve Görünüm Ayarları */}
      {animatedSection(0, (
        <>
          <ThemedText type="title" style={styles.sectionTitle}>Görünüm Ayarları</ThemedText>
          
          {/* Tema Seçimi - Daha Görsel */}
          <View style={{
            marginBottom: 20,
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
            elevation: 2,
          }}>
            <View style={styles.settingItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconSymbol 
                  name={theme === 'dark' ? 'moon.stars.fill' : 'sun.max.fill'} 
                  size={24} 
                  color={theme === 'dark' ? '#B8C7FF' : '#FFD700'} 
                  style={{ marginRight: 15 }}
                />
                <View>
                  <ThemedText style={{ 
                    fontSize: 17, 
                    fontWeight: '600', 
                    marginBottom: 4,
                    color: colors.text 
                  }}>
                    {theme === 'dark' ? 'Koyu Tema' : 'Açık Tema'}
                  </ThemedText>
                  <ThemedText style={{ 
                    fontSize: 14, 
                    color: colors.textSecondary 
                  }}>
                    {theme === 'dark' 
                      ? 'Karanlık ortamlar için ideal' 
                      : 'Aydınlık ortamlar için ideal'}
                  </ThemedText>
                </View>
              </View>
              <Switch
                trackColor={{ false: '#444444', true: colors.primary }}
                thumbColor={isThemeSwitchEnabled ? '#FFFFFF' : '#CCCCCC'}
                ios_backgroundColor={'#444444'}
                onValueChange={handleThemeChange}
                value={isThemeSwitchEnabled}
              />
            </View>
          </View>

          {/* Tema Önizlemesi */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}>
            {/* Açık Tema Önizlemesi */}
            <TouchableOpacity 
              onPress={() => handleThemeChange(false)}
              style={{
                width: '48%',
                height: 120,
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                padding: 12,
                borderWidth: 2,
                borderColor: !isThemeSwitchEnabled ? colors.primary : 'transparent',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 3,
                elevation: theme === 'dark' ? 0 : 2,
              }}
            >
              <View style={{ 
                width: 40, 
                height: 8, 
                backgroundColor: '#007AFF', 
                borderRadius: 4,
                marginBottom: 8
              }} />
              <View style={{ 
                width: '80%', 
                height: 6, 
                backgroundColor: '#E0E0E0', 
                borderRadius: 3,
                marginBottom: 6
              }} />
              <View style={{ 
                width: '60%', 
                height: 6, 
                backgroundColor: '#E0E0E0', 
                borderRadius: 3,
                marginBottom: 6
              }} />
              <View style={{ 
                width: '70%', 
                height: 6, 
                backgroundColor: '#E0E0E0', 
                borderRadius: 3,
                marginBottom: 8
              }} />
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <IconSymbol 
                  name="sun.max.fill" 
                  size={18} 
                  color="#FFD700" 
                />
                <ThemedText style={{ 
                  color: '#000', 
                  marginLeft: 5,
                  fontSize: 12,
                  fontWeight: '600',
                }}>
                  Açık Tema
                </ThemedText>
              </View>
            </TouchableOpacity>

            {/* Koyu Tema Önizlemesi */}
            <TouchableOpacity 
              onPress={() => handleThemeChange(true)}
              style={{
                width: '48%',
                height: 120,
                backgroundColor: '#121212',
                borderRadius: 12,
                padding: 12,
                borderWidth: 2,
                borderColor: isThemeSwitchEnabled ? colors.primary : 'transparent',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 3,
                elevation: theme === 'light' ? 0 : 2,
              }}
            >
              <View style={{ 
                width: 40, 
                height: 8, 
                backgroundColor: '#0A84FF', 
                borderRadius: 4,
                marginBottom: 8
              }} />
              <View style={{ 
                width: '80%', 
                height: 6, 
                backgroundColor: '#333333', 
                borderRadius: 3,
                marginBottom: 6
              }} />
              <View style={{ 
                width: '60%', 
                height: 6, 
                backgroundColor: '#333333', 
                borderRadius: 3,
                marginBottom: 6
              }} />
              <View style={{ 
                width: '70%', 
                height: 6, 
                backgroundColor: '#333333', 
                borderRadius: 3,
                marginBottom: 8
              }} />
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <IconSymbol 
                  name="moon.stars.fill" 
                  size={18} 
                  color="#B8C7FF" 
                />
                <ThemedText style={{ 
                  color: '#FFF', 
                  marginLeft: 5,
                  fontSize: 12,
                  fontWeight: '600',
                }}>
                  Koyu Tema
                </ThemedText>
              </View>
            </TouchableOpacity>
          </View>

          <View style={[styles.settingItem, styles.settingItemNoBorder]}>
            <ThemedText style={styles.settingText}>Yazı Boyutu</ThemedText>
          </View>
          
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedFontSize}
              onValueChange={handleFontSizeChange}
              style={styles.pickerStyle}
              dropdownIconColor={colors.primary}
            >
              {fontSizeOptions.map((option) => (
                <Picker.Item key={option.value} label={option.label} value={option.value} color={colors.text} />
              ))}
            </Picker>
          </View>
        </>
      ))}

      {/* Bildirim Ayarları */}
      {animatedSection(1, (
        <>
          <ThemedText type="title" style={styles.sectionTitle}>Bildirim Ayarları</ThemedText>
          
          <View style={styles.settingItem}>
            <ThemedText style={styles.settingText}>Namaz Vakti Bildirimleri</ThemedText>
            <Switch
              trackColor={{ false: '#444444', true: colors.primary }}
              thumbColor={prayerNotificationsEnabled ? '#FFFFFF' : '#CCCCCC'}
              ios_backgroundColor={'#444444'}
              onValueChange={handlePrayerNotificationsChange}
              value={prayerNotificationsEnabled}
              disabled={notificationPermissionStatus !== 'granted'}
            />
          </View>

          <View style={[styles.settingItem, styles.settingItemNoBorder]}>
            <ThemedText style={styles.settingText}>Günlük Dua Bildirimleri</ThemedText>
            <Switch
              trackColor={{ false: '#444444', true: colors.primary }}
              thumbColor={dailyPrayerNotificationsEnabled ? '#FFFFFF' : '#CCCCCC'}
              ios_backgroundColor={'#444444'}
              onValueChange={handleDailyPrayerNotificationsChange}
              value={dailyPrayerNotificationsEnabled}
              disabled={notificationPermissionStatus !== 'granted'}
            />
          </View>

          {notificationPermissionStatus !== 'granted' && (
            <View>
              <ThemedText style={styles.infoText}>Bildirimleri kullanmak için izin vermeniz gerekiyor.</ThemedText>
              <AnimatedButton
                onPress={requestNotificationPermission}
                icon={{ name: "bell.fill", size: 16 }}
                style={{}}
              >
                <ThemedText style={styles.permissionButtonText}>Bildirim İzni Ver</ThemedText>
              </AnimatedButton>
            </View>
          )}
        </>
      ))}

      {/* Konum Ayarları */}
      {animatedSection(2, (
        <>
          <ThemedText type="title" style={styles.sectionTitle}>Konum Ayarları</ThemedText>
          <ThemedText style={styles.settingText}>Konum Tercihi</ThemedText>
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.locationPreferenceButton, locationPreference === 'auto' && styles.locationActiveButton]}
              onPress={() => handleLocationPreferenceChange('auto')}
            >
              <IconSymbol 
                name={locationPreference === 'auto' ? 'location.fill' : 'location'} 
                size={18} 
                color={locationPreference === 'auto' ? '#FFFFFF' : colors.primary} 
              />
              <ThemedText style={[styles.locationButtonText, locationPreference === 'auto' && styles.locationActiveButtonText]}>
                Otomatik Algıla
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.locationPreferenceButton, locationPreference === 'manual' && styles.locationActiveButton]}
              onPress={() => handleLocationPreferenceChange('manual')}
            >
              <IconSymbol 
                name={locationPreference === 'manual' ? 'pencil.circle.fill' : 'pencil.circle'} 
                size={18} 
                color={locationPreference === 'manual' ? '#FFFFFF' : colors.primary} 
              />
              <ThemedText style={[styles.locationButtonText, locationPreference === 'manual' && styles.locationActiveButtonText]}>
                Manuel Şehir
              </ThemedText>
            </TouchableOpacity>
          </View>
          
          {isDetectingLocation && (
            <View style={{flexDirection: 'row', alignItems: 'center', marginTop:15}}>
              <ActivityIndicator size="small" color={colors.primary} style={{marginRight:10}}/>
              <ThemedText style={{color: colors.primary}}>Konum algılanıyor...</ThemedText>
            </View>
          )}
          
          {currentDetectedCity && locationPreference === 'auto' && (
            <ThemedText style={styles.infoText}>Algılanan Şehir: {currentDetectedCity}</ThemedText>
          )}

          {locationPreference === 'manual' && (
            <View>
              <View style={[styles.buttonContainer, {marginTop: 20}]}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Şehir adı girin..."
                  placeholderTextColor={'#777777'}
                  value={manualCity}
                  onChangeText={setManualCity}
                />
                <AnimatedButton
                  onPress={handleSaveManualCity}
                  style={{paddingHorizontal: 15, paddingVertical: 10}}
                  icon={{ name: "checkmark.circle.fill", size: 14 }}
                >
                  <ThemedText style={{color: '#FFFFFF', fontWeight: 'bold'}}>
                    {isSavingCity ? "..." : "Kaydet"}
                  </ThemedText>
                </AnimatedButton>
              </View>
              {savedCity && <ThemedText style={styles.infoText}>Kaydedilmiş Şehir: {savedCity}</ThemedText>}
            </View>
          )}
          <ThemedText style={styles.infoText}>Namaz vakitleri ve kıble yönü için konum bilgisi kullanılır.</ThemedText>
        </>
      ))}

      {/* Uygulama Bilgileri */}
      {animatedSection(3, (
        <>
          <ThemedText type="title" style={styles.sectionTitle}>Uygulama Bilgileri</ThemedText>
          
          <TouchableOpacity style={styles.linkItem} onPress={openPrivacyPolicy}>
            <IconSymbol name="lock.shield" size={22} color={colors.primary} style={styles.linkIcon} />
            <ThemedText style={styles.linkText}>Gizlilik Politikası</ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.linkItem} onPress={openTermsOfService}>
            <IconSymbol name="doc.text" size={22} color={colors.primary} style={styles.linkIcon} />
            <ThemedText style={styles.linkText}>Kullanım Koşulları</ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.linkItem, styles.settingItemNoBorder]} onPress={openAppSettings}>
            <IconSymbol name="gear" size={22} color={colors.primary} style={styles.linkIcon} />
            <ThemedText style={styles.linkText}>Cihaz Ayarlarını Aç</ThemedText>
          </TouchableOpacity>

          <ThemedText style={styles.versionText}>
            Uygulama Versiyonu: {APP_VERSION}
          </ThemedText>
        </>
      ))}

      {/* Hakkında */}
      {animatedSection(4, (
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <View style={styles.sectionHeader}>
            <IconSymbol name="info.circle.fill" size={20} color={colors.tint} />
            <ThemedText style={styles.sectionTitle}>Hakkında</ThemedText>
          </View>
          
          <AnimatedButton onPress={openPrivacyPolicy} icon={{ name: "doc.text.fill", color: colors.tint }}>
            <ThemedText style={styles.buttonText}>Gizlilik Politikası</ThemedText>
          </AnimatedButton>
          
          <AnimatedButton onPress={openTermsOfService} icon={{ name: "doc.plaintext.fill", color: colors.tint }}>
            <ThemedText style={styles.buttonText}>Kullanım Koşulları</ThemedText>
          </AnimatedButton>
          
          <AnimatedButton onPress={navigateToResetOnboarding} icon={{ name: "arrow.clockwise", color: colors.tint }}>
            <ThemedText style={styles.buttonText}>Karşılama Ekranını Sıfırla</ThemedText>
          </AnimatedButton>
          
          <View style={styles.versionContainer}>
            <ThemedText style={styles.versionText}>Versiyon: {APP_VERSION}</ThemedText>
          </View>
        </View>
      ))}
    </ScrollView>
  );
} 