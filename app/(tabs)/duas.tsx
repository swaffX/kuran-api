import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTheme } from '@/contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    I18nManager // Arapça metin yönü için
    ,







    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

// Yeni Ayet Arayüzü
interface Ayet {
  id: string; // Örn: "1-1" (Fatiha Suresi - 1. Ayet)
  surahId: string; 
  surahName: string; 
  ayetNumber: number; 
  arabicText: string; 
  transliteration: string; // Latin harfleriyle Arapça okunuşu
  turkishMeaning: string; 
  audioUrl?: string; // Ayet bazlı ses dosyası URL'si
}

// Sureler için genel bilgi (Ses çalmak için kullanılabilir)
interface SurahInfo {
  id: string;
  name: string;
  audioUrl?: string;
  durationSeconds?: number;
  totalAyets: number; // Suredeki toplam ayet sayısı (ileride kullanılabilir)
  meaningSummary: string; // Diyanet'teki gibi genel anlamı
  isFavorite?: boolean;
  revelationType: 'Mekki' | 'Medeni';
  virtue?: string;
}

// Örnek Sure Bilgileri (Kullanıcı tüm sureleri eklemeli)
const surahInfos: SurahInfo[] = [
  {
    id: '1',
    name: 'Fatiha Suresi',
    totalAyets: 7,
    meaningSummary: `Mekke döneminde inmiştir. Yedi âyettir. Kur'an-ı Kerim'in ilk sûresi olduğu için "başlangıç" anlamına "Fâtiha" adını almıştır. Sûrenin ayrıca, "Ümmü'1-Kitab" (Kitab'ın özü) "es-Seb'ul-Mesânî" (Tekrarlanan yedi âyet) , "el-Esâs", "el-Vâfiye", "el-Kâfiye", "el-Kenz", "eş-Şifâ", "eş-Şükr" ve "es-Salât" gibi başka adları da vardır. Kur'an'ın içerdiği esaslar öz olarak Fâtiha'da vardır. Zira övgü ve yüceltilmeye lâyık bir tek Allah'ın varlığı, onun hâkimiyeti, tek mabut oluşu, kulluğun ancak O'na yapılıp O'ndan yardım isteneceği, bu sûrede özlü bir şekilde ifade edilir. Fâtiha sûresi, aynı zamanda baştan başa eşsiz güzellikte bir dua, bir yakarıştır.`,
    revelationType: 'Mekki',
    virtue: 'Hz. Peygamber (s.a.s.), "Fâtiha\'yı okumayanın namazı yoktur (kâmil namazı olmaz)" buyurmuştur. (Buhârî, Ezân, 95)'
  },
  {
    id: '112',
    name: 'İhlas Suresi',
    totalAyets: 4,
    meaningSummary: `Mekke döneminde inmiştir. Dört âyettir. İhlâs, samimi olmak, dine içtenlikle bağlanmak demektir. Allah'a bu sûrede anlatıldığı şekilde iman etmek, imanda ihlâsa ulaşmak düşüncesiyle sûreye İhlâs adı verilmiştir. "Kul hüvellahü ehad" diye başladığı için "Ehad sûresi" olarak da anılır.`,
    revelationType: 'Mekki',
    virtue: 'Hz. Peygamber (s.a.s.), İhlas suresinin Kur\'an\'ın üçte birine denk geldiğini bildirmiştir. (Buhârî, Ezân, 106)'
  },
  // Diğer surelerin bilgileri buraya eklenecek (İhlas, Felak, Nas vb.)
];

// Örnek Ayet Verileri (Kullanıcı tüm ayetleri ve sureleri eklemeli)
const ayetlerListesi: Ayet[] = [
  // Fatiha Suresi
  {
    id: '1-1', surahId: '1', surahName: 'Fatiha Suresi', ayetNumber: 1,
    arabicText: 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ',
    transliteration: `Bismillâhirrahmânirrahîm`,
    turkishMeaning: `Rahmân ve Rahîm olan Allah'ın adıyla.`,
    audioUrl: 'https://www.quranicaudio.com/media/ShreeCom/Aafasy/001_001.mp3'
  },
  {
    id: '1-2', surahId: '1', surahName: 'Fatiha Suresi', ayetNumber: 2,
    arabicText: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
    transliteration: `Elhamdulillâhi rabbil'alemin`,
    turkishMeaning: `Hamd, Âlemlerin Rabbi Allah'a mahsustur.`,
    audioUrl: 'https://www.quranicaudio.com/media/ShreeCom/Aafasy/001_002.mp3'
  },
  {
    id: '1-3', surahId: '1', surahName: 'Fatiha Suresi', ayetNumber: 3,
    arabicText: 'الرَّحْمَنِ الرَّحِيمِ',
    transliteration: `Errahmânir'rahim`,
    turkishMeaning: `O, Rahmân ve Rahîm'dir.`,
    audioUrl: 'https://www.quranicaudio.com/media/ShreeCom/Aafasy/001_003.mp3'
  },
  {
    id: '1-4', surahId: '1', surahName: 'Fatiha Suresi', ayetNumber: 4,
    arabicText: 'مَالِكِ يَوْمِ الدِّينِ',
    transliteration: `Mâliki yevmiddin`,
    turkishMeaning: `Din gününün, hesap gününün sahibidir.`,
    audioUrl: 'https://www.quranicaudio.com/media/ShreeCom/Aafasy/001_004.mp3'
  },
  {
    id: '1-5', surahId: '1', surahName: 'Fatiha Suresi', ayetNumber: 5,
    arabicText: 'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
    transliteration: `İyyâke na'budu ve iyyâke neste'în`,
    turkishMeaning: `(Allahım!) Ancak sana kulluk ederiz ve yalnız senden yardım dileriz.`,
    audioUrl: 'https://www.quranicaudio.com/media/ShreeCom/Aafasy/001_005.mp3'
  },
  {
    id: '1-6', surahId: '1', surahName: 'Fatiha Suresi', ayetNumber: 6,
    arabicText: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ',
    transliteration: `İhdinassarâtel mustakîm`,
    turkishMeaning: `Bizi doğru yola ilet.`,
    audioUrl: 'https://www.quranicaudio.com/media/ShreeCom/Aafasy/001_006.mp3'
  },
  {
    id: '1-7', surahId: '1', surahName: 'Fatiha Suresi', ayetNumber: 7,
    arabicText: 'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ',
    transliteration: `Sırâtallezîne en'amte aleyhim gayrilmağdûbi aleyhim veleddâllîn`,
    turkishMeaning: `Kendilerine nimet verdiklerinin yoluna; gazaba uğrayanların ve sapıkların yoluna değil.`,
    audioUrl: 'https://www.quranicaudio.com/media/ShreeCom/Aafasy/001_007.mp3'
  },
  // İhlas Suresi
  {
    id: '112-1', surahId: '112', surahName: 'İhlas Suresi', ayetNumber: 1,
    arabicText: 'قُلْ هُوَ اللَّهُ أَحَدٌ',
    transliteration: `Kul huvallâhu ehad`,
    turkishMeaning: `De ki: O Allah birdir.`,
    audioUrl: 'https://www.quranicaudio.com/media/ShreeCom/Aafasy/112_001.mp3'
  },
  {
    id: '112-2', surahId: '112', surahName: 'İhlas Suresi', ayetNumber: 2,
    arabicText: 'اللَّهُ الصَّمَدُ',
    transliteration: `Allâhus samed`,
    turkishMeaning: `Allah Samed'dir (Her şey O'na muhtaçtır, O kimseye muhtaç değildir).`,
    audioUrl: 'https://www.quranicaudio.com/media/ShreeCom/Aafasy/112_002.mp3'
  },
  {
    id: '112-3', surahId: '112', surahName: 'İhlas Suresi', ayetNumber: 3,
    arabicText: 'لَمْ يَلِدْ وَلَمْ يُولَدْ',
    transliteration: `Lem yelid ve lem yûled`,
    turkishMeaning: `O doğurmamıştır ve doğurulmamıştır.`,
    audioUrl: 'https://www.quranicaudio.com/media/ShreeCom/Aafasy/112_003.mp3'
  },
  {
    id: '112-4', surahId: '112', surahName: 'İhlas Suresi', ayetNumber: 4,
    arabicText: 'وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ',
    transliteration: `Ve lem yekun lehû kufuven ehad`,
    turkishMeaning: `Ve hiçbir şey O'na denk değildir.`,
    audioUrl: 'https://www.quranicaudio.com/media/ShreeCom/Aafasy/112_004.mp3'
  },
  // Diğer sureler... 
];

export default function DuasScreen() {
  const { colors, theme } = useTheme();
  const [searchText, setSearchText] = useState('');
  const [selectedSurahName, setSelectedSurahName] = useState<string | null>(
    surahInfos[0]?.name || null
  );
  const [favoriteSurahIds, setFavoriteSurahIds] = useState<string[]>([]);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState<boolean>(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedSurahForModal, setSelectedSurahForModal] = useState<SurahInfo | null>(null);
  const [ayetsForModal, setAyetsForModal] = useState<Ayet[]>([]);
  const [displayedAyets, setDisplayedAyets] = useState<Ayet[]>([]);

  // Favori sureleri yükle
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const storedFavorites = await AsyncStorage.getItem('favoriteSurahs');
        if (storedFavorites !== null) {
          setFavoriteSurahIds(JSON.parse(storedFavorites));
        }
      } catch (e) {
        console.error('Failed to load favorite surahs.', e);
      }
    };
    loadFavorites();
  }, []);

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  const getAyetsForSurah = useCallback((surahId: string) => {
    if (!surahId) return [];
    return ayetlerListesi.filter(ayet => ayet.surahId === surahId);
  }, []); 

  useEffect(() => {
    let surahIdToLoad: string | undefined = undefined;
    const currentSelection = surahInfos.find(s => s.name === selectedSurahName);
    if (currentSelection) {
      surahIdToLoad = currentSelection.id;
    } else if (surahInfos.length > 0 && surahInfos[0]) {
      surahIdToLoad = surahInfos[0].id;
      setSelectedSurahName(surahInfos[0].name); 
    }

    if (surahIdToLoad) {
      setDisplayedAyets(getAyetsForSurah(surahIdToLoad));
    } else {
      setDisplayedAyets([]); 
    }
  }, [selectedSurahName, surahInfos, getAyetsForSurah]);

  // Hem ayet hem de tam sure için ses çalma fonksiyonu
  const playAudio = async (url: string, id: string) => {
    if (!url) {
      Alert.alert("Ses Dosyası Yok", "Bu içerik için ses dosyası bulunamadı.");
      return;
    }

    if (soundRef.current && activePlayingId === id) {
      const status = await soundRef.current.getStatusAsync() as AVPlaybackStatus;
      if (status.isLoaded) {
        if (status.isPlaying) {
          await soundRef.current.pauseAsync();
          setIsAudioPlaying(false);
        } else {
          await soundRef.current.playAsync();
          setIsAudioPlaying(true);
        }
      }
      return;
    }

    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    
    try {
      setIsAudioLoading(true);
      setActivePlayingId(id);
      setIsAudioPlaying(false);

      const soundObject = new Audio.Sound();
      soundRef.current = soundObject;

      soundObject.setOnPlaybackStatusUpdate((playbackStatus: AVPlaybackStatus) => {
        if (!playbackStatus.isLoaded) {
          if (playbackStatus.error) {
            console.error(`Playback Error: ${playbackStatus.error}`);
            Alert.alert("Hata", "Ses dosyası oynatılırken bir sorun oluştu.");
            setIsAudioPlaying(false);
            setIsAudioLoading(false);
            setActivePlayingId(null);
            if(soundRef.current){
              soundRef.current.unloadAsync();
              soundRef.current = null;
            }
          }
        } else {
          setIsAudioLoading(false);
          setIsAudioPlaying(playbackStatus.isPlaying);
          if (playbackStatus.didJustFinish && !playbackStatus.isLooping) {
            setActivePlayingId(null);
            setIsAudioPlaying(false);
            if(soundRef.current){
                soundRef.current.unloadAsync();
                soundRef.current = null;
            }
          }
        }
      });
      
      await soundObject.loadAsync({ uri: url }, { shouldPlay: true });
      const initialStatus = await soundObject.getStatusAsync() as AVPlaybackStatus;
      if (initialStatus.isLoaded) {
        setIsAudioPlaying(initialStatus.isPlaying);
      }

    } catch (error) {
      console.error("Ses çalma hatası:", error);
      Alert.alert("Hata", "Ses dosyası yüklenirken veya oynatılırken bir sorun oluştu.");
      setIsAudioLoading(false);
      setIsAudioPlaying(false);
      setActivePlayingId(null);
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    }
  };

  const copyText = async (text: string, type: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Kopyalandı', `${type} panoya kopyalandı!`);
  };

  const shareText = async (title: string, message: string) => {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Paylaşım mevcut değil', 'Cihazınızda paylaşım özelliği bulunmuyor veya aktif değil.');
        return;
      }
      await Sharing.shareAsync(message, { dialogTitle: `${title} Paylaş` });
    } catch (error: any) {
      Alert.alert('Paylaşım Hatası', 'Paylaşım sırasında bir hata oluştu: ' + error.message);
    }
  };
  
  const toggleFavoriteSurah = async (surahId: string) => {
    const newFavoriteSurahIds = favoriteSurahIds.includes(surahId)
      ? favoriteSurahIds.filter(id => id !== surahId)
      : [...favoriteSurahIds, surahId];
    setFavoriteSurahIds(newFavoriteSurahIds);
    try {
      await AsyncStorage.setItem('favoriteSurahs', JSON.stringify(newFavoriteSurahIds));
    } catch (e) {
      console.error('Failed to save favorite surahs.', e);
    }
  };

  const openSurahModal = (surahInfo: SurahInfo) => {
    setSelectedSurahForModal(surahInfo);
    setAyetsForModal(ayetlerListesi.filter(ayet => ayet.surahId === surahInfo.id));
    setIsModalVisible(true);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    searchAndPickerContainer: {
      paddingHorizontal: 15,
      paddingTop: 10,
      marginBottom: 10,
    },
    searchInput: {
      backgroundColor: theme === 'dark' ? colors.tint + '1A' : colors.card,
      color: colors.text,
      paddingHorizontal: 15,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      borderRadius: 10,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
    },
    pickerContainer: {
      backgroundColor: theme === 'dark' ? colors.tint + '1A' : colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 10,
      overflow: 'hidden',
    },
    picker: {
      height: Platform.OS === 'ios' ? 120 : 50,
      width: '100%',
      color: colors.text,
    },
    surahDisplayCard: {
      marginHorizontal: 15,
      marginBottom: 20,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 15,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: theme === 'dark' ? 0.25 : 0.1,
      shadowRadius: 3.84,
      elevation: 5,
    },
    surahDisplayTitleContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: 10,
      marginBottom: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    surahDisplayTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.primary,
      flex: 1,
    },
    surahInfoButton: {},
    // Fatiha Özel Stilleri
    fatihaContainer: {
      paddingVertical: 10,
    },
    fatihaArabicBlock: {
      fontSize: 22,
      color: colors.text,
      textAlign: I18nManager.isRTL ? 'left' : 'right',
      writingDirection: 'rtl',
      marginBottom: 15,
      lineHeight: 40, // Daha iyi okunabilirlik için artırıldı
      fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif-medium',
    },
    fatihaTransliterationBlock: {
      fontSize: 17,
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginBottom: 15,
      lineHeight: 26,
      textAlign: 'left',
    },
    fatihaMeaningBlock: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 20,
      lineHeight: 24,
      textAlign: 'left',
    },
    fatihaActionsContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border + '80',
    },
    // Ayet Item Stilleri
    ayetItemContainer: {
      marginBottom: 20,
      paddingBottom: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '80',
    },
    ayetItemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    ayetItemNumber: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
    },
    ayetItemArabic: {
      fontSize: 22,
      color: colors.text,
      textAlign: I18nManager.isRTL ? 'left' : 'right',
      writingDirection: 'rtl',
      marginBottom: 8,
      lineHeight: 38,
      fontFamily: Platform.OS === 'ios' ? 'Arial' : 'sans-serif-medium',
    },
    ayetItemTransliteration: {
      fontSize: 16,
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginBottom: 8,
      lineHeight: 24,
      textAlign: 'left',
    },
    ayetItemMeaning: {
      fontSize: 15,
      color: colors.textSecondary,
      marginBottom: 12,
      lineHeight: 22,
      textAlign: 'left',
    },
    ayetItemActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginTop: 8,
    },
    actionButton: {
      marginLeft: 18,
      padding: 6,
    },
    emptyStateContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      marginTop: 30, // Biraz boşluk
    },
    emptyStateText: {
      marginTop: 15,
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    // Modal Stilleri (önemli bir değişiklik yok, aynı kalabilir)
    modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)'},
    modalView: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%', shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
    modalCloseButton: { position: 'absolute', top: 10, right: 10, zIndex: 1 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: colors.primary, marginBottom: 15, textAlign: 'center' },
    modalSectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginTop: 15, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 6 },
    modalInfoText: { fontSize: 15, color: colors.textSecondary, marginBottom: 8, lineHeight: 22 },
    modalAyetCard: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border + '40' },
    modalArabicText: { fontSize: 20, color: colors.text, textAlign: I18nManager.isRTL ? 'left' : 'right', writingDirection: 'rtl', marginBottom: 5, lineHeight: 34 },
    modalTransliterationText: { fontSize: 14, color: colors.textSecondary, fontStyle: 'italic', marginBottom: 5, lineHeight: 20 },
    modalMeaningText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  });

  const AyetItemView = ({ ayet }: { ayet: Ayet }) => (
    <View style={styles.ayetItemContainer}>
      <View style={styles.ayetItemHeader}>
        <Text style={styles.ayetItemNumber}>Ayet: {ayet.ayetNumber}</Text>
      </View>
      <Text style={styles.ayetItemArabic} selectable>{ayet.arabicText}</Text>
      <Text style={styles.ayetItemTransliteration} selectable>{ayet.transliteration}</Text>
      <Text style={styles.ayetItemMeaning} selectable>{ayet.turkishMeaning}</Text>
      <View style={styles.ayetItemActions}>
        {ayet.audioUrl && (
          <TouchableOpacity 
            onPress={() => playAudio(ayet.audioUrl!, ayet.id)} 
            style={styles.actionButton} 
            disabled={isAudioLoading && activePlayingId === ayet.id}
          >
            {isAudioLoading && activePlayingId === ayet.id ? (
              <IconSymbol name="arrow.down.circle.dotted" size={24} color={colors.icon} />
            ) : activePlayingId === ayet.id && isAudioPlaying ? (
              <IconSymbol name="pause.fill" size={24} color={colors.primary} />
            ) : (
              <IconSymbol name="play.fill" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity 
            onPress={() => copyText(`${ayet.surahName} - ${ayet.ayetNumber}. Ayet\\n\\nArapça:\\n${ayet.arabicText}\\n\\nOkunuşu:\\n${ayet.transliteration}\\n\\nTürkçe Meali:\\n${ayet.turkishMeaning}`, `${ayet.surahName} - ${ayet.ayetNumber}. Ayet`)} 
            style={styles.actionButton}
        >
          <IconSymbol name="doc.on.doc.fill" size={22} color={colors.icon} />
        </TouchableOpacity>
        <TouchableOpacity 
            onPress={() => shareText(
                `${ayet.surahName} - ${ayet.ayetNumber}. Ayet`, 
                `${ayet.surahName} - ${ayet.ayetNumber}. Ayet\\n\\nArapça:\\n${ayet.arabicText}\\n\\nOkunuşu:\\n${ayet.transliteration}\\n\\nTürkçe Meali:\\n${ayet.turkishMeaning}`
            )} 
            style={styles.actionButton}
        >
          <IconSymbol name="square.and.arrow.up.fill" size={22} color={colors.icon} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const filteredSurahInfos = surahInfos.filter(s =>
    s.name.toLowerCase().includes(searchText.toLowerCase())
  );
  const currentSurahInfo = surahInfos.find(s => s.name === selectedSurahName);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.searchAndPickerContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Sure ara..."
          placeholderTextColor={colors.textSecondary}
          value={searchText}
          onChangeText={setSearchText}
        />
        {(searchText === '' || filteredSurahInfos.length > 0) && (
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedSurahName}
              onValueChange={(itemValue) => setSelectedSurahName(itemValue)}
              style={styles.picker}
              dropdownIconColor={colors.icon}
              itemStyle={{ color: colors.text, fontSize: 16 }}
            >
              {(searchText === '' ? surahInfos : filteredSurahInfos).map((surah) => (
                <Picker.Item key={surah.id} label={surah.name} value={surah.name} />
              ))}
            </Picker>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {currentSurahInfo && displayedAyets.length > 0 ? (
          <View style={styles.surahDisplayCard}>
            <View style={styles.surahDisplayTitleContainer}>
              <Text style={styles.surahDisplayTitle}>{currentSurahInfo.name}</Text>
              <TouchableOpacity
                onPress={() => openSurahModal(currentSurahInfo)}
                style={styles.surahInfoButton}
              >
                <IconSymbol name="info.circle" size={26} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {currentSurahInfo.id === '1' ? ( // FATİHA SURESİ ÖZEL GÖSTERİMİ
              <View style={styles.fatihaContainer}>
                <Text style={styles.fatihaArabicBlock} selectable>
                  {displayedAyets.map(a => a.arabicText).join('\\n\\n')}
                </Text>
                <Text style={styles.fatihaTransliterationBlock} selectable>
                  {displayedAyets.map(a => a.transliteration).join('\\n\\n')}
                </Text>
                <Text style={styles.fatihaMeaningBlock} selectable>
                  {displayedAyets.map(a => a.turkishMeaning).join('\\n\\n')}
                </Text>
                <View style={styles.fatihaActionsContainer}>
                  {currentSurahInfo.audioUrl && ( // Eğer Fatiha için genel ses URL'si varsa
                    <TouchableOpacity 
                        onPress={() => playAudio(currentSurahInfo.audioUrl!, currentSurahInfo.id)} 
                        style={styles.actionButton}
                        disabled={isAudioLoading && activePlayingId === currentSurahInfo.id}
                    >
                       {isAudioLoading && activePlayingId === currentSurahInfo.id ? (
                        <IconSymbol name="arrow.down.circle.dotted" size={24} color={colors.icon} />
                        ) : activePlayingId === currentSurahInfo.id && isAudioPlaying ? (
                        <IconSymbol name="pause.fill" size={24} color={colors.primary} />
                        ) : (
                        <IconSymbol name="play.fill" size={24} color={colors.primary} />
                        )}
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                    onPress={() => copyText(
                        `${currentSurahInfo.name}\\n\\nArapça:\\n${displayedAyets.map(a => a.arabicText).join('\\n')}\\n\\nOkunuşu:\\n${displayedAyets.map(a => a.transliteration).join('\\n')}\\n\\nTürkçe Meali:\\n${displayedAyets.map(a => a.turkishMeaning).join('\\n')}`,
                        currentSurahInfo.name
                    )} 
                    style={styles.actionButton}
                  >
                    <IconSymbol name="doc.on.doc.fill" size={22} color={colors.icon} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => shareText(
                        currentSurahInfo.name,
                        `${currentSurahInfo.name}\\n\\nArapça:\\n${displayedAyets.map(a => a.arabicText).join('\\n')}\\n\\nOkunuşu:\\n${displayedAyets.map(a => a.transliteration).join('\\n')}\\n\\nTürkçe Meali:\\n${displayedAyets.map(a => a.turkishMeaning).join('\\n')}`
                    )} 
                    style={styles.actionButton}
                  >
                    <IconSymbol name="square.and.arrow.up.fill" size={22} color={colors.icon} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : ( // DİĞER SURELER İÇİN AYET BAZLI GÖSTERİM
              displayedAyets.map(ayet => (
                <AyetItemView key={ayet.id} ayet={ayet} />
              ))
            )}
          </View>
        ) : (
          <View style={styles.emptyStateContainer}>
            <IconSymbol name="doc.text.magnifyingglass" size={60} color={colors.icon} />
            <Text style={styles.emptyStateText}>
              {searchText !== '' && filteredSurahInfos.length === 0
                ? `"${searchText}" ile eşleşen sure bulunamadı.`
                : "Görüntülenecek sure veya ayet bulunamadı."}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Modal aynı kalabilir */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => {
          setIsModalVisible(!isModalVisible);
          setSelectedSurahForModal(null);
        }}
      >
        <TouchableOpacity 
          style={styles.modalContainer} 
          activeOpacity={1} 
          onPressOut={() => {
              setIsModalVisible(false);
              setSelectedSurahForModal(null);
          }}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalView} onPress={() => {}}>
            <ScrollView>
              <TouchableOpacity 
                  style={styles.modalCloseButton} 
                  onPress={() => {
                      setIsModalVisible(false);
                      setSelectedSurahForModal(null);
                  }}
              >
                  <IconSymbol name="xmark.circle.fill" size={30} color={colors.icon} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{selectedSurahForModal?.name}</Text>
              <Text style={styles.modalSectionTitle}>Sure Hakkında</Text>
              <Text style={styles.modalInfoText}><Text style={{fontWeight: 'bold'}}>Nüzul Yeri:</Text> {selectedSurahForModal?.revelationType}</Text>
              <Text style={styles.modalInfoText}><Text style={{fontWeight: 'bold'}}>Ayet Sayısı:</Text> {selectedSurahForModal?.totalAyets}</Text>
              <Text style={styles.modalInfoText}><Text style={{fontWeight: 'bold'}}>Genel Anlamı:</Text> {selectedSurahForModal?.meaningSummary}</Text>
              {selectedSurahForModal?.virtue && (
                <Text style={styles.modalInfoText}><Text style={{fontWeight: 'bold'}}>Fazileti:</Text> {selectedSurahForModal.virtue}</Text>
              )}
              <Text style={styles.modalSectionTitle}>Ayetler</Text>
              {ayetsForModal.map((ayet) => (
                <View key={`modal-${ayet.id}`} style={styles.modalAyetCard}>
                  <Text style={styles.ayetItemHeader}>{`${ayet.ayetNumber}. Ayet`}</Text> {/* Stil adı düzeltildi */}
                  <Text selectable style={styles.modalArabicText}>{ayet.arabicText}</Text>
                  <Text selectable style={styles.modalTransliterationText}>{ayet.transliteration}</Text>
                  <Text selectable style={styles.modalMeaningText}>{ayet.turkishMeaning}</Text>
                </View>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </ThemedView>
  );
} 