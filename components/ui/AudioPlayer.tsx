import { useTheme } from '@/contexts/ThemeContext';
import { Audio, AVPlaybackStatus } from 'expo-av'; // AVPlaybackStatus doğrudan import edildi
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol, IconSymbolName } from './IconSymbol';

interface AudioPlayerProps {
  audioUrl: string;
  totalDurationSeconds: number;
}

export function AudioPlayer({ audioUrl, totalDurationSeconds }: AudioPlayerProps) {
  const { colors } = useTheme();
  const soundRef = useRef<Audio.Sound | null>(null); // sound objesini ref olarak tutalım
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Yükleme durumu için state
  const [positionMillis, setPositionMillis] = useState(0);
  const totalDurationMillis = totalDurationSeconds * 1000;

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => { // AVPlaybackStatus tipi kullanıldı
    if (!status.isLoaded) {
      if (status.error) {
        console.error(`Playback Error: ${status.error}`);
        setIsPlaying(false);
        setIsBuffering(false);
        setIsLoading(false);
      }
      return;
    }

    setIsPlaying(status.isPlaying);
    setIsBuffering(status.isBuffering);
    setPositionMillis(status.positionMillis);
    setIsLoading(false); // Ses yüklendiğinde veya durumu güncellendiğinde yükleme biter

    if (status.didJustFinish) {
      setIsPlaying(false);
      soundRef.current?.setPositionAsync(0);
      setPositionMillis(0);
    }
  };

  async function loadSound() {
    if (!audioUrl) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setIsBuffering(true); // Yükleme başlarken buffering true olmalı
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync(); // Önceki sesi kaldır
        soundRef.current = null;
      }
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: false },
        onPlaybackStatusUpdate
      );
      soundRef.current = newSound;
    } catch (error) {
      console.error("Error loading sound: ", error);
      setIsLoading(false); 
    } finally {
      //setIsBuffering(false); // Buffering durumu onPlaybackStatusUpdate'ten yönetilecek
       // setIsLoading(false) zaten onPlaybackStatusUpdate or catch içinde yönetiliyor
    }
  }

  useEffect(() => {
    loadSound();
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, [audioUrl]);

  const handlePlayPause = async () => {
    if (!soundRef.current) {
      // Eğer ses hala yükleniyorsa veya yüklenemediyse bir şey yapma veya mesaj göster
      if (isLoading) return; // Hala yükleniyorsa bekle
      await loadSound(); // Yeniden yüklemeyi dene (belki ilk yükleme başarısız oldu)
      if (!soundRef.current) return; // Hala yüklenemediyse çık
    }

    if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      if (positionMillis >= totalDurationMillis && totalDurationMillis > 0 && !isBuffering) {
        await soundRef.current.replayAsync();
      } else {
        await soundRef.current.playAsync();
      }
    }
  };
  
  const formatTime = (millis: number): string => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = totalDurationMillis > 0 ? (positionMillis / totalDurationMillis) * 100 : 0;

  const styles = StyleSheet.create({
    container: {
      paddingVertical: 10,
      paddingHorizontal: 5,
      marginTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border + '80',
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    playButton: {
      padding: 8,
      marginRight: 10,
    },
    progressContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    progressBarBackground: {
      flex: 1,
      height: 8,
      backgroundColor: colors.border + '50',
      borderRadius: 4,
      marginHorizontal: 10,
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: colors.tint,
      borderRadius: 4,
    },
    timeText: {
      fontSize: 12,
      color: colors.text,
      minWidth: 40,
      textAlign: 'center',
    },
    statusText: {
        color: colors.icon,
        marginLeft: 10,
        fontSize: 12,
        textAlign: 'center',
        flex:1,
    }
  });

  if (!audioUrl) {
    return null; 
  }
  
  if (isLoading && !soundRef.current) {
      return (
          <View style={styles.container}>
              <Text style={styles.statusText}>Ses yükleniyor...</Text>
          </View>
      );
  }

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <TouchableOpacity 
          onPress={handlePlayPause} 
          disabled={isLoading || (isBuffering && !isPlaying)} 
          style={styles.playButton}
        >
          <IconSymbol name={isPlaying ? 'pause.fill' as IconSymbolName : 'play.fill' as IconSymbolName} size={28} color={colors.tint} />
        </TouchableOpacity>
        <Text style={styles.timeText}>{formatTime(positionMillis)}</Text>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.timeText}>{formatTime(totalDurationMillis)}</Text>
      </View>
      {isBuffering && !isPlaying && <Text style={styles.statusText}>Veri yükleniyor...</Text>}
    </View>
  );
} 