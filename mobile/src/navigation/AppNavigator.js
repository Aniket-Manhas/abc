import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme';

// Main screens
import DashboardScreen    from '../screens/DashboardScreen';
import MapScreen          from '../screens/MapScreen';
import NavigationScreen   from '../screens/NavigationScreen';
import EmergencyScreen    from '../screens/EmergencyScreen';
import LastMileScreen     from '../screens/LastMileScreen';
import AccessibilityScreen from '../screens/AccessibilityScreen';

const Stack  = createNativeStackNavigator();
const Tab    = createBottomTabNavigator();
const MoreStack = createNativeStackNavigator();

const TAB_ICON = {
  Home:      ['home',       'home-outline'],
  Map:       ['map',        'map-outline'],
  Navigate:  ['navigate',   'navigate-outline'],
  Emergency: ['warning',    'warning-outline'],
  More:      ['grid',       'grid-outline'],
};

function MoreNavigator() {
  return (
    <MoreStack.Navigator
      screenOptions={{
        headerStyle:     { backgroundColor: colors.bgSecondary },
        headerTintColor: colors.textPrimary,
        headerTitleStyle:{ fontWeight: '700' },
      }}
    >
      <MoreStack.Screen name="LastMile"     component={LastMileScreen}     options={{ title: '🚕 Last Mile' }} />
      <MoreStack.Screen name="Accessibility" component={AccessibilityScreen} options={{ title: '♿ Accessibility' }} />
    </MoreStack.Navigator>
  );
}

function PassengerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const [active, inactive] = TAB_ICON[route.name] || ['ellipse', 'ellipse-outline'];
          return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
        },
        tabBarActiveTintColor:   colors.accentSaffron,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bgSecondary,
          borderTopColor:  colors.border,
          borderTopWidth:  1,
          paddingBottom:   4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
        headerStyle:      { backgroundColor: colors.bgSecondary },
        headerTintColor:  colors.textPrimary,
        headerTitleStyle: { fontWeight: '800', fontSize: 17 },
        headerShadowVisible: false,
      })}
    >
      <Tab.Screen name="Home"      component={DashboardScreen}  options={{ title: 'Home',       headerTitle: '🚂 Sahyatri' }} />
      <Tab.Screen name="Map"       component={MapScreen}        options={{ title: 'Map',        headerShown: false }} />
      <Tab.Screen name="Navigate"  component={NavigationScreen} options={{ title: 'Navigate',   headerTitle: '🧭 Indoor Navigation' }} />
      <Tab.Screen name="Emergency" component={EmergencyScreen}  options={{ title: 'Emergency',  headerTitle: '🚨 Emergency',
        tabBarActiveTintColor: colors.crowdHigh,
      }} />
      <Tab.Screen name="More"      component={MoreNavigator}    options={{ title: 'More',       headerShown: false }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={PassengerTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
