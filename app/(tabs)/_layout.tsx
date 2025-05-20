import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTheme } from '@/contexts/ThemeContext';
import { Tabs } from 'expo-router';
import React, { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import FavoritesModal from '../../components/FavoritesModal';

export default function TabLayout() {
  const { theme, toggleTheme, colors } = useTheme();
  const [isFavoritesModalVisible, setIsFavoritesModalVisible] = useState(false);

  const renderHeaderRight = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <TouchableOpacity onPress={() => setIsFavoritesModalVisible(true)} style={{ marginRight: 15 }}>
        <IconSymbol 
          name={'heart.fill'} 
          size={24} 
          color={colors.tint} 
        />
      </TouchableOpacity>
      <TouchableOpacity onPress={toggleTheme} style={{ marginRight: 15 }}>
        <IconSymbol 
          name={theme === 'dark' ? 'sun.max.fill' : 'moon.fill'} 
          size={24} 
          color={colors.tint} 
        />
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.tint,
          tabBarInactiveTintColor: colors.icon,
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerShown: true,
          headerRight: renderHeaderRight,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Ana Sayfa',
            tabBarIcon: ({ color, focused }) => (
              <IconSymbol name={'house.fill'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="prayerTimes"
          options={{
            title: 'Namaz Vakitleri',
            tabBarIcon: ({ color, focused }) => (
              <IconSymbol name={'clock.fill'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="qibla"
          options={{
            title: 'Kıble',
            tabBarIcon: ({ color, focused }) => (
              <IconSymbol name={'location.north.fill'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="duas"
          options={{
            title: 'Sureler',
            tabBarIcon: ({ color, focused }) => (
              <IconSymbol name={'book.fill'} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Ayarlar',
            tabBarIcon: ({ color, focused }) => (
              <IconSymbol name={'gearshape.fill'} color={color} />
            ),
          }}
        />
      </Tabs>
      <FavoritesModal 
        visible={isFavoritesModalVisible} 
        onClose={() => setIsFavoritesModalVisible(false)} 
      />
    </>
  );
}
