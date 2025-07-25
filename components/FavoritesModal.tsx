import { useTheme } from '@/contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from './ui/IconSymbol';

const FAVORITE_DAILY_PRAYERS_KEY = '@favorite_daily_prayers';
const FAVORITE_AYETS_KEY = 'favoriteAyets';
const FAVORITE_SURAHS_KEY = 'favoriteSurahs';

interface FavoritesModalProps {
  visible: boolean;
  onClose: () => void;
}

interface FavoriteItem {
  id: string;
  title: string;
  text?: string;
  type: 'prayer' | 'ayet' | 'surah';
}

export default function FavoritesModal({ visible, onClose }: FavoritesModalProps) {
  const { colors, theme } = useTheme();
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'prayers' | 'ayets' | 'surahs'>('all');

  useEffect(() => {
    if (visible) {
      loadFavorites();
    }
  }, [visible]);

  const loadFavorites = async () => {
    setLoading(true);
    try {
      // Favori dualar
      const prayers = await AsyncStorage.getItem(FAVORITE_DAILY_PRAYERS_KEY);
      const prayerIds = prayers ? JSON.parse(prayers) : [];
      
      // Favori ayetler
      const ayets = await AsyncStorage.getItem(FAVORITE_AYETS_KEY);
      const ayetIds = ayets ? JSON.parse(ayets) : [];
      
      // Favori sureler
      const surahs = await AsyncStorage.getItem(FAVORITE_SURAHS_KEY);
      const surahIds = surahs ? JSON.parse(surahs) : [];
      
      // Örnek favoriler (gerçek uygulamada bu bilgiler veritabanından alınır)
      const favoriteItems: FavoriteItem[] = [
        ...prayerIds.map((id: string) => ({
          id,
          title: `Dua #${id.slice(0, 5)}`,
          text: "Favori duanız",
          type: 'prayer'
        })),
        ...ayetIds.map((id: string) => {
          const [surahId, ayetNumber] = id.split('-');
          return {
            id,
            title: `Sure ${surahId} - Ayet ${ayetNumber}`,
            text: "Favori ayetiniz",
            type: 'ayet'
          };
        }),
        ...surahIds.map((id: string) => ({
          id,
          title: `Sure #${id}`,
          type: 'surah'
        }))
      ];
      
      setFavorites(favoriteItems);
    } catch (e) {
      console.error("Favoriler yüklenirken hata oluştu:", e);
      Alert.alert('Hata', 'Favoriler yüklenirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (item: FavoriteItem) => {
    try {
      let storageKey = '';
      let currentIds: string[] = [];
      
      switch (item.type) {
        case 'prayer':
          storageKey = FAVORITE_DAILY_PRAYERS_KEY;
          const prayers = await AsyncStorage.getItem(storageKey);
          currentIds = prayers ? JSON.parse(prayers) : [];
          break;
        case 'ayet':
          storageKey = FAVORITE_AYETS_KEY;
          const ayets = await AsyncStorage.getItem(storageKey);
          currentIds = ayets ? JSON.parse(ayets) : [];
          break;
        case 'surah':
          storageKey = FAVORITE_SURAHS_KEY;
          const surahs = await AsyncStorage.getItem(storageKey);
          currentIds = surahs ? JSON.parse(surahs) : [];
          break;
      }
      
      // ID'yi favorilerden çıkar
      const updatedIds = currentIds.filter(id => id !== item.id);
      
      // AsyncStorage'a güncellenen listeyi kaydet
      await AsyncStorage.setItem(storageKey, JSON.stringify(updatedIds));
      
      // State'i güncelle
      setFavorites(favorites.filter(fav => fav.id !== item.id));
      
      Alert.alert('Başarılı', 'Öğe favorilerden çıkarıldı.');
    } catch (e) {
      console.error("Favori kaldırılırken hata oluştu:", e);
      Alert.alert('Hata', 'Favori kaldırılırken bir sorun oluştu.');
    }
  };

  const handleItemPress = (item: FavoriteItem) => {
    switch (item.type) {
      case 'ayet':
        const [surahId, ayetNumber] = item.id.split('-');
        router.push(`/duas?surahId=${surahId}&verseNumber=${ayetNumber}`);
        onClose();
        break;
      case 'surah':
        router.push(`/duas?surahId=${item.id}`);
        onClose();
        break;
      case 'prayer':
        // Prayer item press işlemi (şimdilik sadece kapatalım)
        onClose();
        break;
    }
  };

  const renderItem = ({ item }: { item: FavoriteItem }) => (
    <TouchableOpacity 
      style={styles.listItem}
      onPress={() => handleItemPress(item)}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
        {item.text && (
          <Text style={[styles.itemText, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.text}
          </Text>
        )}
        <Text style={[styles.itemType, { color: colors.primary }]}>
          {item.type === 'prayer' ? 'Dua' : item.type === 'ayet' ? 'Ayet' : 'Sure'}
        </Text>
      </View>
      <TouchableOpacity 
        style={styles.removeButton}
        onPress={() => {
          Alert.alert(
            'Favorilerden Çıkar',
            'Bu öğeyi favorilerinizden çıkarmak istediğinize emin misiniz?',
            [
              { text: 'Vazgeç', style: 'cancel' },
              { text: 'Çıkar', onPress: () => removeFavorite(item), style: 'destructive' }
            ]
          );
        }}
      >
        <IconSymbol name="trash.fill" size={20} color={colors.error} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const filteredFavorites = favorites.filter(item => {
    if (activeTab === 'all') return true;
    if (activeTab === 'prayers') return item.type === 'prayer';
    if (activeTab === 'ayets') return item.type === 'ayet';
    if (activeTab === 'surahs') return item.type === 'surah';
    return true;
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.centeredView, { backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalView, { backgroundColor: colors.card }]}>
          <View style={styles.header}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Favorilerim</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <IconSymbol name="xmark.circle.fill" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[
                styles.tabItem, 
                activeTab === 'all' && [styles.activeTab, { backgroundColor: colors.primary }]
              ]}
              onPress={() => setActiveTab('all')}
            >
              <Text style={[
                styles.tabText, 
                { color: activeTab === 'all' ? '#fff' : colors.textSecondary }
              ]}>Tümü</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.tabItem, 
                activeTab === 'prayers' && [styles.activeTab, { backgroundColor: colors.primary }]
              ]}
              onPress={() => setActiveTab('prayers')}
            >
              <Text style={[
                styles.tabText, 
                { color: activeTab === 'prayers' ? '#fff' : colors.textSecondary }
              ]}>Dualar</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.tabItem, 
                activeTab === 'ayets' && [styles.activeTab, { backgroundColor: colors.primary }]
              ]}
              onPress={() => setActiveTab('ayets')}
            >
              <Text style={[
                styles.tabText, 
                { color: activeTab === 'ayets' ? '#fff' : colors.textSecondary }
              ]}>Ayetler</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.tabItem, 
                activeTab === 'surahs' && [styles.activeTab, { backgroundColor: colors.primary }]
              ]}
              onPress={() => setActiveTab('surahs')}
            >
              <Text style={[
                styles.tabText, 
                { color: activeTab === 'surahs' ? '#fff' : colors.textSecondary }
              ]}>Sureler</Text>
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Favoriler yükleniyor...</Text>
            </View>
          ) : filteredFavorites.length > 0 ? (
            <FlatList
              data={filteredFavorites}
              renderItem={renderItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <IconSymbol name="heart.slash" size={50} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {activeTab === 'all' 
                  ? 'Henüz favoriniz bulunmuyor.' 
                  : activeTab === 'prayers' 
                  ? 'Favori duanız bulunmuyor.' 
                  : activeTab === 'ayets' 
                  ? 'Favori ayetiniz bulunmuyor.' 
                  : 'Favori sureniz bulunmuyor.'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    borderRadius: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 5,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemText: {
    fontSize: 14,
    marginBottom: 2,
  },
  itemType: {
    fontSize: 12,
    fontWeight: '500',
  },
  removeButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
});
