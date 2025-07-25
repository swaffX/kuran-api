/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

/**
 * Ezan Vakti Pro için renk paleti
 */

const tintColorLight = '#2E7D32'; // Yeşil ana renk
const tintColorDark = '#4CAF50'; // Yeşil ana renk (koyu tema)

const primaryLight = tintColorLight;
const primaryDark = tintColorDark;

const textSecondaryLight = '#555';
const textSecondaryDark = '#AEAEAE';

const primaryMutedLight = '#E8F5E9'; // Açık yeşil arka plan
const primaryMutedDark = '#1B5E20'; // Koyu yeşil arka plan

const errorLight = '#D32F2F';
const errorDark = '#EF5350';

// Gradyan renkleri
const gradients = {
  light: {
    primary: ['#2E7D32', '#388E3C', '#43A047'],
    secondary: ['#1565C0', '#1976D2', '#1E88E5'],
    success: ['#2E7D32', '#388E3C', '#43A047'],
    warning: ['#FF8F00', '#FFA000', '#FFB300'],
    danger: ['#C62828', '#D32F2F', '#E53935'],
    background: ['#F5F5F5', '#FFFFFF', '#FAFAFA'],
    card: ['#FFFFFF', '#F5F5F5'],
  },
  dark: {
    primary: ['#1B5E20', '#2E7D32', '#388E3C'],
    secondary: ['#0D47A1', '#1565C0', '#1976D2'],
    success: ['#1B5E20', '#2E7D32', '#388E3C'],
    warning: ['#E65100', '#EF6C00', '#F57C00'],
    danger: ['#B71C1C', '#C62828', '#D32F2F'],
    background: ['#121212', '#1E1E1E', '#2C2C2C'],
    card: ['#1E1E1E', '#2C2C2C'],
  }
};

export const Colors = {
  light: {
    text: '#000',
    background: '#F8F9FA',
    tint: tintColorLight,
    icon: '#6c757d',
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorLight,
    border: '#dee2e6',
    card: '#FFFFFF',
    primary: primaryLight,
    textSecondary: '#495057',
    primaryMuted: primaryMutedLight,
    error: errorLight,
    iconAction: '#495057',
    borderMuted: '#E9ECEF',
    gradients: gradients.light,
    success: '#43A047',
    warning: '#FFA000',
    info: '#1E88E5',
    danger: '#E53935',
    shadow: 'rgba(0, 0, 0, 0.1)',
  },
  dark: {
    text: '#E0E0E0',
    background: '#121212',
    tint: tintColorDark,
    icon: '#adb5bd',
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorDark,
    border: '#343A40',
    card: '#1E1E1E',
    primary: primaryDark,
    textSecondary: '#CED4DA',
    primaryMuted: primaryMutedDark,
    error: errorDark,
    iconAction: '#CED4DA',
    borderMuted: '#2C2C2C',
    gradients: gradients.dark,
    success: '#43A047',
    warning: '#FFA000',
    info: '#1E88E5',
    danger: '#E53935',
    shadow: 'rgba(0, 0, 0, 0.3)',
  },
};

// Namaz vakitleri için özel renkler
export const PrayerColors = {
  Fajr: {
    light: '#7E57C2',
    dark: '#9575CD',
    gradient: {
      light: ['#5E35B1', '#7E57C2', '#9575CD'],
      dark: ['#4527A0', '#5E35B1', '#7E57C2'],
    }
  },
  Sunrise: {
    light: '#FB8C00',
    dark: '#FFA726',
    gradient: {
      light: ['#EF6C00', '#FB8C00', '#FFA726'],
      dark: ['#E65100', '#EF6C00', '#FB8C00'],
    }
  },
  Dhuhr: {
    light: '#039BE5',
    dark: '#29B6F6',
    gradient: {
      light: ['#0288D1', '#039BE5', '#29B6F6'],
      dark: ['#01579B', '#0288D1', '#039BE5'],
    }
  },
  Asr: {
    light: '#00ACC1',
    dark: '#26C6DA',
    gradient: {
      light: ['#00838F', '#00ACC1', '#26C6DA'],
      dark: ['#006064', '#00838F', '#00ACC1'],
    }
  },
  Maghrib: {
    light: '#FF7043',
    dark: '#FF8A65',
    gradient: {
      light: ['#F4511E', '#FF7043', '#FF8A65'],
      dark: ['#E64A19', '#F4511E', '#FF7043'],
    }
  },
  Isha: {
    light: '#5C6BC0',
    dark: '#7986CB',
    gradient: {
      light: ['#3949AB', '#5C6BC0', '#7986CB'],
      dark: ['#283593', '#3949AB', '#5C6BC0'],
    }
  },
};
