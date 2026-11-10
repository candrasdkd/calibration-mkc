import React from 'react';
import { View } from 'react-native';
import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RecordsProvider } from '../core/records';
import { AdminDataProvider } from '../core/admin-data';
import { RoleProvider } from '../core/role';
import { BottomBar } from '../components/BottomBar';
import { colors } from '../core/theme';
import { useRole } from '../features/home/hooks/useRole';

function AppNavigation() {
  const { isReady, isAuthenticated } = useRole();
  const segments = useSegments();
  const isLogin = segments[0] === 'login';
  const isAuthCallback = segments.join('/') === 'auth/callback';
  const redirectToLogin = isReady && !isAuthenticated && !isLogin && !isAuthCallback;
  const redirectToHome = isReady && isAuthenticated && isLogin;
  const blockingNavigation = !isReady || redirectToLogin || redirectToHome;

  return <>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }} />
    {redirectToLogin ? <Redirect href="/login" /> : null}
    {redirectToHome ? <Redirect href="/" /> : null}
    {isAuthenticated ? <BottomBar /> : null}
    {blockingNavigation ? <View pointerEvents="auto" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.canvas }} /> : null}
  </>;
}

export default function RootLayout() {
  return <SafeAreaProvider><AdminDataProvider><RecordsProvider><RoleProvider>
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <StatusBar style="dark" />
      <AppNavigation />
    </View>
  </RoleProvider></RecordsProvider></AdminDataProvider></SafeAreaProvider>;
}
