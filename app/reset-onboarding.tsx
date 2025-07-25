import { ONBOARDING_COMPLETED_KEY } from '@/constants/OnboardingState';
import { useTheme } from '@/contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ResetOnboardingScreen() {
  const router = useRouter();
  const { theme, colors } = useTheme();
  const [isResetting, setIsResetting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const value = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
      setStatus(value === 'true' ? 'Onboarding tamamlanmış' : 'Onboarding tamamlanmamış');
    } catch (error) {
      setStatus('Durum kontrol edilemiyor');
      console.error(error);
    }
  };

  const resetOnboarding = async () => {
    try {
      setIsResetting(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Onboarding durumunu sıfırla
      await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY);
      
      Alert.alert(
        'Başarılı',
        'Onboarding durumu sıfırlandı. Uygulamayı yeniden başlatın.',
        [
          { 
            text: 'Tamam', 
            onPress: () => {
              router.replace('/onboarding');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Sıfırlama sırasında hata oluştu:', error);
      Alert.alert('Hata', 'Sıfırlama sırasında bir hata oluştu.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      
      <LinearGradient
        colors={theme === 'dark' ? 
          ['#1a1a2e', '#16213e'] : 
          ['#e6f2ff', '#ffffff']}
        style={styles.gradient}
      >
        <Text style={[styles.title, { color: colors.text }]}>Onboarding Sıfırlama</Text>
        
        <View style={styles.statusContainer}>
          <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Mevcut Durum:</Text>
          <Text style={[styles.statusText, { color: colors.text }]}>{status || 'Kontrol ediliyor...'}</Text>
        </View>
        
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.tint }]}
          onPress={resetOnboarding}
          disabled={isResetting}
        >
          <Text style={styles.buttonText}>
            {isResetting ? 'Sıfırlanıyor...' : 'Onboarding\'i Sıfırla'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.backButton, { borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.backButtonText, { color: colors.text }]}>Geri Dön</Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 40,
    padding: 20,
    borderRadius: 10,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  statusLabel: {
    fontSize: 16,
    marginBottom: 10,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    width: '80%',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    marginTop: 20,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 16,
  },
}); 