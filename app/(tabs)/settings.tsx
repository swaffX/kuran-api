import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTheme } from '@/contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, Platform, ScrollView, StyleSheet, Switch, TextInput, TouchableOpacity, View } from 'react-native';

const MADHHAB_KEY = 'selectedMadhhab';
const LOCATION_PREFERENCE_KEY = 'locationPreference';
const MANUAL_CITY_KEY = 'manualCity';

interface Madhhab {
  label: string;
  value: string;
}

const madhhabOptions: Madhhab[] = [
  { label: 'Diyanet (Varsayılan)', value: 'diyanet' },
  { label: 'Hanefi', value: 'hanefi' },
  { label: 'Şafii', value: 'shafii' },
  // Diğer mezhepler eklenebilir
];

export default function SettingsScreen() {
  const { colors, theme, toggleTheme } = useTheme();
  const [isThemeSwitchEnabled, setIsThemeSwitchEnabled] = useState(theme === 'dark');

  const [selectedMadhhab, setSelectedMadhhab] = useState<string>(madhhabOptions[0].value);
  const [locationPreference, setLocationPreference] = useState<'auto' | 'manual' | null>(null);
  const [manualCity, setManualCity] = useState<string>('');
  const [savedCity, setSavedCity] = useState<string>('');
  const [isSavingCity, setIsSavingCity] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [currentDetectedCity, setCurrentDetectedCity] = useState<string | null>(null);

  // Ayarları Yükle
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedMadhhab = await AsyncStorage.getItem(MADHHAB_KEY);
        if (storedMadhhab) setSelectedMadhhab(storedMadhhab);
        else setSelectedMadhhab(madhhabOptions[0].value); // Eğer kayıtlı mezhep yoksa varsayılanı ata

        const storedLocationPref = await AsyncStorage.getItem(LOCATION_PREFERENCE_KEY) as 'auto' | 'manual' | null;
        if (storedLocationPref) setLocationPreference(storedLocationPref);
        else setLocationPreference('auto'); // Varsayılan konum tercihi

        const storedManualCity = await AsyncStorage.getItem(MANUAL_CITY_KEY);
        if (storedManualCity) {
            setSavedCity(storedManualCity);
            if (storedLocationPref === 'manual') setManualCity(storedManualCity); 
        }

        setIsThemeSwitchEnabled(theme === 'dark');

      } catch (e) {
        console.error('Failed to load settings.', e);
        // Hata durumunda varsayılan değerler zaten atanmış olacak
      }
    };
    loadSettings();
  }, [theme]); // Sadece tema değiştiğinde switch için yeniden çalışsın, diğerleri ilk yüklemede yeterli.

  const handleThemeChange = (value: boolean) => {
    setIsThemeSwitchEnabled(value);
    toggleTheme();
  };

  const handleMadhhabChange = async (itemValue: string) => {
    try {
      setSelectedMadhhab(itemValue);
      await AsyncStorage.setItem(MADHHAB_KEY, itemValue);
      Alert.alert("Kaydedildi", "Mezhep tercihi kaydedildi.");
    } catch (e) {
      console.error('Failed to save madhhab.', e);
      Alert.alert("Hata", "Mezhep tercihi kaydedilemedi.");
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

  const styles = StyleSheet.create({
    scrollView: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      paddingBottom: 30, // ScrollView için altta boşluk
    },
    section: {
      marginTop: 20,
      marginHorizontal: 15,
      padding: 15,
      backgroundColor: theme === 'dark' ? colors.tint + '1A' : colors.background, 
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 15,
    },
    settingItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12, // Biraz daha az padding
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border + '80',
    },
    settingItemNoBorder: {
        borderBottomWidth: 0,
    },
    settingText: {
      fontSize: 16,
      flex: 1, // Yazının tamamını göstermek için
    },
    pickerContainer: {
      backgroundColor: theme === 'dark' ? colors.tint + '10' : colors.border + '10',
      borderRadius: 8,
      marginBottom:10,
    },
    pickerStyle: {
      color: colors.text, 
      height: Platform.OS === 'ios' ? 120 : 50, // iOS'te picker'ın yüksekliği için
    },
    pickerItemStyle: {
        // iOS için picker item stilleri gerekirse
    },
    textInput: {
      flex: 1,
      height: 40,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 5,
      paddingHorizontal: 10,
      color: colors.text,
      backgroundColor: theme === 'dark' ? colors.tint+'0D' : colors.background,
      marginRight: 10,
    },
    buttonContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
      marginBottom: 5,
    },
    locationPreferenceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal:15,
        borderRadius: 8,
        borderWidth:1,
        borderColor: colors.border,
        marginRight:10,
    },
    locationActiveButton: {
        backgroundColor: colors.tint,
        borderColor: colors.tint,
    },
    locationButtonText: {
        color: colors.text,
        marginLeft: 8,
    },
    locationActiveButtonText: {
        color: colors.background, // Dinamik olarak tema arkaplan rengini alsın (tint üzerine geleceği için)
    },
    infoText: {
        fontSize: 14,
        marginTop: 5,
    }
  });

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      {/* Tema Ayarları */}
      <View style={styles.section}>
        <ThemedText type="title" style={styles.sectionTitle}>Görünüm</ThemedText>
        <View style={[styles.settingItem, styles.settingItemNoBorder]}>
          <ThemedText style={styles.settingText}>Koyu Tema</ThemedText>
          <Switch
            trackColor={{ false: colors.border, true: colors.tint }}
            thumbColor={isThemeSwitchEnabled ? colors.background : colors.icon}
            ios_backgroundColor={colors.border}
            onValueChange={handleThemeChange}
            value={isThemeSwitchEnabled}
          />
        </View>
      </View>

      {/* Konum Ayarları */}
      <View style={styles.section}>
        <ThemedText type="title" style={styles.sectionTitle}>Konum Ayarları</ThemedText>
        <ThemedText style={styles.settingText}>Konum Tercihi</ThemedText>
        <View style={styles.buttonContainer}>
            <TouchableOpacity 
                style={[styles.locationPreferenceButton, locationPreference === 'auto' && styles.locationActiveButton]}
                onPress={() => handleLocationPreferenceChange('auto')}
            >
                <IconSymbol name={locationPreference === 'auto' ? 'location.fill' : 'location'} size={18} color={locationPreference === 'auto' ? (theme === 'dark' ? '#FFFFFF' : '#FFFFFF') : colors.icon} />
                <ThemedText style={[styles.locationButtonText, locationPreference === 'auto' && styles.locationActiveButtonText]}>Otomatik Algıla</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.locationPreferenceButton, locationPreference === 'manual' && styles.locationActiveButton]}
                onPress={() => handleLocationPreferenceChange('manual')}
            >
                 <IconSymbol name={locationPreference === 'manual' ? 'pencil.circle.fill' : 'pencil.circle'} size={18} color={locationPreference === 'manual' ? (theme === 'dark' ? '#FFFFFF' : '#FFFFFF') : colors.icon} />
                <ThemedText style={[styles.locationButtonText, locationPreference === 'manual' && styles.locationActiveButtonText]}>Manuel Şehir</ThemedText>
            </TouchableOpacity>
        </View>
        {isDetectingLocation && (
            <View style={{flexDirection: 'row', alignItems: 'center', marginTop:10}}>
                <ActivityIndicator size="small" color={colors.tint} style={{marginRight:5}}/>
                <ThemedText style={{color: colors.tint}}>Konum algılanıyor...</ThemedText>
            </View>
        )}
        {currentDetectedCity && locationPreference === 'auto' && (
             <ThemedText style={styles.infoText}>Algılanan Şehir: {currentDetectedCity}</ThemedText>
        )}

        {locationPreference === 'manual' && (
          <View>
            <View style={styles.buttonContainer}>
                <TextInput
                style={styles.textInput}
                placeholder="Şehir adı girin..."
                placeholderTextColor={colors.icon}
                value={manualCity}
                onChangeText={setManualCity}
                />
                <Button title={isSavingCity ? "Kaydediliyor..." : "Kaydet"} onPress={handleSaveManualCity} color={colors.tint} disabled={isSavingCity} />
            </View>
            {savedCity && <ThemedText style={styles.infoText}>Kaydedilmiş Şehir: {savedCity}</ThemedText>}
          </View>
        )}
        <ThemedText style={styles.infoText}>Namaz vakitleri ve kıble yönü için konum bilgisi kullanılır.</ThemedText>
      </View>

      {/* Mezhep Ayarları */}
      <View style={styles.section}>
        <ThemedText type="title" style={styles.sectionTitle}>Mezhep Tercihi</ThemedText>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedMadhhab}
            onValueChange={handleMadhhabChange}
            style={styles.pickerStyle}
            dropdownIconColor={colors.icon}
          >
            {madhhabOptions.map((option) => (
              <Picker.Item key={option.value} label={option.label} value={option.value} color={colors.text} />
            ))}
          </Picker>
        </View>
        <ThemedText style={styles.infoText}>
          Seçilen mezhep, namaz vakti hesaplamalarını etkileyebilir (bu özellik ileride eklenecektir).
        </ThemedText>
      </View>
    </ScrollView>
  );
} 