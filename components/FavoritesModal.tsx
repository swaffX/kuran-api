import { useTheme } from '@/contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from './ui/IconSymbol';

// Gerçek uygulamanızda bu arayüzler ve veriler merkezi bir yerden gelmeli
// (örn: types.ts, data/prayers.ts, data/surahs.ts)
export interface DailyPrayer {
  id: string;
  title: string;
  arabic?: string;
  meaning: string;
  source?: string;
  // index.tsx'deki 'prayer' alanı yerine 'meaning' ve 'arabic' kullanıyoruz
}

export interface SurahInfo {
  id: string;
  name: string;
  totalAyets?: number;
  meaningSummary?: string;
  revelationType?: 'Mekki' | 'Medeni';
  audioUrl?: string; 
  // duas.tsx'deki SurahInfo ile senkronize olmalı
}

interface FavoritesModalProps {
  visible: boolean;
  onClose: () => void;
  // İdealde, tüm dualar ve sureler buraya prop olarak gelmeli
  // allDailyPrayers: DailyPrayer[];
  // allSurahInfos: SurahInfo[];
}

const FAVORITE_DAILY_PRAYERS_KEY = '@favorite_daily_prayers';
const FAVORITE_SURAHS_KEY = 'favoriteSurahs';

// Bu listelerin FavoritesModal dışında, örneğin bir data context'inde veya ana App component'inde yüklenip
// FavoritesModal'a prop olarak geçilmesi daha iyi bir mimari olurdu.
// Şimdilik, modal içinde import etmeye çalışacağız veya dummy data kullanacağız.
let importedDailyPrayers: DailyPrayer[] = [];
let importedSurahInfos: SurahInfo[] = [];

try {
  const dailyPrayersJson = require('../assets/data/daily_prayers.json');
  if (dailyPrayersJson && Array.isArray(dailyPrayersJson)) {
    importedDailyPrayers = dailyPrayersJson.map((item: any, index: number) => ({
      id: item.id,
      title: item.title || 'Dua Başlığı Yok',
      arabic: item.arabic,
      meaning: item.meaning || item.prayer || 'Anlam bulunamadı.',
      source: item.source,
    }));
  }
} catch (e) {
  console.warn('FavoritesModal: ../assets/data/daily_prayers.json yüklenemedi.', e);
  // Fallback dummy data
  importedDailyPrayers = [
    { id: 'dummy_dp1', title: 'Örnek Favori Dua 1', meaning: 'Bu bir örnek favori dua metnidir.' },
  ];
}

try {
  // surahInfos normalde duas.tsx içinde statik olarak tanımlı.
  // Onları da bir JSON dosyasına veya .ts dosyasına taşıyıp buradan import etmek ideal olurdu.
  // Şimdilik duas.tsx'teki yapıyı taklit eden dummy data ekleyelim.
  // VEYA, surahInfos'u bir şekilde prop olarak almayı deneyebiliriz.
  // Bu örnekte, duas.tsx'ten kopyalanmış gibi dummy bir data kullanalım.
  const surahInfosJson = require('../assets/data/surahInfos.json'); // surahInfos.json diye bir dosya olduğunu varsayalım
   if (surahInfosJson && Array.isArray(surahInfosJson)) {
    importedSurahInfos = surahInfosJson.map((item: any, index: number) => ({
        id: item.id,
        name: item.name || 'Sure Adı Yok',
        totalAyets: item.totalAyets,
        meaningSummary: item.meaningSummary || 'Sure özeti bulunamadı.',
        revelationType: item.revelationType,
        audioUrl: item.audioUrl
    }));
   }
} catch (e) {
  console.warn('FavoritesModal: ../assets/data/surahInfos.json yüklenemedi veya dummy data kullanılıyor.', e);
  importedSurahInfos = [
    { id: 'dummy_s1', name: 'Örnek Favori Fatiha', meaningSummary: 'Bu Fatiha suresinin örnek özetidir.' },
    { id: 'dummy_s2', name: 'Örnek Favori İhlas', meaningSummary: 'Bu İhlas suresinin örnek özetidir.' },
  ];
}


const FavoritesModal: React.FC<FavoritesModalProps> = ({ visible, onClose }) => {
  const { colors, theme } = useTheme();
  const [favoritePrayers, setFavoritePrayers] = useState<DailyPrayer[]>([]);
  const [favoriteSurahs, setFavoriteSurahs] = useState<SurahInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'prayers' | 'surahs'>('prayers');

  const copyToClipboard = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Kopyalandı', 'Metin panoya kopyalandı.');
    } catch (e) {
      Alert.alert('Hata', 'Metin kopyalanamadı.');
    }
  };

  const shareContent = async (text: string, title?: string) => {
    try {
      await Share.share({
        message: text,
        title: title,
      });
    } catch (error: any) {
      Alert.alert('Hata', error.message);
    }
  };

  const loadFavorites = useCallback(async () => {
    if (!visible) return;
    setIsLoading(true);
    try {
      const dailyPrayersJson = await AsyncStorage.getItem(FAVORITE_DAILY_PRAYERS_KEY);
      const favoriteDailyPrayerIds: string[] = dailyPrayersJson ? JSON.parse(dailyPrayersJson) : [];
      const filteredPrayers = importedDailyPrayers.filter(p => favoriteDailyPrayerIds.includes(p.id));
      setFavoritePrayers(filteredPrayers);

      const surahsJson = await AsyncStorage.getItem(FAVORITE_SURAHS_KEY);
      const favoriteSurahIds: string[] = surahsJson ? JSON.parse(surahsJson) : [];
      const filteredSurahs = importedSurahInfos.filter(s => favoriteSurahIds.includes(s.id));
      setFavoriteSurahs(filteredSurahs);

    } catch (error) {
      console.error('Favoriler yüklenirken hata oluştu:', error);
    } finally {
      setIsLoading(false);
    }
  }, [visible]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const removeFromFavorites = async (id: string, type: 'prayer' | 'surah') => {
    const itemType = type === 'prayer' ? 'Dua' : 'Sure';
    const originalPrayers = [...favoritePrayers];
    const originalSurahs = [...favoriteSurahs];

    // Öğeyi geçici olarak UI'dan kaldır
    if (type === 'prayer') {
      setFavoritePrayers(prev => prev.filter(p => p.id !== id));
    } else {
      setFavoriteSurahs(prev => prev.filter(s => s.id !== id));
    }

    Alert.alert(
      `${itemType} Favorilerden Çıkarıldı`,
      `Geri almak ister misiniz?`,
      [
        {
          text: 'Geri Al',
          onPress: () => {
            // UI'ı orijinal durumuna döndür
            if (type === 'prayer') {
              setFavoritePrayers(originalPrayers);
            } else {
              setFavoriteSurahs(originalSurahs);
            }
            // AsyncStorage'a dokunma
          },
          style: 'cancel',
        },
        {
          text: 'Tamam', 
          onPress: async () => {
            // AsyncStorage'dan kalıcı olarak sil
            try {
              if (type === 'prayer') {
                const currentFavorites = await AsyncStorage.getItem(FAVORITE_DAILY_PRAYERS_KEY);
                const favoriteIds: string[] = currentFavorites ? JSON.parse(currentFavorites) : [];
                const updatedPrayerIds = favoriteIds.filter(favId => favId !== id);
                await AsyncStorage.setItem(FAVORITE_DAILY_PRAYERS_KEY, JSON.stringify(updatedPrayerIds));
              } else if (type === 'surah') {
                const currentFavorites = await AsyncStorage.getItem(FAVORITE_SURAHS_KEY);
                const favoriteIds: string[] = currentFavorites ? JSON.parse(currentFavorites) : [];
                const updatedSurahIds = favoriteIds.filter(favId => favId !== id);
                await AsyncStorage.setItem(FAVORITE_SURAHS_KEY, JSON.stringify(updatedSurahIds));
              }
            } catch (error) {
              console.error('Favorilerden kalıcı olarak kaldırırken hata:', error);
              // Hata durumunda UI'ı geri yükleyebiliriz (opsiyonel)
              if (type === 'prayer') setFavoritePrayers(originalPrayers);
              else setFavoriteSurahs(originalSurahs);
              Alert.alert('Hata', 'Favori kaldırılırken bir sorun oluştu.');
            }
          },
        },
      ],
      { cancelable: false } // Kullanıcının alert dışına tıklayarak kapatmasını engelle
    );
  };

  const renderPrayerItem = ({ item }: { item: DailyPrayer }) => {
    const prayerFullText = `${item.title}\n${item.arabic ? item.arabic + '\n' : ''}${item.meaning}${item.source ? '\nKaynak: ' + item.source : ''}`;
    return (
      <View style={[styles.itemContainer, { backgroundColor: theme === 'dark' ? colors.card : '#F8F9FA' }]}>
        <View style={styles.itemContent}>
          <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
          {item.arabic && <Text style={[styles.itemArabicText, { color: colors.textSecondary }]}>{item.arabic}</Text>}
          <Text style={[styles.itemText, { color: colors.textSecondary }]}>{item.meaning}</Text>
          {item.source && <Text style={[styles.itemSourceText, { color: colors.textSecondary }]}>Kaynak: {item.source}</Text>}
        </View>
        <View style={styles.itemActionsContainer}>
          <TouchableOpacity onPress={() => copyToClipboard(prayerFullText)} style={styles.actionButton}>
            <IconSymbol name="doc.on.doc.fill" size={22} color={colors.iconAction} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => shareContent(prayerFullText, item.title)} style={styles.actionButton}>
            <IconSymbol name="square.and.arrow.up.fill" size={22} color={colors.iconAction} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => removeFromFavorites(item.id, 'prayer')} 
            style={[styles.actionButton, styles.removeButton]}
          >
            <IconSymbol name="trash.fill" size={22} color={theme === 'dark' ? '#ff6b6b' : '#d63031'} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSurahItem = ({ item }: { item: SurahInfo }) => {
    const surahFullText = `${item.name}\n${item.meaningSummary || ''}`;
    return (
      <View style={[styles.itemContainer, { backgroundColor: theme === 'dark' ? colors.card : '#F8F9FA' }]}>
        <View style={styles.itemContent}>
          <Text style={[styles.itemTitle, { color: colors.text }]}>{item.name}</Text>
          {item.meaningSummary && <Text style={[styles.itemText, { color: colors.textSecondary }]}>{item.meaningSummary.substring(0,120)}...</Text>}
        </View>
        <View style={styles.itemActionsContainer}>
          <TouchableOpacity onPress={() => copyToClipboard(surahFullText)} style={styles.actionButton}>
            <IconSymbol name="doc.on.doc.fill" size={22} color={colors.iconAction} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => shareContent(surahFullText, item.name)} style={styles.actionButton}>
            <IconSymbol name="square.and.arrow.up.fill" size={22} color={colors.iconAction} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => removeFromFavorites(item.id, 'surah')} 
            style={[styles.actionButton, styles.removeButton]}
          >
            <IconSymbol name="trash.fill" size={22} color={theme === 'dark' ? '#ff6b6b' : '#d63031'} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 25,
      borderTopRightRadius: 25,
      paddingHorizontal: 5,
      paddingTop: 15,
      paddingBottom: 25,
      maxHeight: '85%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: 0.27,
      shadowRadius: 4.65,
      elevation: 6,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme === 'dark' ? colors.border : '#E8E8E8',
      marginBottom: 15,
      paddingHorizontal: 20,
    },
    title: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.primary,
    },
    tabContainer: {
      flexDirection: 'row',
      marginHorizontal: 15,
      marginVertical: 10,
      borderRadius: 12,
      backgroundColor: theme === 'dark' ? colors.card : '#f0f0f0',
      padding: 4,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 10,
    },
    activeTab: {
      backgroundColor: theme === 'dark' ? colors.tint + '30' : colors.tint + '15',
    },
    tabText: {
      fontWeight: '500',
      fontSize: 15,
      color: colors.textSecondary,
    },
    activeTabText: {
      color: colors.tint,
      fontWeight: '600',
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginTop: 15,
      marginBottom: 10,
      paddingHorizontal: 20,
    },
    itemContainer: {
      borderRadius: 12,
      paddingVertical: 15,
      paddingHorizontal: 18,
      marginVertical: 6,
      marginHorizontal: 15, 
      flexDirection: 'column',
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: theme === 'dark' ? 0.3 : 0.1,
      shadowRadius: 3,
      elevation: 4,
      borderWidth: theme === 'dark' ? 1 : 0,
      borderColor: theme === 'dark' ? colors.border + '50' : 'transparent',
    },
    itemContent: {
      marginBottom: 12,
    },
    itemTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 6,
    },
    itemArabicText: {
      fontSize: 16,
      writingDirection: 'rtl',
      textAlign: 'right',
      marginBottom: 6,
      fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif',
      lineHeight: 24,
    },
    itemText: {
      fontSize: 14,
      lineHeight: 20,
    },
    itemSourceText: {
      fontSize: 12,
      fontStyle: 'italic',
      marginTop: 6,
    },
    itemActionsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme === 'dark' ? colors.borderMuted + '80' : '#f0f0f0',
      marginTop: 5,
    },
    actionButton: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      marginHorizontal: 5,
    },
    removeButton: {
      backgroundColor: theme === 'dark' ? 'rgba(255, 107, 107, 0.1)' : 'rgba(255, 107, 107, 0.05)',
      borderRadius: 8,
    },
    emptyText: {
      textAlign: 'center',
      fontSize: 15,
      color: colors.textSecondary,
      marginTop: 30,
      marginBottom: 20,
      paddingHorizontal: 15,
    },
    loadingContainer: {
      flex: 1,
      height: 200,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeButton: {
      padding: 8,
      backgroundColor: theme === 'dark' ? colors.card : '#f0f0f0',
      borderRadius: 20,
    }
  });

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPressOut={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.modalContent} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>Favorilerim</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.icon} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'prayers' && styles.activeTab]} 
              onPress={() => setActiveTab('prayers')}
            >
              <Text style={[styles.tabText, activeTab === 'prayers' && styles.activeTabText]}>Dualar</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'surahs' && styles.activeTab]}
              onPress={() => setActiveTab('surahs')}
            >
              <Text style={[styles.tabText, activeTab === 'surahs' && styles.activeTabText]}>Sureler</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary}/>
              <Text style={{color: colors.text, marginTop: 10}}>Favoriler yükleniyor...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {activeTab === 'prayers' ? (
                <>
                  {favoritePrayers.length > 0 ? (
                    <FlatList
                      data={favoritePrayers}
                      renderItem={renderPrayerItem}
                      keyExtractor={(item) => `prayer-${item.id}`}
                      scrollEnabled={false}
                    />
                  ) : (
                    <Text style={styles.emptyText}>Henüz favorilerinize eklenmiş bir dua bulunmuyor.</Text>
                  )}
                </>
              ) : (
                <>
                  {favoriteSurahs.length > 0 ? (
                    <FlatList
                      data={favoriteSurahs}
                      renderItem={renderSurahItem}
                      keyExtractor={(item) => `surah-${item.id}`}
                      scrollEnabled={false}
                    />
                  ) : (
                    <Text style={styles.emptyText}>Henüz favorilerinize eklenmiş bir sure bulunmuyor.</Text>
                  )}
                </>
              )}
              <View style={{ height: 20 }} />
            </ScrollView>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

export default FavoritesModal; 