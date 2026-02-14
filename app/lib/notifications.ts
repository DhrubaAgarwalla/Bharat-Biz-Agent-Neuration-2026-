// Push Notification Setup for Expo

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure notification handler
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// Register for push notifications
export async function registerForPushNotifications(shopId: string): Promise<string | null> {
    let token: string | null = null;

    if (!Device.isDevice) {
        console.log('Push notifications require a physical device');
        return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not granted
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.log('Failed to get push notification permission');
        return null;
    }

    // Get Expo push token
    try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: '629b34ec-7e19-4c1f-959c-d09410507d9a', // Using the project ID from app.json
        });
        token = tokenData.data;
    } catch (error) {
        console.error('Error getting push token:', error);
        return null;
    }

    // Save token to Supabase
    if (token) {
        const { error } = await supabase.from('push_tokens').upsert({
            shop_id: shopId,
            expo_push_token: token,
            device_info: {
                platform: Platform.OS,
                model: Device.modelName,
            },
            is_active: true,
        }, {
            onConflict: 'expo_push_token',
        });

        if (error) {
            console.error('Failed to save push token:', error);
        }
    }

    // Android-specific notification channel
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('orders', {
            name: 'Orders',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF6B35',
        });
    }

    return token;
}

// Listen for notifications
export function addNotificationListener(
    onReceive: (notification: Notifications.Notification) => void,
    onResponse: (response: Notifications.NotificationResponse) => void
) {
    const receiveSubscription = Notifications.addNotificationReceivedListener(onReceive);
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(onResponse);

    return () => {
        receiveSubscription.remove();
        responseSubscription.remove();
    };
}

// Send local notification immediately
export async function sendLocalNotification(title: string, body: string, data?: Record<string, unknown>) {
    await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            data: data || {},
            sound: 'default',
        },
        trigger: null, // Immediately
    });
}

// Setup realtime notifications - listens to DB and shows mobile push
export function setupRealtimeNotifications(shopId: string) {
    const subscription = supabase
        .channel('mobile-push-notifications')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `shop_id=eq.${shopId}`,
        }, async (payload) => {
            const notification = payload.new as any;

            // Show local push notification on device
            await sendLocalNotification(
                notification.title || '🔔 New Notification',
                notification.body || 'You have a new notification',
                notification.data
            );
        })
        .subscribe();

    return () => {
        subscription.unsubscribe();
    };
}
