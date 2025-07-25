import { IconSymbol } from '@/components/ui/IconSymbol';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  LOCATION_PERMISSION_KEY,
  NOTIFICATIONS_ENABLED_KEY,
  ONBOARDING_COMPLETED_KEY,
  PRAYER_NOTIFICATIONS_SETTINGS,
  SELECTED_CITY_KEY,
  SELECTED_COUNTRY_KEY,
  SELECTED_LANGUAGE_KEY,
  SUPPORTED_LANGUAGES
} from '@/constants/OnboardingState';
import { useTheme } from '@/contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  NativeModules,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

// Onboarding sayfaları
enum OnboardingStep {
  LANGUAGE_SELECTION = 0,
  LOCATION_PERMISSION = 1,
  NOTIFICATION_SETTINGS = 2,
  WELCOME = 3,
}

// Cihaz dilini algıla
const getDeviceLanguage = () => {
  const deviceLanguage = 
    Platform.OS === 'ios'
      ? NativeModules.SettingsManager.settings.AppleLocale || 
        NativeModules.SettingsManager.settings.AppleLanguages[0]
      : NativeModules.I18nManager.localeIdentifier;

  // Dil kodunu al (örn: "tr-TR" -> "tr")
  const languageCode = deviceLanguage.split('-')[0].toLowerCase();
  
  // Desteklenen dillerden biri mi kontrol et
  const supportedLanguage = SUPPORTED_LANGUAGES.find(lang => lang.code === languageCode);
  
  // Desteklenen bir dil ise onu döndür, değilse varsayılan olarak Türkçe
  return supportedLanguage ? languageCode : 'tr';
};

export default function OnboardingScreen() {
  const router = useRouter();
  const { theme, toggleTheme, colors } = useTheme();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(OnboardingStep.LANGUAGE_SELECTION);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(getDeviceLanguage());
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [isLocationLoading, setIsLocationLoading] = useState<boolean>(false);
  const [selectedCountry, setSelectedCountry] = useState<string>('Türkiye');
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [notificationSettings, setNotificationSettings] = useState(DEFAULT_NOTIFICATION_SETTINGS);
  const [isExiting, setIsExiting] = useState(false);
  
  // Animasyon değerleri
  const scrollRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  // Sayfa geçiş animasyonu
  const animateToNextStep = (nextStep: OnboardingStep) => {
    // Mevcut sayfayı soldan dışarı kaydır
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true
      })
    ]).start(() => {
      // Sayfa değişimi
      setCurrentStep(nextStep);
      
      // Yeni sayfayı sağdan içeri kaydır
      slideAnim.setValue(100);
      
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true
        })
      ]).start();
    });
  };
  
  // Dil seçimi kaydet ve sonraki adıma geç
  const handleLanguageSelection = async (langCode: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedLanguage(langCode);
      await AsyncStorage.setItem(SELECTED_LANGUAGE_KEY, langCode);
      animateToNextStep(OnboardingStep.LOCATION_PERMISSION);
    } catch (error) {
      console.error('Dil seçimi kaydedilemedi:', error);
    }
  };
  
  // Konum izni iste
  const handleRequestLocationPermission = async () => {
    try {
      setIsLocationLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setLocationPermission(true);
        await AsyncStorage.setItem(LOCATION_PERMISSION_KEY, 'granted');
        
        // Konum bilgisini al
        const location = await Location.getCurrentPositionAsync({});
        console.log('Konum alındı:', location);
        
        // Şehir bilgisini almaya çalış
        try {
          const [geocode] = await Location.reverseGeocodeAsync({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          });
          
          if (geocode) {
            setSelectedCountry(geocode.country || 'Türkiye');
            setSelectedCity(geocode.city || null);
            
            await AsyncStorage.setItem(SELECTED_COUNTRY_KEY, geocode.country || 'Türkiye');
            if (geocode.city) {
              await AsyncStorage.setItem(SELECTED_CITY_KEY, geocode.city);
            }
          }
        } catch (error) {
          console.error('Şehir bilgisi alınamadı:', error);
        }
        
        // Sonraki adıma geç
        animateToNextStep(OnboardingStep.NOTIFICATION_SETTINGS);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Konum İzni',
          'Konum izni vermezseniz namaz vakitlerini takip etmek için manuel olarak şehir seçmeniz gerekecektir.',
          [
            { text: 'İptal', style: 'cancel' },
            { 
              text: 'Manuel Seçim', 
              onPress: () => animateToNextStep(OnboardingStep.NOTIFICATION_SETTINGS)
            }
          ]
        );
      }
    } catch (error) {
      console.error('Konum izni istenirken hata oluştu:', error);
      Alert.alert(
        'Hata',
        'Konum izni alınırken bir hata oluştu. Lütfen tekrar deneyin.',
        [{ text: 'Tamam' }]
      );
    } finally {
      setIsLocationLoading(false);
    }
  };
  
  // Bildirim ayarlarını kaydet ve onboarding'i tamamla
  const completeOnboarding = async () => {
    try {
      setIsExiting(true);
      
      // Bildirim izni iste
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'enabled');
        await AsyncStorage.setItem(
          PRAYER_NOTIFICATIONS_SETTINGS, 
          JSON.stringify(notificationSettings)
        );
      }
      
      // Onboarding tamamlandı olarak işaretle
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
      
      // Çıkış animasyonu
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 400,
          useNativeDriver: true
        })
      ]).start(() => {
        // Ana sayfaya yönlendir
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 300);
      });
    } catch (error) {
      console.error('Onboarding tamamlanırken hata oluştu:', error);
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 300);
    }
  };
  
  // Dil seçim sayfası
  const renderLanguageSelection = () => (
    <Animated.View 
      style={[
        styles.stepContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateX: slideAnim }]
        }
      ]}
    >
      <LinearGradient
        colors={theme === 'dark' 
          ? colors.gradients.primary as any
          : colors.gradients.primary as any}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.headerContent}>
          <Image 
            source={require('@/assets/images/icon.png')} 
            style={styles.logo} 
            resizeMode="contain"
          />
          <Text style={styles.appTitle}>Ezan Vakti Pro</Text>
        </View>
      </LinearGradient>
      
      <View style={styles.contentContainer}>
        <Text style={[styles.title, { color: colors.text }]}>
          Dil Seçimi
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Lütfen kullanmak istediğiniz dili seçin
        </Text>
        
        <View style={styles.languageContainer}>
          {SUPPORTED_LANGUAGES.map((language) => (
            <TouchableOpacity
              key={language.code}
              style={[
                styles.languageOption,
                { 
                  backgroundColor: selectedLanguage === language.code 
                    ? colors.tint 
                    : theme === 'dark' ? colors.card : colors.background,
                  borderColor: selectedLanguage === language.code
                    ? colors.tint
                    : colors.border
                }
              ]}
              onPress={() => handleLanguageSelection(language.code)}
            >
              <Text style={styles.languageFlag}>{language.flag}</Text>
              <Text 
                style={[
                  styles.languageName,
                  { 
                    color: selectedLanguage === language.code
                      ? '#fff'
                      : colors.text
                  }
                ]}
              >
                {language.name}
              </Text>
              
              {selectedLanguage === language.code && (
                <View style={styles.selectedIndicator}>
                  <IconSymbol name="checkmark.circle.fill" color="#fff" size={24} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.tint }]}
          onPress={() => animateToNextStep(OnboardingStep.LOCATION_PERMISSION)}
        >
          <LinearGradient
            colors={colors.gradients.primary as any}
            style={styles.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.buttonText}>Devam Et</Text>
            <IconSymbol name="chevron.right" color="#fff" size={20} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
  
  // Konum izni sayfası
  const renderLocationPermission = () => (
    <Animated.View 
      style={[
        styles.stepContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateX: slideAnim }]
        }
      ]}
    >
      <LinearGradient
        colors={theme === 'dark' 
          ? colors.gradients.primary as any
          : colors.gradients.primary as any}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => animateToNextStep(OnboardingStep.LANGUAGE_SELECTION)}
          >
            <IconSymbol name="chevron.left" color="#fff" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Konum İzni</Text>
          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>
      
      <View style={styles.contentContainer}>
        <View style={styles.locationImageContainer}>
          <LinearGradient
            colors={theme === 'dark' 
              ? ['rgba(46, 125, 50, 0.2)', 'rgba(46, 125, 50, 0.1)']
              : ['rgba(46, 125, 50, 0.2)', 'rgba(46, 125, 50, 0.05)']}
            style={styles.locationImageBackground}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <IconSymbol 
            name="location.fill" 
            color={colors.tint} 
            size={80} 
          />
        </View>
        
        <Text style={[styles.title, { color: colors.text }]}>
          Konumunuzu Bulmamıza İzin Verin
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Bulunduğunuz bölgeye göre doğru namaz vakitlerini gösterebilmemiz için konum izni gerekiyor
        </Text>
        
        <View style={styles.locationInfoContainer}>
          <View style={styles.locationInfoItem}>
            <View style={[styles.locationInfoIcon, { backgroundColor: colors.tint }]}>
              <IconSymbol name="clock.fill" color="#fff" size={24} />
            </View>
            <View style={styles.locationInfoText}>
              <Text style={[styles.locationInfoTitle, { color: colors.text }]}>
                Doğru Namaz Vakitleri
              </Text>
              <Text style={[styles.locationInfoDescription, { color: colors.textSecondary }]}>
                Bulunduğunuz konuma özel namaz vakitlerini gösterir
              </Text>
            </View>
          </View>
          
          <View style={styles.locationInfoItem}>
            <View style={[styles.locationInfoIcon, { backgroundColor: colors.tint }]}>
              <IconSymbol name="bell.fill" color="#fff" size={24} />
            </View>
            <View style={styles.locationInfoText}>
              <Text style={[styles.locationInfoTitle, { color: colors.text }]}>
                Zamanında Bildirimler
              </Text>
              <Text style={[styles.locationInfoDescription, { color: colors.textSecondary }]}>
                Namaz vakitlerinde zamanında bildirim alırsınız
              </Text>
            </View>
          </View>
          
          <View style={styles.locationInfoItem}>
            <View style={[styles.locationInfoIcon, { backgroundColor: colors.tint }]}>
              <IconSymbol name="arrow.up.right" color="#fff" size={24} />
            </View>
            <View style={styles.locationInfoText}>
              <Text style={[styles.locationInfoTitle, { color: colors.text }]}>
                Kıble Yönü
              </Text>
              <Text style={[styles.locationInfoDescription, { color: colors.textSecondary }]}>
                Konumunuza göre doğru kıble yönünü gösterir
              </Text>
            </View>
          </View>
        </View>
      </View>
      
      <View style={styles.footer}>
        {isLocationLoading ? (
          <View style={[styles.button, { backgroundColor: colors.tint }]}>
            <LinearGradient
              colors={colors.gradients.primary as any}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <ActivityIndicator color="#fff" size="small" style={{ marginRight: 10 }} />
              <Text style={styles.buttonText}>İşleniyor...</Text>
            </LinearGradient>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.tint }]}
              onPress={handleRequestLocationPermission}
            >
              <LinearGradient
                colors={colors.gradients.primary as any}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.buttonText}>Konumumu Bul</Text>
                <IconSymbol name="location.fill" color="#fff" size={20} />
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.textButton}
              onPress={() => animateToNextStep(OnboardingStep.NOTIFICATION_SETTINGS)}
            >
              <Text style={[styles.textButtonLabel, { color: colors.textSecondary }]}>
                Manuel Seçim
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Animated.View>
  );
  
  // Bildirim ayarları sayfası
  const renderNotificationSettings = () => {
    // Bildirim ayarlarını güncelle
    const toggleNotification = (key: keyof typeof notificationSettings) => {
      setNotificationSettings(prev => ({
        ...prev,
        [key]: !prev[key]
      }));
    };
    
    // Bildirim süresi ayarını güncelle
    const updateBeforePrayerTime = (minutes: number) => {
      setNotificationSettings(prev => ({
        ...prev,
        beforePrayer: minutes
      }));
    };
    
    return (
      <Animated.View 
        style={[
          styles.stepContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }]
          }
        ]}
      >
        <LinearGradient
          colors={theme === 'dark' 
            ? colors.gradients.primary as any
            : colors.gradients.primary as any}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => animateToNextStep(OnboardingStep.LOCATION_PERMISSION)}
            >
              <IconSymbol name="chevron.left" color="#fff" size={24} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Bildirim Ayarları</Text>
            <View style={{ width: 24 }} />
          </View>
        </LinearGradient>
        
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={styles.contentContainer}>
            <View style={styles.notificationImageContainer}>
              <LinearGradient
                colors={theme === 'dark' 
                  ? ['rgba(46, 125, 50, 0.2)', 'rgba(46, 125, 50, 0.1)']
                  : ['rgba(46, 125, 50, 0.2)', 'rgba(46, 125, 50, 0.05)']}
                style={styles.notificationImageBackground}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <IconSymbol 
                name="bell.badge.fill" 
                color={colors.tint} 
                size={80} 
              />
            </View>
            
            <Text style={[styles.title, { color: colors.text }]}>
              Bildirim Ayarları
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Hangi namaz vakitleri için bildirim almak istediğinizi seçin
            </Text>
            
            <View style={styles.settingsContainer}>
              <View style={styles.settingSection}>
                <Text style={[styles.settingSectionTitle, { color: colors.text }]}>
                  Bildirim Alınacak Vakitler
                </Text>
                
                <View style={[
                  styles.settingOptionsList,
                  { backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)' }
                ]}>
                  <View style={[
                    styles.settingOption, 
                    { borderBottomColor: colors.border, borderBottomWidth: 1 }
                  ]}>
                    <View style={styles.settingOptionInfo}>
                      <View style={[
                        styles.settingOptionIcon, 
                        { backgroundColor: theme === 'dark' ? '#9575CD' : '#7E57C2' }
                      ]}>
                        <IconSymbol name="sunrise.fill" color="#fff" size={20} />
                      </View>
                      <Text style={[styles.settingOptionText, { color: colors.text }]}>
                        İmsak / Sabah
                      </Text>
                    </View>
                    <Switch
                      value={notificationSettings.fajr}
                      onValueChange={() => toggleNotification('fajr')}
                      trackColor={{ false: "#3e3e3e", true: colors.tint }}
                      thumbColor={notificationSettings.fajr ? "#fff" : "#f4f3f4"}
                    />
                  </View>
                  
                  <View style={[
                    styles.settingOption, 
                    { borderBottomColor: colors.border, borderBottomWidth: 1 }
                  ]}>
                    <View style={styles.settingOptionInfo}>
                      <View style={[
                        styles.settingOptionIcon, 
                        { backgroundColor: theme === 'dark' ? '#29B6F6' : '#039BE5' }
                      ]}>
                        <IconSymbol name="sun.max.fill" color="#fff" size={20} />
                      </View>
                      <Text style={[styles.settingOptionText, { color: colors.text }]}>
                        Öğle
                      </Text>
                    </View>
                    <Switch
                      value={notificationSettings.dhuhr}
                      onValueChange={() => toggleNotification('dhuhr')}
                      trackColor={{ false: "#3e3e3e", true: colors.tint }}
                      thumbColor={notificationSettings.dhuhr ? "#fff" : "#f4f3f4"}
                    />
                  </View>
                  
                  <View style={[
                    styles.settingOption, 
                    { borderBottomColor: colors.border, borderBottomWidth: 1 }
                  ]}>
                    <View style={styles.settingOptionInfo}>
                      <View style={[
                        styles.settingOptionIcon, 
                        { backgroundColor: theme === 'dark' ? '#26C6DA' : '#00ACC1' }
                      ]}>
                        <IconSymbol name="sun.haze.fill" color="#fff" size={20} />
                      </View>
                      <Text style={[styles.settingOptionText, { color: colors.text }]}>
                        İkindi
                      </Text>
                    </View>
                    <Switch
                      value={notificationSettings.asr}
                      onValueChange={() => toggleNotification('asr')}
                      trackColor={{ false: "#3e3e3e", true: colors.tint }}
                      thumbColor={notificationSettings.asr ? "#fff" : "#f4f3f4"}
                    />
                  </View>
                  
                  <View style={[
                    styles.settingOption, 
                    { borderBottomColor: colors.border, borderBottomWidth: 1 }
                  ]}>
                    <View style={styles.settingOptionInfo}>
                      <View style={[
                        styles.settingOptionIcon, 
                        { backgroundColor: theme === 'dark' ? '#FF8A65' : '#FF7043' }
                      ]}>
                        <IconSymbol name="sunset.fill" color="#fff" size={20} />
                      </View>
                      <Text style={[styles.settingOptionText, { color: colors.text }]}>
                        Akşam
                      </Text>
                    </View>
                    <Switch
                      value={notificationSettings.maghrib}
                      onValueChange={() => toggleNotification('maghrib')}
                      trackColor={{ false: "#3e3e3e", true: colors.tint }}
                      thumbColor={notificationSettings.maghrib ? "#fff" : "#f4f3f4"}
                    />
                  </View>
                  
                  <View style={styles.settingOption}>
                    <View style={styles.settingOptionInfo}>
                      <View style={[
                        styles.settingOptionIcon, 
                        { backgroundColor: theme === 'dark' ? '#7986CB' : '#5C6BC0' }
                      ]}>
                        <IconSymbol name="moon.stars.fill" color="#fff" size={20} />
                      </View>
                      <Text style={[styles.settingOptionText, { color: colors.text }]}>
                        Yatsı
                      </Text>
                    </View>
                    <Switch
                      value={notificationSettings.isha}
                      onValueChange={() => toggleNotification('isha')}
                      trackColor={{ false: "#3e3e3e", true: colors.tint }}
                      thumbColor={notificationSettings.isha ? "#fff" : "#f4f3f4"}
                    />
                  </View>
                </View>
              </View>
              
              <View style={[styles.settingSection, { marginTop: 20 }]}>
                <Text style={[styles.settingSectionTitle, { color: colors.text }]}>
                  Bildirim Zamanı
                </Text>
                
                <View style={styles.timeButtonsContainer}>
                  {[5, 10, 15, 20, 30].map((minutes) => (
                    <TouchableOpacity
                      key={minutes}
                      style={[
                        styles.timeButton,
                        {
                          backgroundColor: notificationSettings.beforePrayer === minutes
                            ? colors.tint
                            : theme === 'dark' ? colors.card : colors.background,
                          borderColor: notificationSettings.beforePrayer === minutes
                            ? colors.tint
                            : colors.border
                        }
                      ]}
                      onPress={() => updateBeforePrayerTime(minutes)}
                    >
                      <Text
                        style={[
                          styles.timeButtonText,
                          {
                            color: notificationSettings.beforePrayer === minutes
                              ? '#fff'
                              : colors.text
                          }
                        ]}
                      >
                        {minutes} dk önce
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
        
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.tint }]}
            onPress={() => animateToNextStep(OnboardingStep.WELCOME)}
          >
            <LinearGradient
              colors={colors.gradients.primary as any}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.buttonText}>Devam Et</Text>
              <IconSymbol name="chevron.right" color="#fff" size={20} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };
  
  // Karşılama sayfası
  const renderWelcome = () => (
    <Animated.View 
      style={[
        styles.stepContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateX: slideAnim }]
        }
      ]}
    >
      <LinearGradient
        colors={theme === 'dark' 
          ? colors.gradients.primary as any
          : colors.gradients.primary as any}
        style={[styles.header, { height: height * 0.4 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <View style={styles.welcomeHeaderContent}>
          <Image 
            source={require('@/assets/images/icon.png')} 
            style={styles.welcomeLogo} 
            resizeMode="contain"
          />
          <Text style={styles.welcomeAppTitle}>Ezan Vakti Pro</Text>
          <Text style={styles.welcomeSubtitle}>Namaz vakitlerini takip etmenin en kolay yolu</Text>
        </View>
      </LinearGradient>
      
      <View style={styles.welcomeContentContainer}>
        <View style={styles.welcomeFeatures}>
          <View style={styles.welcomeFeatureItem}>
            <View style={[styles.welcomeFeatureIcon, { backgroundColor: colors.tint }]}>
              <IconSymbol name="clock.fill" color="#fff" size={24} />
            </View>
            <View style={styles.welcomeFeatureText}>
              <Text style={[styles.welcomeFeatureTitle, { color: colors.text }]}>
                Doğru Namaz Vakitleri
              </Text>
              <Text style={[styles.welcomeFeatureDescription, { color: colors.textSecondary }]}>
                Bulunduğunuz konuma özel namaz vakitlerini gösterir
              </Text>
            </View>
          </View>
          
          <View style={styles.welcomeFeatureItem}>
            <View style={[styles.welcomeFeatureIcon, { backgroundColor: colors.tint }]}>
              <IconSymbol name="bell.fill" color="#fff" size={24} />
            </View>
            <View style={styles.welcomeFeatureText}>
              <Text style={[styles.welcomeFeatureTitle, { color: colors.text }]}>
                Bildirimler
              </Text>
              <Text style={[styles.welcomeFeatureDescription, { color: colors.textSecondary }]}>
                Namaz vakitlerinde zamanında bildirim alın
              </Text>
            </View>
          </View>
          
          <View style={styles.welcomeFeatureItem}>
            <View style={[styles.welcomeFeatureIcon, { backgroundColor: colors.tint }]}>
              <IconSymbol name="arrow.up.right" color="#fff" size={24} />
            </View>
            <View style={styles.welcomeFeatureText}>
              <Text style={[styles.welcomeFeatureTitle, { color: colors.text }]}>
                Kıble Yönü
              </Text>
              <Text style={[styles.welcomeFeatureDescription, { color: colors.textSecondary }]}>
                Konumunuza göre doğru kıble yönünü gösterir
              </Text>
            </View>
          </View>
          
          <View style={styles.welcomeFeatureItem}>
            <View style={[styles.welcomeFeatureIcon, { backgroundColor: colors.tint }]}>
              <IconSymbol name="book.fill" color="#fff" size={24} />
            </View>
            <View style={styles.welcomeFeatureText}>
              <Text style={[styles.welcomeFeatureTitle, { color: colors.text }]}>
                Dualar
              </Text>
              <Text style={[styles.welcomeFeatureDescription, { color: colors.textSecondary }]}>
                Günlük dualar ve sureler
              </Text>
            </View>
          </View>
        </View>
      </View>
      
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.tint }]}
          onPress={completeOnboarding}
        >
          <LinearGradient
            colors={colors.gradients.primary as any}
            style={styles.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.buttonText}>Başla</Text>
            <IconSymbol name="arrow.right.circle.fill" color="#fff" size={24} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      
      {/* Mevcut adıma göre ilgili içeriği göster */}
      {currentStep === OnboardingStep.LANGUAGE_SELECTION && renderLanguageSelection()}
      {currentStep === OnboardingStep.LOCATION_PERMISSION && renderLocationPermission()}
      {currentStep === OnboardingStep.NOTIFICATION_SETTINGS && renderNotificationSettings()}
      {currentStep === OnboardingStep.WELCOME && renderWelcome()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    width: '100%',
  },
  header: {
    width: '100%',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  languageContainer: {
    width: '100%',
    marginTop: 20,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  languageFlag: {
    fontSize: 24,
    marginRight: 16,
  },
  languageName: {
    fontSize: 18,
    fontWeight: '500',
  },
  selectedIndicator: {
    position: 'absolute',
    right: 16,
  },
  locationImageContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    position: 'relative',
  },
  locationImageBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 75,
  },
  notificationImageContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    position: 'relative',
  },
  notificationImageBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 75,
  },
  locationInfoContainer: {
    width: '100%',
    marginTop: 30,
  },
  locationInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  locationInfoIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  locationInfoText: {
    flex: 1,
  },
  locationInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  locationInfoDescription: {
    fontSize: 14,
  },
  settingsContainer: {
    width: '100%',
    marginTop: 10,
  },
  settingSection: {
    width: '100%',
  },
  settingSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  settingOptionsList: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingOptionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingOptionText: {
    fontSize: 16,
  },
  timeButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  timeButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    width: '48%',
    alignItems: 'center',
  },
  timeButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  welcomeHeaderContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeLogo: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  welcomeAppTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.9,
  },
  welcomeContentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  welcomeFeatures: {
    width: '100%',
  },
  welcomeFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeFeatureIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  welcomeFeatureText: {
    flex: 1,
  },
  welcomeFeatureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  welcomeFeatureDescription: {
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    paddingTop: 10,
    alignItems: 'center',
  },
  button: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    width: '100%',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  textButton: {
    marginTop: 16,
    padding: 8,
  },
  textButtonLabel: {
    fontSize: 16,
  },
}); 