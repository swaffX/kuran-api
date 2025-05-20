/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#007AFF'; // iOS Mavi
const tintColorDark = '#0A84FF'; // iOS Mavi Koyu Mod

const primaryLight = tintColorLight;
const primaryDark = tintColorDark;

const textSecondaryLight = '#555';
const textSecondaryDark = '#AEAEAE';

const primaryMutedLight = '#E0F7FA';
const primaryMutedDark = '#2C3A47';

const errorLight = '#D32F2F';
const errorDark = '#EF5350';

export const Colors = {
  light: {
    text: '#000',
    background: '#F8F9FA', // Daha açık bir arka plan
    tint: tintColorLight,
    icon: '#6c757d', // Daha yumuşak ikon rengi
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorLight,
    border: '#dee2e6', // Daha belirgin sınır çizgisi
    card: '#FFFFFF', // Kartlar için beyaz arka plan
    primary: tintColorLight,
    textSecondary: '#495057',
    primaryMuted: tintColorLight + '20', // %12.5 opacity
    error: '#dc3545',
    iconAction: '#495057', // Kalıcı renk: textSecondary ile aynı
    borderMuted: '#E9ECEF', // Daha soluk ayırıcı çizgiler için
  },
  dark: {
    text: '#E0E0E0', // Tam beyaz değil, biraz kırık
    background: '#121212', // Materyal Tasarım koyu tema arka planı
    tint: tintColorDark,
    icon: '#adb5bd', // Açık gri ikonlar
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorDark,
    border: '#343A40', // Koyu tema için sınır
    card: '#1E1E1E', // Kartlar için biraz daha açık koyu renk
    primary: tintColorDark,
    textSecondary: '#CED4DA',
    primaryMuted: tintColorDark + '2A', // %16.5 opacity
    error: '#f85149',
    iconAction: '#CED4DA', // Kalıcı renk: textSecondary ile aynı
    borderMuted: '#2C2C2C', // Daha soluk ayırıcı çizgiler için
  },
};
