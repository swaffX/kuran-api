import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { CustomThemeProvider, useTheme } from '../contexts/ThemeContext';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded && !error) {
    SplashScreen.preventAutoHideAsync();
    return null;
  }

  return (
    <CustomThemeProvider>
      <RootLayoutNav />
      <Toast />
    </CustomThemeProvider>
  );
}

function RootLayoutNav() {
  const { theme } = useTheme();
  const navigationTheme = theme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <NavThemeProvider value={navigationTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </NavThemeProvider>
  );
}
