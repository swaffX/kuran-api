import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTheme } from '@/contexts/ThemeContext';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';

// Kabe koordinatları
const KAABA_LATITUDE = 21.4225;
const KAABA_LONGITUDE = 39.8262;

// Dereceyi radyana çevirme
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Radyanı dereceye çevirme
function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

const { width } = Dimensions.get('window');
const COMPASS_SIZE = Math.min(width * 0.85, 320);
const NEEDLE_WIDTH = 6;
const NEEDLE_HEIGHT = COMPASS_SIZE / 2 - 20;

export default function QiblaScreen() {
  const { colors, theme } = useTheme();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const headingRef = useRef<number>(0);
  const [smoothedHeading, setSmoothedHeading] = useState<number>(0);
  const [qiblaDirection, setQiblaDirection] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [magnetometerSubscription, setMagnetometerSubscription] = useState<Location.LocationSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isQiblaAligned, setIsQiblaAligned] = useState(false);
  const animatedNeedleRotation = useRef(new Animated.Value(0)).current;
  const animatedCompassRotation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const [isCalibrating, setIsCalibrating] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const initQibla = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (isMounted) {
          setErrorMsg('Kıble yönünü belirlemek için konum izni gereklidir.');
          Alert.alert('Konum İzni Gerekli', 'Lütfen uygulama ayarlarından konuma izin verin.');
          setIsLoading(false);
        }
        return;
      }

      try {
        let currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (isMounted) {
          setLocation(currentLocation);
          calculateQiblaDirection(currentLocation.coords.latitude, currentLocation.coords.longitude);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMsg('Konum alınamadı. GPS veya ağ bağlantınızı kontrol edin.');
          console.error("Konum alma hatası:", error);
          setIsLoading(false);
        }
        return;
      }
      _subscribeToMagnetometer(isMounted);
      if(isMounted) setIsLoading(false);
    };

    initQibla();

    // Heading yumuşatma için interval
    const smoothingInterval = setInterval(() => {
      if (isMounted) {
        setSmoothedHeading(prev => prev * 0.8 + headingRef.current * 0.2);
      }
    }, 60); // Yaklaşık 16 FPS için yumuşatma

    return () => {
      isMounted = false;
      _unsubscribeFromMagnetometer();
      clearInterval(smoothingInterval);
    };
  }, []);

  // Kıble bulunduğunda nabız animasyonu
  useEffect(() => {
    if (isQiblaAligned) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      // Animasyonu durdur ve değeri sıfırla
      pulseAnimation.setValue(1);
    }
  }, [isQiblaAligned]);

  const _subscribeToMagnetometer = (isMounted: boolean) => {
    if (magnetometerSubscription) {
        magnetometerSubscription.remove();
    }
    Magnetometer.setUpdateInterval(100); // Daha sık güncelleme, yumuşatma ile dengelenecek
    const sub = Magnetometer.addListener(magnetometerData => {
      if (!isMounted) return;
      let newHeading = 0;
      const { x, y } = magnetometerData;
      if (y === 0) newHeading = x < 0 ? 180 : 0;
      else if (x === 0) newHeading = y < 0 ? 90 : 270;
      else {
        newHeading = Math.atan2(x, y) * (180 / Math.PI);
        newHeading = (newHeading + 360) % 360;
      }
      headingRef.current = newHeading;
    });
    if(isMounted) setMagnetometerSubscription(sub as any);
  };

  const _unsubscribeFromMagnetometer = () => {
    magnetometerSubscription && magnetometerSubscription.remove();
    setMagnetometerSubscription(null);
  };

  function calculateQiblaDirection(latitude: number, longitude: number) {
    const lat1 = toRadians(latitude);
    const lon1 = toRadians(longitude);
    const lat2 = toRadians(KAABA_LATITUDE);
    const lon2 = toRadians(KAABA_LONGITUDE);
    const deltaLon = lon2 - lon1;
    const y = Math.sin(deltaLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
    let brng = toDegrees(Math.atan2(y, x));
    const direction = (brng + 360) % 360; // Kuzeyden saat yönünde Kıble açısı
    setQiblaDirection(direction);
  }

  const qiblaAngleOnRotatingCompass = qiblaDirection;
  const compassRotationAngle = -smoothedHeading;

  useEffect(() => {
    const needleRelativeAngle = (qiblaDirection - smoothedHeading + 360) % 360;
    const alignmentThreshold = 5;
    if (needleRelativeAngle <= alignmentThreshold || needleRelativeAngle >= (360 - alignmentThreshold)) {
      setIsQiblaAligned(true);
    } else {
      setIsQiblaAligned(false);
    }

    // Kıble yönüne dönecek şekilde hesaplama yapıyoruz
    // Rotasyonu 180 derece çevirme eklenmiş hali ile
    const finalNeedleRotation = (qiblaDirection - smoothedHeading + 180) % 360;

    Animated.spring(animatedNeedleRotation, {
      toValue: finalNeedleRotation,
      useNativeDriver: true,
      friction: 6,
      tension: 30,
    }).start();
  }, [qiblaDirection, smoothedHeading]);

  const needleAnimatedStyle = {
    transform: [
      {
        rotate: animatedNeedleRotation.interpolate({
          inputRange: [0, 360],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  };

  const pulseAnimatedStyle = {
    transform: [
      { scale: pulseAnimation }
    ]
  };

  const startCalibration = () => {
    setIsCalibrating(true);
    Alert.alert(
      "Pusula Kalibrasyonu",
      "Telefonunuzu havada 8 şeklinde hareket ettirin.",
      [
        {
          text: "Tamam",
          onPress: () => setIsCalibrating(false)
        }
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      padding: 20,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
      padding: 20,
    },
    errorText: {
      color: '#FF5252',
      textAlign: 'center',
      marginBottom: 20,
      fontSize: 16,
    },
    errorIcon: {
      marginBottom: 20,
    },
    retryButton: {
      marginTop: 20,
      paddingVertical: 12,
      paddingHorizontal: 24,
      backgroundColor: colors.primary,
      borderRadius: 8,
    },
    retryButtonText: {
      color: '#FFF',
      fontWeight: 'bold',
      fontSize: 16,
    },
    headerContainer: {
      alignItems: 'center',
      marginBottom: 30,
    },
    titleIcon: {
      marginBottom: 10,
    },
    compassCard: {
      width: COMPASS_SIZE + 40,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      borderRadius: 20,
      backgroundColor: theme === 'dark' ? colors.card : '#FFFFFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: theme === 'dark' ? 0.3 : 0.1,
      shadowRadius: 10,
      elevation: 8,
      marginBottom: 20,
    },
    compassContainer: {
      width: COMPASS_SIZE,
      height: COMPASS_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    compassOuterRing: {
      width: COMPASS_SIZE,
      height: COMPASS_SIZE,
      borderRadius: COMPASS_SIZE / 2,
      borderWidth: 3,
      borderColor: theme === 'dark' ? colors.border + '80' : '#E0E0E0',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'absolute',
    },
    compassBackground: {
      width: COMPASS_SIZE - 16,
      height: COMPASS_SIZE - 16,
      borderRadius: (COMPASS_SIZE - 16) / 2,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme === 'dark' ? '#2C2C2E' : '#F5F5F7',
      overflow: 'hidden',
    },
    compassInnerCircle: {
      width: COMPASS_SIZE - 80,
      height: COMPASS_SIZE - 80,
      borderRadius: (COMPASS_SIZE - 80) / 2,
      borderWidth: 1,
      borderColor: colors.border + '40',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'absolute',
    },
    compassCenter: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme === 'dark' ? '#3A3A3C' : '#EAEAEB',
      borderWidth: 1,
      borderColor: colors.border + '30',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'absolute',
    },
    kaabaIndicator: {
      position: 'absolute',
      width: 30,
      height: 30,
      justifyContent: 'center',
      alignItems: 'center',
    },
    needleContainer: {
      position: 'absolute',
      zIndex: 10,
      width: 2,
      height: COMPASS_SIZE/2,
      justifyContent: 'flex-start',
      alignItems: 'center',
    },
    needleBody: {
      width: NEEDLE_WIDTH,
      height: 120,
      backgroundColor: isQiblaAligned ? colors.tint : '#FF5252',
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: 4,
      borderBottomRightRadius: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 3,
    },
    pivot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme === 'dark' ? '#E0E0E0' : '#333333',
      position: 'absolute',
      borderWidth: 2,
      borderColor: theme === 'dark' ? '#2C2C2E' : '#F2F2F7',
      zIndex: 15,
    },
    directionText: {
      position: 'absolute',
      fontWeight: 'bold',
      fontSize: 18,
      color: colors.text,
    },
    qiblaInfoContainer: {
      width: COMPASS_SIZE + 40,
      backgroundColor: theme === 'dark' ? colors.card : '#FFFFFF',
      borderRadius: 16,
      padding: 15,
      marginBottom: 15,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: theme === 'dark' ? 0.2 : 0.05,
      shadowRadius: 6,
      elevation: 4,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    infoIcon: {
      marginRight: 10,
    },
    infoText: {
      fontSize: 15,
      color: colors.text,
      flex: 1,
    },
    highlightedText: {
      fontWeight: 'bold',
      color: isQiblaAligned ? colors.tint : colors.text,
    },
    alignmentText: {
      fontSize: 18,
      fontWeight: 'bold',
      textAlign: 'center',
      color: isQiblaAligned ? colors.tint : colors.textSecondary,
      marginTop: 10,
      marginBottom: 5,
    },
    calibrateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme === 'dark' ? colors.card : '#F0F0F5',
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginTop: 10,
    },
    calibrateButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.primary,
      marginLeft: 6,
    },
    locationText: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 5,
    },
    tips: {
      backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.03)',
      borderRadius: 12,
      padding: 12,
      marginTop: 10,
    },
    tipText: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    alignedIndicator: {
      position: 'absolute',
      top: -60,
      alignSelf: 'center',
    }
  });

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText style={{marginTop: 10, fontSize: 16}}>Konum ve yön bilgisi alınıyor...</ThemedText>
        <ThemedText style={{marginTop: 5, fontSize: 13, color: colors.textSecondary}}>Bu işlem bir kaç saniye sürebilir</ThemedText>
      </ThemedView>
    );
  }

  if (errorMsg) {
    return (
      <ThemedView style={styles.errorContainer}>
        <IconSymbol name="xmark.circle.fill" size={50} color="#FF5252" style={styles.errorIcon} />
        <ThemedText style={styles.errorText}>{errorMsg}</ThemedText>
        <TouchableOpacity style={styles.retryButton} onPress={() => window.location.reload()}>
          <ThemedText style={styles.retryButtonText}>Tekrar Dene</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  const needleAngleDisplay = Math.round((qiblaDirection - smoothedHeading + 360) % 360);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.headerContainer}>
        <IconSymbol name="location.north.fill" size={32} color={colors.primary} style={styles.titleIcon} />
        <ThemedText type="title" style={{ fontSize: 24, fontWeight: 'bold' }}>Kıble Yönü</ThemedText>
      </View>
      
      <View style={styles.compassCard}>
        <View style={styles.compassContainer}>
          <View style={styles.compassOuterRing}/>
          <View style={styles.compassBackground}>
            <ThemedText style={[styles.directionText, {top: 10, transform: [{ rotate: '0deg'}] }]}>K</ThemedText>
            <ThemedText style={[styles.directionText, {bottom: 10, transform: [{ rotate: '180deg'}] }]}>G</ThemedText>
            <ThemedText style={[styles.directionText, {left: 10, top: '48%', transform: [{ rotate: '270deg'}] }]}>B</ThemedText>
            <ThemedText style={[styles.directionText, {right: 10, top: '48%', transform: [{ rotate: '90deg'}] }]}>D</ThemedText>
            
            <View style={styles.compassInnerCircle} />
            
            {isQiblaAligned && (
              <Animated.View style={[styles.alignedIndicator, pulseAnimatedStyle]}>
                <IconSymbol name="checkmark.circle.fill" size={50} color={colors.tint} />
              </Animated.View>
            )}
          </View>
          
          <Animated.View 
            style={[
              styles.needleContainer, 
              needleAnimatedStyle
            ]}
          >
            <View style={styles.needleBody} />
          </Animated.View>
          
          <View style={styles.pivot} />
        </View>
      </View>

      <View style={styles.qiblaInfoContainer}>
        <ThemedText style={styles.alignmentText}>
          {isQiblaAligned 
            ? '🕋 Kıble Yönü Bulundu!' 
            : 'Kıble Yönünü Bulmak İçin Telefonu Çevirin'}
        </ThemedText>

        <View style={styles.infoRow}>
          <IconSymbol name="location.north.fill" size={20} color={colors.tint} style={styles.infoIcon} />
          <ThemedText style={styles.infoText}>
            Kıble Açısı: <ThemedText style={styles.highlightedText}>{Math.round(qiblaDirection)}°</ThemedText>
          </ThemedText>
        </View>

        <View style={styles.infoRow}>
          <IconSymbol name="arrow.triangle.2.circlepath" size={20} color={colors.icon} style={styles.infoIcon} />
          <ThemedText style={styles.infoText}>
            Mevcut Yön: {Math.round(smoothedHeading)}°
          </ThemedText>
        </View>

        <TouchableOpacity style={styles.calibrateButton} onPress={startCalibration}>
          <IconSymbol name="arrow.triangle.2.circlepath" size={18} color={colors.primary} />
          <ThemedText style={styles.calibrateButtonText}>Pusulayı Kalibre Et</ThemedText>
        </TouchableOpacity>

        {location && (
          <ThemedText style={styles.locationText}>
            Konum: {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
          </ThemedText>
        )}
      </View>

      <View style={styles.tips}>
        <ThemedText style={styles.tipText}>
          📱 Pusulayı kalibre etmek için telefonunuzu 8 figürü şeklinde hareket ettirin.
        </ThemedText>
        <ThemedText style={styles.tipText}>
          ⚠️ Metal nesnelerden ve elektronik cihazlardan uzak tutun.
        </ThemedText>
      </View>
    </ThemedView>
  );
} 