import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

import { AppProvider, useApp } from './src/context/AppContext';
import AuthScreen      from './src/screens/AuthScreen';
import HomeScreen      from './src/screens/HomeScreen';
import DashboardScreen from './src/screens/DashboardScreen';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { ready, user, theme } = useApp();

  if (!ready) {
    const bg = theme === 'dark' ? '#111113' : '#F6F6F3';
    const accent = '#1AAD7D';
    return (
      <View style={{ flex:1, backgroundColor:bg, alignItems:'center', justifyContent:'center' }}>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <View style={{ width:64, height:64, borderRadius:20, backgroundColor:accent, alignItems:'center', justifyContent:'center', marginBottom:24 }}>
          <Text style={{ fontSize:30, color:'#fff', fontWeight:'700' }}>₹</Text>
        </View>
        <ActivityIndicator size="large" color={accent} />
        <Text style={{ color: theme==='dark'?'#9898A0':'#65656A', fontSize:14, marginTop:16 }}>Loading SplitMate...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {!user ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : (
          <>
            <Stack.Screen name="Home"      component={HomeScreen} />
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <AppNavigator />
        </AppProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
