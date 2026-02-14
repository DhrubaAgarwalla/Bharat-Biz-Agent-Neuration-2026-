import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text as RNText, TouchableOpacity, Platform, SafeAreaView, StatusBar as RNStatusBar } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter, usePathname, withLayoutContext } from 'expo-router';
import { createMaterialTopTabNavigator, MaterialTopTabNavigationOptions, MaterialTopTabNavigationEventMap } from '@react-navigation/material-top-tabs';
import { ParamListBase, TabNavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { useLanguage } from '@/lib/i18n';
import { supabase, SHOP_ID } from '@/lib/supabase';

// Create Material Top Tabs Navigator
const { Navigator } = createMaterialTopTabNavigator();

export const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

// Tab icons mapping
const ICONS: Record<string, React.ComponentProps<typeof FontAwesome>['name']> = {
  index: 'home',
  orders: 'shopping-cart',
  inventory: 'cubes',
  reports: 'bar-chart',
  profile: 'user',
};

// Notification bell with badge
function NotificationBell({ onPress, count }: { onPress: () => void; count: number }) {
  return (
    <TouchableOpacity onPress={onPress} style={bellStyles.container}>
      <FontAwesome name="bell" size={22} color="#fff" />
      {count > 0 && (
        <View style={bellStyles.badge}>
          <RNText style={bellStyles.badgeText}>{count > 99 ? '99+' : count}</RNText>
        </View>
      )}
    </TouchableOpacity>
  );
}

const bellStyles = StyleSheet.create({
  container: {
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FF6B35',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

function CustomHeader({ title, onNotificationPress, unreadCount }: { title: string, onNotificationPress: () => void, unreadCount: number }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[headerStyles.container, { paddingTop: insets.top }]}>
      <View style={headerStyles.content}>
        <RNText style={headerStyles.title}>{title}</RNText>
        <NotificationBell onPress={onNotificationPress} count={unreadCount} />
      </View>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  container: {
    backgroundColor: '#FF6B35',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    zIndex: 1,
  },
  content: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default function TabLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const [unreadCount, setUnreadCount] = useState(0);

  // Determine header title based on current path
  const getHeaderTitle = () => {
    if (pathname === '/' || pathname === '/(tabs)') return t('home_header');
    if (pathname.includes('orders')) return t('orders_header');
    if (pathname.includes('inventory')) return t('inventory_header');
    if (pathname.includes('reports')) return t('reports_header');
    if (pathname.includes('notifications')) return t('notifications');
    if (pathname.includes('profile')) return t('profile_header');
    return t('home_header');
  };

  // Fetch unread notification count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', SHOP_ID)
        .eq('is_read', false);
      setUnreadCount(count || 0);
    };

    fetchUnreadCount();

    const subscription = supabase
      .channel('notif-count-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const openNotifications = () => {
    router.push('/notifications');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <RNStatusBar barStyle="light-content" backgroundColor="#FF6B35" />

      {/* Global Header for Tabs */}
      <CustomHeader
        title={getHeaderTitle()}
        onNotificationPress={openNotifications}
        unreadCount={unreadCount}
      />

      <MaterialTopTabs
        tabBarPosition="bottom"
        screenOptions={{
          tabBarActiveTintColor: '#FF6B35',
          tabBarInactiveTintColor: '#888',
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopWidth: 1,
            borderTopColor: '#f0f0f0',
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            height: 60,
          },
          tabBarIndicatorStyle: {
            backgroundColor: '#FF6B35',
            height: 3,
            top: 0, // Line at the top of the bottom bar
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            textTransform: 'capitalize',
            marginBottom: 4,
          },
          tabBarShowIcon: true,
          swipeEnabled: true,
          animationEnabled: true,
        }}
      >
        <MaterialTopTabs.Screen
          name="index"
          options={{
            title: t('tab_home'),
            tabBarIcon: ({ color }) => <FontAwesome name="home" size={24} color={color} />,
          }}
        />
        <MaterialTopTabs.Screen
          name="orders"
          options={{
            title: t('tab_orders'),
            tabBarIcon: ({ color }) => <FontAwesome name="shopping-cart" size={24} color={color} />,
          }}
        />
        <MaterialTopTabs.Screen
          name="inventory"
          options={{
            title: t('tab_stock'),
            tabBarIcon: ({ color }) => <FontAwesome name="cubes" size={24} color={color} />,
          }}
        />
        <MaterialTopTabs.Screen
          name="reports"
          options={{
            title: t('tab_reports'),
            tabBarIcon: ({ color }) => <FontAwesome name="bar-chart" size={24} color={color} />,
          }}
        />
        <MaterialTopTabs.Screen
          name="profile"
          options={{
            title: t('tab_profile'),
            tabBarIcon: ({ color }) => <FontAwesome name="user" size={24} color={color} />,
          }}
        />
      </MaterialTopTabs>
    </View>
  );
}
