import { Colors } from '@/constants/Colors'; // Renklerimizi import ediyoruz
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  colors: typeof Colors.light | typeof Colors.dark;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'app_theme';

export function CustomThemeProvider({ children }: { children: ReactNode }) {
  // İsteğiniz üzerine varsayılan tema 'dark' olacak.
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    async function loadTheme() {
      try {
        const storedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
        if (storedTheme) {
          setTheme(storedTheme);
        } else {
          // Eğer storage'da tema yoksa, varsayılan olarak 'dark' kullan
          // ve bunu storage'a kaydet.
          setTheme('dark');
          await AsyncStorage.setItem(THEME_STORAGE_KEY, 'dark');
        }
      } catch (error: any) {
        console.error("Failed to load theme from storage", error);
        // Hata durumunda varsayılan 'dark' tema
        setTheme('dark');
      }
    }
    loadTheme();
  }, []);

  // Sistem teması değişikliğini dinleme useEffect'i kaldırıldı çünkü manuel kontrol istendi.

  function toggleTheme() {
    setTheme(prevTheme => {
      const newTheme = prevTheme === 'light' ? 'dark' : 'light';
      AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme).catch((error: any) =>
        console.error("Failed to save theme to storage", error)
      );
      return newTheme;
    });
  }

  const currentColors = theme === 'light' ? Colors.light : Colors.dark;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors: currentColors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
} 