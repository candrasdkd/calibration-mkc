import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RecordsProvider } from '../core/records';
import { AdminDataProvider } from '../core/admin-data';
import { RoleProvider } from '../core/role';
import { BottomBar } from '../components/BottomBar';
import { colors } from '../core/theme';

export default function RootLayout() {
  return <SafeAreaProvider><AdminDataProvider><RecordsProvider><RoleProvider>
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />
      <BottomBar />
    </View>
  </RoleProvider></RecordsProvider></AdminDataProvider></SafeAreaProvider>;
}
