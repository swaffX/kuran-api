import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTheme } from '@/contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    I18nManager, // Arapça metin yönü için
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
  footnotes?: {
    id: number;
    text: string;
    number: number;
  }[];
}

// Sureler için genel bilgi (Ses çalmak için kullanılabilir)
interface SurahInfo {
  id: string;
  name: string;
  englishName?: string;
  englishNameTranslation?: string;
  audioUrl?: string;
  ayetCount: number; // Suredeki toplam ayet sayısı
  meaningSummary?: string;
  isFavorite?: boolean;
  revelationType: 'Mekki' | 'Medeni';
  virtue?: string;
  // Açık Kuran API'sinden gelen bilgiler için yeni alanlar
  name_en?: string; 
  verse_count?: number;
  audio?: {
    mp3: string;
    duration: number;
    mp3_en?: string;
    duration_en?: number;
  };
}

// API'den gelen cevaplar için arayüzler
interface KuranAPIResponse {
  data: SurahInfo[];
}

interface SurahAPIResponse {
  data: {
    id: number;
    name: string;
    name_en: string;
    name_original: string;
    slug: string;
    verse_count: number;
    page_number: number;
    audio: {
      mp3: string;
      duration: number;
      mp3_en?: string;
      duration_en?: number;
    };
    verses: VerseAPIData[];
    zero?: {
      translation: {
        text: string;
      };
    };
  };
}

interface VerseAPIData {
  id: number;
  surah_id: number;
  verse_number: number;
  verse: string;
  verse_simplified: string;
  page: number;
  juz_number: number;
  transcription: string;
  transcription_en: string;
  translation: {
    id: number;
    text: string;
    author: {
      id: number;
      name: string;
      language: string;
      description: string;
    };
    footnotes?: {
      id: number;
      text: string;
      number: number;
    }[];
  };
}

// Ayet detayları için API cevap arayüzü
interface VerseDetailAPIResponse {
  data: {
    id: number;
    surah: {
      id: number;
      name: string;
      name_en: string;
      slug: string;
      verse_count: number;
      page_number: number;
      name_original: string;
      audio: {
        mp3: string;
        duration: number;
        mp3_en?: string;
        duration_en?: number;
      };
    };
    verse_number: number;
    verse: string;
    verse_simplified: string;
    page: number;
    juz_number: number;
    verse_without_vowel: string;
    transcription: string;
    transcription_en: string;
    translation: {
      id: number;
      author: {
        id: number;
        name: string;
        description: string;
        language: string;
        url: string | null;
      };
      text: string;
      footnotes: {
        id: number;
        text: string;
        number: number;
      }[] | null;
    };
  };
}

// Eski örnek veriler kalsın (API başarısız olursa veya hızlı test için kullanılabilir)
const surahInfosExample: SurahInfo[] = [
  {
    id: '1',
    name: 'Fatiha Suresi',
    ayetCount: 7,
    meaningSummary: `Mekke döneminde inmiştir. Yedi âyettir. Kur'an-ı Kerim'in ilk sûresi olduğu için "başlangıç" anlamına "Fâtiha" adını almıştır. Sûrenin ayrıca, "Ümmü'1-Kitab" (Kitab'ın özü) "es-Seb'ul-Mesânî" (Tekrarlanan yedi âyet) , "el-Esâs", "el-Vâfiye", "el-Kâfiye", "el-Kenz", "eş-Şifâ", "eş-Şükr" ve "es-Salât" gibi başka adları da vardır. Kur'an'ın içerdiği esaslar öz olarak Fâtiha'da vardır. Zira övgü ve yüceltilmeye lâyık bir tek Allah'ın varlığı, onun hâkimiyeti, tek mabut oluşu, kulluğun ancak O'na yapılıp O'ndan yardım isteneceği, bu sûrede özlü bir şekilde ifade edilir. Fâtiha sûresi, aynı zamanda baştan başa eşsiz güzellikte bir dua, bir yakarıştır.`,
    revelationType: 'Mekki',
    virtue: 'Hz. Peygamber (s.a.s.), "Fâtiha\'yı okumayanın namazı yoktur (kâmil namazı olmaz)" buyurmuştur. (Buhârî, Ezân, 95)'
  },
  {
    id: '112',
    name: 'İhlas Suresi',
    ayetCount: 4,
    meaningSummary: `Mekke döneminde inmiştir. Dört âyettir. İhlâs, samimi olmak, dine içtenlikle bağlanmak demektir. Allah'a bu sûrede anlatıldığı şekilde iman etmek, imanda ihlâsa ulaşmak düşüncesiyle sûreye İhlâs adı verilmiştir. "Kul hüvellahü ehad" diye başladığı için "Ehad sûresi" olarak da anılır.`,
    revelationType: 'Mekki',
    virtue: 'Hz. Peygamber (s.a.s.), İhlas suresinin Kur\'an\'ın üçte birine denk geldiğini bildirmiştir. (Buhârî, Ezân, 106)'
  },
];

// Örnek ayetler (API verisi gelmezse yedek olarak kullanılabilir)
const ayetlerListesiExample: Ayet[] = [
  // Fatiha Suresi
  {
    id: '1-1', surahId: '1', surahName: 'Fatiha Suresi', ayetNumber: 1,
    arabicText: 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ',
    transliteration: `Bismillâhirrahmânirrahîm`,
    turkishMeaning: `Rahmân ve Rahîm olan Allah'ın adıyla.`,
    audioUrl: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3'
  },
  // İhlas Suresi
  {
    id: '112-1', surahId: '112', surahName: 'İhlas Suresi', ayetNumber: 1,
    arabicText: 'قُلْ هُوَ اللَّهُ أَحَدٌ',
    transliteration: `Kul huvallâhu ehad`,
    turkishMeaning: `De ki: O Allah birdir.`,
    audioUrl: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/6222.mp3'
  },
];

// API'den veri almak için URL'ler - Ses URL düzeltmeleri
const ACIK_KURAN_API_URL = 'https://api.acikkuran.com';
const AUDIO_BASE_URL = 'https://audio.acikkuran.com/tr/'; // Burada bıraktık ancak kullanımı değişecek
const DEFAULT_AUTHOR_ID = '105'; // Erhan Aktaş meali varsayılan olarak kullanılacak
const FAVORITE_SURAHS_KEY = 'favoriteSurahs'; // Favori sureleri saklamak için key

export default function DuasScreen() {
  const { colors, theme } = useTheme();
  const params = useLocalSearchParams();
  const { surahId: querySurahId, verseNumber: queryVerseNumber } = params;
  const scrollViewRef = useRef<ScrollView>(null);
  const [searchText, setSearchText] = useState('');
  const [favoriteSurahIds, setFavoriteSurahIds] = useState<string[]>([]);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState<boolean>(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  
  // API ile ilgili state'ler
  const [surahs, setSurahs] = useState<SurahInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isSurahAyetsLoading, setIsSurahAyetsLoading] = useState<boolean>(false);
  
  // Filtreleme ve popup için state'ler
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'Tümü' | 'Mekki' | 'Medeni'>('Tümü');
  const [selectedSurah, setSelectedSurah] = useState<SurahInfo | null>(null);
  const [isSurahDialogVisible, setIsSurahDialogVisible] = useState<boolean>(false);
  const [surahAyets, setSurahAyets] = useState<Ayet[]>([]);
  
  // API'den Kur'an verilerini getirme fonksiyonu
  const fetchQuranData = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadingError(null);
      
      // Tüm sureleri listele
      const surahsResponse = await fetch(`${ACIK_KURAN_API_URL}/surahs`);
      const surahData: KuranAPIResponse = await surahsResponse.json();
      
      // Verileri işle
      const processedSurahs: SurahInfo[] = surahData.data.map(surah => {
        const surahId = surah.id.toString();
        return {
          id: surahId,
          name: surah.name, // Açık Kuran API'si zaten Türkçe isimler içeriyor
          englishName: surah.name_en,
          ayetCount: surah.verse_count || 0, // Varsayılan değer atayarak undefined olma ihtimalini kaldırıyoruz
          // API'den Mekki/Medeni bilgisi şu anda mevcut değil, varsayılan atanıyor
          revelationType: surahId === '1' || surahId === '2' ? 'Medeni' : 'Mekki',
          audioUrl: surah.audio?.mp3 || `${AUDIO_BASE_URL}${surahId}.mp3`,
          // Belli surelere özel virtue ve meaningSummary ekleyebiliriz
          virtue: surahId === '1' ? 'Hz. Peygamber (s.a.s.), "Fâtiha\'yı okumayanın namazı yoktur (kâmil namazı olmaz)" buyurmuştur. (Buhârî, Ezân, 95)' : 
                  surahId === '112' ? 'Hz. Peygamber (s.a.s.), İhlas suresinin Kur\'an\'ın üçte birine denk geldiğini bildirmiştir. (Buhârî, Ezân, 106)' : undefined,
          meaningSummary: surahId === '1' ? `Mekke döneminde inmiştir. Yedi âyettir. Kur'an-ı Kerim'in ilk sûresi olduğu için "başlangıç" anlamına "Fâtiha" adını almıştır.` : 
                          surahId === '112' ? `Mekke döneminde inmiştir. Dört âyettir. İhlâs, samimi olmak, dine içtenlikle bağlanmak demektir.` : undefined
        };
      });
      
      // State'leri güncelle
      setSurahs(processedSurahs);
      setIsLoading(false);
    } catch (error) {
      console.error('Kur\'an verisi alınırken hata oluştu:', error);
      setLoadingError('Kur\'an verileri yüklenirken bir hata oluştu. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.');
      
      // Hata durumunda örnek verileri kullan
      setSurahs(surahInfosExample);
      setIsLoading(false);
    }
  }, []);
  
  // Belirli bir sure için ayet verilerini getir
  const fetchSurahAyets = useCallback(async (surahId: string) => {
    if (!surahId) return [];
    
    try {
      setIsSurahAyetsLoading(true);
      
      // Seçilen sure bilgisini bul
      const surah = surahs.find(s => s.id === surahId);
      if (!surah) {
        setIsSurahAyetsLoading(false);
        return [];
      }
      
      // API'den sure detaylarını getir
      const surahResponse = await fetch(`${ACIK_KURAN_API_URL}/surah/${surahId}?author=${DEFAULT_AUTHOR_ID}`);
      const surahData: SurahAPIResponse = await surahResponse.json();
      
      if (!surahData.data || !surahData.data.verses) {
        throw new Error('API verisi alınamadı');
      }
      
      // Ayetleri işle
      const fetchedAyets: Ayet[] = surahData.data.verses.map(verse => {
        // Dipnotları ayır (varsa)
        const footnotes = verse.translation.footnotes || [];
        
        return {
          id: `${surahId}-${verse.verse_number}`,
          surahId,
          surahName: surah.name,
          ayetNumber: verse.verse_number,
          arabicText: verse.verse,
          transliteration: verse.transcription || `[${surah.name} ${verse.verse_number}. Ayet]`,
          turkishMeaning: verse.translation.text,
          footnotes: footnotes.length > 0 ? footnotes : undefined,
          // Her ayet için ayrı ses dosyası URL'si oluşturuyoruz
          audioUrl: `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${verse.id}.mp3`
        };
      });
      
      setIsSurahAyetsLoading(false);
      return fetchedAyets;
    } catch (error) {
      console.error(`Sure ${surahId} ayetlerini getirirken hata:`, error);
      setIsSurahAyetsLoading(false);
      return [];
    }
  }, [surahs]);
  
  // Sure seçildiğinde ayetleri yükle
  const handleSurahPress = useCallback(async (surah: SurahInfo) => {
    setSelectedSurah(surah);
    setIsSurahDialogVisible(true);
    setSurahAyets([]);
    
    const ayets = await fetchSurahAyets(surah.id);
    setSurahAyets(ayets);
    
    // URL'den verseNumber parametresi geldiyse, o ayete sonra otomatik scroll edeceğiz
    // (ayetlerin render edilmesi için beklemek gerekiyor)
  }, [fetchSurahAyets, querySurahId, queryVerseNumber]);

  // Ayetler yüklendiğinde ve sure dialogu açıksa, belirli ayete scroll et
  useEffect(() => {
    if (surahAyets.length > 0 && isSurahDialogVisible && selectedSurah && 
        selectedSurah.id === querySurahId && queryVerseNumber && scrollViewRef.current) {
      // Ayetler yüklendikten sonra belirli bir süre bekleyip scroll et
      const targetVerseNumber = Number(queryVerseNumber);
      
      // Hedef ayete kadar kaç ayet var, o kadar scroll et
      const targetIndex = surahAyets.findIndex(ayet => ayet.ayetNumber === targetVerseNumber);
      
      if (targetIndex !== -1) {
        // Yüklenmesi için biraz bekle
        setTimeout(() => {
          // ScrollView'e scroll yap - sabit değerler yerine yükleme sonrası scroll
          scrollViewRef.current?.scrollTo({ y: targetIndex * 300, animated: true });
        }, 800);
      }
    }
  }, [surahAyets, isSurahDialogVisible, selectedSurah, querySurahId, queryVerseNumber]);

  // Favori sureleri yükle
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const storedFavorites = await AsyncStorage.getItem(FAVORITE_SURAHS_KEY);
        if (storedFavorites !== null) {
          setFavoriteSurahIds(JSON.parse(storedFavorites));
        }
      } catch (e) {
        console.error('Failed to load favorites.', e);
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
    // Bu fonksiyon artık kullanılmıyor, yerine fetchSurahAyets kullanılıyor
    return [];
  }, []);

  // Uygulama başladığında Kur'an verilerini getir
  useEffect(() => {
    fetchQuranData();
  }, [fetchQuranData]);

  // URL parametrelerine göre otomatik sure açma
  useEffect(() => {
    if (querySurahId && !isLoading && surahs.length > 0) {
      const targetSurah = surahs.find(s => s.id === querySurahId);
      if (targetSurah) {
        handleSurahPress(targetSurah);
      }
    }
  }, [querySurahId, isLoading, surahs, handleSurahPress]);

  // Hem ayet hem de tam sure için ses çalma fonksiyonu
  const playAudio = async (url: string, id: string) => {
    if (!url) {
      Alert.alert("Ses Dosyası Yok", "Bu içerik için ses dosyası bulunamadı.");
      return;
    }

    console.log("Çalınacak ses URL'i:", url); // Hangi URL ile çalışıyoruz kontrol ediyoruz

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
      
      console.log("Yüklenen ses: ", { uri: url });
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
    // Sureyi bulmak için array'de arama yap
    const surah = surahs.find(s => s.id === surahId);
    if (!surah) return; // Sure bulunamadıysa işlemi sonlandır
    
    try {
    // Eğer zaten favorilerdeyse ve kullanıcı çıkarmak istiyorsa onay sor
    if (favoriteSurahIds.includes(surahId)) {
      Alert.alert(
        "Favorilerden Çıkar",
          `"${surah.name}" suresini favorilerinizden çıkarmak istediğinize emin misiniz?`,
        [
            { text: "Vazgeç", style: "cancel" },
          { 
              text: "Evet, Çıkar", 
            onPress: async () => {
                try {
              const newFavoriteSurahIds = favoriteSurahIds.filter(id => id !== surahId);
              setFavoriteSurahIds(newFavoriteSurahIds);
                  
                  await AsyncStorage.setItem(FAVORITE_SURAHS_KEY, JSON.stringify(newFavoriteSurahIds));
                  Alert.alert("Bilgi", `"${surah.name}" favorilerinizden çıkarıldı.`);
              } catch (e) {
                  console.error('AsyncStorage hatası:', e);
                  Alert.alert('Hata', 'Favorilerden çıkarılırken bir sorun oluştu.');
              }
            } 
          }
        ]
      );
      return;
    }
    
    // Eğer favorilerde değilse direkt ekle
    const newFavoriteSurahIds = [...favoriteSurahIds, surahId];
    setFavoriteSurahIds(newFavoriteSurahIds);
      
      // AsyncStorage'a kaydet
      await AsyncStorage.setItem(FAVORITE_SURAHS_KEY, JSON.stringify(newFavoriteSurahIds));
      Alert.alert("Bilgi", `"${surah.name}" favorilerinize eklendi.`);
    } catch (e) {
      console.error('AsyncStorage hatası:', e);
      Alert.alert('Hata', 'Favorilere eklenirken bir sorun oluştu.');
    }
  };

  const filteredSurahs = surahs.filter(surah => {
    // Arama metnine göre filtrele
    const matchesSearch = surah.name.toLowerCase().includes(searchText.toLowerCase());
    
    // Kategori filtresine göre filtrele
    const matchesCategory = selectedCategoryFilter === 'Tümü' || 
                           (selectedCategoryFilter === 'Mekki' && surah.revelationType === 'Mekki') || 
                           (selectedCategoryFilter === 'Medeni' && surah.revelationType === 'Medeni');
    
    return matchesSearch && matchesCategory;
  });

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 16,
    },
    searchContainer: {
      marginBottom: 16,
    },
    searchInput: {
      backgroundColor: colors.card,
      color: colors.text,
      paddingHorizontal: 15,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      borderRadius: 10,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filtersContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 12,
      marginBottom: 16,
    },
    filterButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
      borderWidth: 1,
      backgroundColor: colors.card,
    },
    filterButtonActive: {
      backgroundColor: colors.primary,
    },
    filterButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '500',
    },
    filterButtonTextActive: {
      color: '#ffffff',
    },
    surahBubblesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    surahBubble: {
      width: (Dimensions.get('window').width - 48) / 2,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: theme === 'dark' ? 0.3 : 0.1,
      shadowRadius: 2,
      elevation: 3,
      alignItems: 'center',
      justifyContent: 'center',
    },
    surahBubbleHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      marginBottom: 4,
    },
    surahBubbleName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
      marginBottom: 4,
      textAlign: 'center',
      flex: 1,
    },
    surahBubbleInfo: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    favoriteButton: {
      padding: 8,
      borderRadius: 20,
    },
    favoritedButton: {
      backgroundColor: 'rgba(255, 59, 48, 0.15)',
    },
    noResultsContainer: {
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center',
      marginTop: 40,
    },
    noResultsText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 12,
    },
    // Loading ve Error stilleri
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 50, // StatusBar için biraz boşluk
    },
    loadingText: {
      fontSize: 16,
      color: colors.primary,
      marginTop: 16,
      textAlign: 'center',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 50,
      paddingHorizontal: 20,
    },
    errorText: {
      fontSize: 16,
      color: colors.error || 'red',
      marginTop: 16,
      marginBottom: 24,
      textAlign: 'center',
      lineHeight: 22,
    },
    retryButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      backgroundColor: colors.primary,
      borderRadius: 8,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 1.5,
    },
    retryButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    // Boş ayet durumu stili
    emptyAyetsContainer: {
      padding: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyAyetsText: {
      fontSize: 15,
      color: colors.textSecondary,
      marginTop: 12,
      textAlign: 'center',
    },
    // Dialog Stilleri
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    dialogContainer: {
      backgroundColor: colors.background,
      borderRadius: 16,
      width: '100%',
      maxHeight: '90%',
      padding: 0,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 5,
      elevation: 5,
    },
    dialogHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.primary,
    },
    dialogTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#fff',
      flex: 1,
      textAlign: 'center',
    },
    dialogCloseButton: {
      padding: 8,
      margin: 4,
    },
    dialogScrollView: {
      padding: 16,
    },
    dialogInfoSection: {
      marginBottom: 16,
      padding: 12,
      backgroundColor: colors.card,
      borderRadius: 10,
    },
    dialogInfoTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    dialogInfoRow: {
      flexDirection: 'row',
      marginBottom: 6,
    },
    dialogInfoLabel: {
      fontSize: 14,
      fontWeight: 'bold',
      color: colors.text,
      width: 100,
    },
    dialogInfoValue: {
      fontSize: 14,
      color: colors.textSecondary,
      flex: 1,
    },
    dialogSummary: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      textAlign: 'justify',
      marginTop: 8,
    },
    ayetContainer: {
      marginBottom: 16,
      padding: 12,
      backgroundColor: colors.card,
      borderRadius: 10,
    },
    ayetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '40',
    },
    ayetNumber: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.primary,
    },
    ayetText: {
      fontSize: 22,
      lineHeight: 38,
      color: colors.text,
      textAlign: I18nManager.isRTL ? 'left' : 'right',
      writingDirection: 'rtl',
      marginBottom: 12,
    },
    ayetTransliteration: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 8,
      fontStyle: 'italic',
    },
    ayetMeaning: {
      fontSize: 16,
      color: colors.textSecondary,
      lineHeight: 24,
    },
    ayetActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border + '40',
      paddingTop: 8,
    },
    actionButton: {
      marginLeft: 16,
      padding: 6,
    },
    // Geri butonu için stil ekleniyor
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      marginVertical: 10,
      alignSelf: 'center',
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    backButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: 'bold',
      marginLeft: 8,
    },
    // Dipnotlar için stiller
    footnoteContainer: {
      backgroundColor: colors.card + '80',
      padding: 12,
      marginTop: 8,
      borderRadius: 8,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    footnoteHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    footnoteTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: colors.primary,
      marginLeft: 6,
    },
    footnoteText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    footnotesContainer: {
      marginTop: 8,
    },
  });

  const CategoryFilterButton = ({ title }: { title: 'Tümü' | 'Mekki' | 'Medeni' }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        selectedCategoryFilter === title && styles.filterButtonActive,
      ]}
      onPress={() => setSelectedCategoryFilter(title)}
    >
      <Text
        style={[
          styles.filterButtonText,
          selectedCategoryFilter === title && styles.filterButtonTextActive,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );

  const SurahBubble = ({ surah }: { surah: SurahInfo }) => {
    const isFavorite = favoriteSurahIds.includes(surah.id);
    
    return (
      <TouchableOpacity
        style={styles.surahBubble}
        onPress={() => handleSurahPress(surah)}
      >
        <View style={styles.surahBubbleHeader}>
        <Text style={styles.surahBubbleName}>{surah.name}</Text>
        <TouchableOpacity
            style={[styles.favoriteButton, isFavorite ? styles.favoritedButton : {}]}
            onPress={(e) => {
              e.stopPropagation(); // Sadece favorileme butonunun tıklamasını yönet
              toggleFavoriteSurah(surah.id);
            }}
        >
          <IconSymbol
              name={isFavorite ? 'heart.fill' : 'heart'}
            size={24}
              color={isFavorite ? '#ff3b30' : colors.textSecondary}
          />
        </TouchableOpacity>
        </View>
        <Text style={styles.surahBubbleInfo}>
          {surah.revelationType} • {surah.ayetCount} Ayet
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={styles.container}>
      {/* Arama Kutusu */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Sure ara..."
          placeholderTextColor={colors.textSecondary}
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>
      
      {/* Filtreler */}
      <View style={styles.filtersContainer}>
        <CategoryFilterButton title="Tümü" />
        <CategoryFilterButton title="Mekki" />
        <CategoryFilterButton title="Medeni" />
      </View>
      
      {/* Loading State */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Kur'an-ı Kerim verileri yükleniyor...</Text>
        </View>
      ) : loadingError ? (
        <View style={styles.errorContainer}>
          <IconSymbol name="exclamationmark.triangle.fill" size={60} color={colors.error || colors.primary} />
          <Text style={styles.errorText}>{loadingError}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchQuranData}
          >
            <Text style={styles.retryButtonText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Sure Baloncukları */
        filteredSurahs.length > 0 ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.surahBubblesContainer}>
              {filteredSurahs.map(surah => (
                <SurahBubble key={surah.id} surah={surah} />
              ))}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.noResultsContainer}>
            <IconSymbol name="magnifyingglass" size={60} color={colors.icon} />
            <Text style={styles.noResultsText}>
              "{searchText}" ile eşleşen sure bulunamadı.
            </Text>
          </View>
        )
      )}
      
      {/* Sure Detay Dialog */}
      <Modal
        visible={isSurahDialogVisible && selectedSurah !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsSurahDialogVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dialogContainer}>
            <View style={styles.dialogHeader}>
              <TouchableOpacity
                style={[styles.dialogCloseButton, {
                  backgroundColor: 'rgba(255, 255, 255, 0.3)', 
                  borderRadius: 8,
                  width: 40,
                  height: 40,
                  justifyContent: 'center',
                  alignItems: 'center'
                }]}
                onPress={() => setIsSurahDialogVisible(false)}
              >
                <Text style={{
                  color: '#ffffff',
                  fontSize: 24,
                  fontWeight: 'bold',
                  marginTop: -3
                }}>←</Text>
              </TouchableOpacity>
              <Text style={styles.dialogTitle}>
                {selectedSurah?.name}
              </Text>
              <View style={{width: 40}} />
            </View>
            
            <ScrollView 
              ref={scrollViewRef}
              style={styles.dialogScrollView}
            >
              {selectedSurah && (
                <View style={styles.dialogInfoSection}>
                  <Text style={styles.dialogInfoTitle}>Sure Bilgileri</Text>
                  
                  <View style={styles.dialogInfoRow}>
                    <Text style={styles.dialogInfoLabel}>Nüzul Yeri:</Text>
                    <Text style={styles.dialogInfoValue}>{selectedSurah.revelationType}</Text>
                  </View>
                  
                  <View style={styles.dialogInfoRow}>
                    <Text style={styles.dialogInfoLabel}>Ayet Sayısı:</Text>
                    <Text style={styles.dialogInfoValue}>{selectedSurah.ayetCount}</Text>
                  </View>
                  
                  {selectedSurah.virtue && (
                    <View style={styles.dialogInfoRow}>
                      <Text style={styles.dialogInfoLabel}>Fazileti:</Text>
                      <Text style={styles.dialogInfoValue}>{selectedSurah.virtue}</Text>
                    </View>
                  )}
                  
                  {selectedSurah.meaningSummary && (
                    <Text style={styles.dialogSummary}>{selectedSurah.meaningSummary}</Text>
                  )}
                </View>
              )}
              
              {isSurahAyetsLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Ayetler yükleniyor...</Text>
                </View>
              ) : surahAyets.length > 0 ? (
                surahAyets.map(ayet => (
                  <View 
                    key={ayet.id} 
                    style={[
                      styles.ayetContainer,
                      queryVerseNumber && Number(queryVerseNumber) === ayet.ayetNumber ? 
                        { 
                          backgroundColor: theme === 'dark' ? 
                            colors.primaryMuted + '60' : 
                            colors.primaryMuted + '30',
                          borderWidth: 1,
                          borderColor: colors.primary + '60',
                          borderRadius: 15 
                        } : 
                        {}
                    ]}
                    onLayout={(event) => {
                      // Eğer bu hedeflenen ayetse, pozisyonunu kaydet ve oraya scroll et
                      if (queryVerseNumber && Number(queryVerseNumber) === ayet.ayetNumber && scrollViewRef.current) {
                        const { y } = event.nativeEvent.layout;
                        scrollViewRef.current.scrollTo({ y: y - 100, animated: true });
                      }
                    }}
                  >
                    <View style={styles.ayetHeader}>
                      <Text style={styles.ayetNumber}>{ayet.ayetNumber}. Ayet</Text>
                    </View>
                    
                    <Text style={styles.ayetText} selectable>
                      {ayet.arabicText}
                    </Text>
                    
                    <Text style={styles.ayetTransliteration} selectable>
                      {ayet.transliteration}
                    </Text>
                    
                    <Text style={styles.ayetMeaning} selectable>
                      {ayet.turkishMeaning}
                    </Text>
                    
                    {/* Dipnotları Göster */}
                    {ayet.footnotes && ayet.footnotes.length > 0 && (
                      <View style={styles.footnotesContainer}>
                        {ayet.footnotes.map(footnote => (
                          <View key={footnote.id} style={styles.footnoteContainer}>
                            <View style={styles.footnoteHeader}>
                              <IconSymbol name="info.circle.fill" size={16} color={colors.primary} />
                              <Text style={styles.footnoteTitle}>Dipnot {footnote.number}</Text>
                            </View>
                            <Text style={styles.footnoteText}>{footnote.text}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    
                    <View style={styles.ayetActions}>
                      {ayet.audioUrl && (
                        <TouchableOpacity
                          onPress={() => playAudio(ayet.audioUrl!, ayet.id)}
                          style={styles.actionButton}
                          disabled={isAudioLoading && activePlayingId === ayet.id}
                        >
                          {isAudioLoading && activePlayingId === ayet.id ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : activePlayingId === ayet.id && isAudioPlaying ? (
                            <IconSymbol name="pause.fill" size={24} color={colors.primary} />
                          ) : (
                            <IconSymbol name="play.fill" size={24} color={colors.primary} />
                          )}
                        </TouchableOpacity>
                      )}
                      
                      <TouchableOpacity
                        onPress={() => copyText(
                          `${ayet.surahName} - ${ayet.ayetNumber}. Ayet\n\nArapça:\n${ayet.arabicText}\n\nOkunuşu:\n${ayet.transliteration}\n\nTürkçe Meali:\n${ayet.turkishMeaning}`,
                          `${ayet.surahName} - ${ayet.ayetNumber}. Ayet`
                        )}
                        style={styles.actionButton}
                      >
                        <IconSymbol name="doc.on.doc.fill" size={22} color={colors.icon} />
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        onPress={() => shareText(
                          `${ayet.surahName} - ${ayet.ayetNumber}. Ayet`,
                          `${ayet.surahName} - ${ayet.ayetNumber}. Ayet\n\nArapça:\n${ayet.arabicText}\n\nOkunuşu:\n${ayet.transliteration}\n\nTürkçe Meali:\n${ayet.turkishMeaning}`
                        )}
                        style={styles.actionButton}
                      >
                        <IconSymbol name="square.and.arrow.up.fill" size={22} color={colors.icon} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyAyetsContainer}>
                  <IconSymbol name="doc.text.magnifyingglass" size={40} color={colors.icon} />
                  <Text style={styles.emptyAyetsText}>Bu sure için ayet bulunamadı.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
} 