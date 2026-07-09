import { Tabs } from 'expo-router';
import { SidebarLayout } from '@/components/SidebarLayout';
import { LocationSync } from '@/components/LocationSync';

export default function TabLayout() {
  return (
    <SidebarLayout>
      <LocationSync />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
          tabBarButton: () => null,
        }}>
        <Tabs.Screen name="dashboard" />
        <Tabs.Screen name="index" />
        <Tabs.Screen name="attendance" />
        <Tabs.Screen name="calendar" />
        <Tabs.Screen name="history" />
        <Tabs.Screen name="settings" />
      </Tabs>
    </SidebarLayout>
  );
}
