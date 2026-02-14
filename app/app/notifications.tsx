// Notifications Screen - View all notifications
import React, { useEffect, useState } from 'react';
import {
    StyleSheet,
    ScrollView,
    RefreshControl,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import { supabase, Notification, SHOP_ID } from '@/lib/supabase';
import { markNotificationRead } from '@/lib/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/lib/i18n';

export default function NotificationsScreen() {
    const { t } = useLanguage();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const router = useRouter();

    const fetchNotifications = async () => {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('shop_id', SHOP_ID)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setNotifications(data || []);
        } catch (error) {
            console.error('Fetch notifications error:', error);
        }
    };

    useEffect(() => {
        fetchNotifications();

        // Realtime subscription
        const subscription = supabase
            .channel('notifications-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
                fetchNotifications();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchNotifications();
        setRefreshing(false);
    };

    const handleNotificationPress = async (notif: Notification) => {
        // Mark as read
        if (!notif.is_read) {
            await markNotificationRead(notif.id);
            setNotifications(prev =>
                prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n)
            );
        }

        // Navigate based on type
        if (notif.type === 'new_order') {
            router.push('/(tabs)/orders');
        } else if (notif.type === 'low_stock') {
            router.push('/(tabs)/inventory');
        }
    };

    const markAllRead = async () => {
        try {
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('shop_id', SHOP_ID)
                .eq('is_read', false);

            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            Alert.alert(t('done'), t('all_marked_read'));
        } catch (error) {
            console.error('Mark all read error:', error);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'new_order': return 'shopping-cart';
            case 'payment_received': return 'money';
            case 'low_stock': return 'exclamation-triangle';
            case 'payment_reminder': return 'clock-o';
            default: return 'bell';
        }
    };

    const getColor = (type: string) => {
        switch (type) {
            case 'new_order': return '#4CAF50';
            case 'payment_received': return '#2196F3';
            case 'low_stock': return '#F44336';
            case 'payment_reminder': return '#FF9800';
            default: return '#666';
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return t('just_now');
        if (diffMins < 60) return `${diffMins}m ${t('ago')}`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ${t('ago')}`;
        return date.toLocaleDateString('en-IN');
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <View style={styles.container}>
            {/* Header with mark all read */}
            {unreadCount > 0 && (
                <View style={styles.header}>
                    <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
                        <Text style={styles.markAllText}>{t('mark_all_read')}</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Notifications List */}
            <ScrollView
                style={styles.list}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B35']} />
                }>
                {notifications.length === 0 ? (
                    <View style={styles.emptyState}>
                        <FontAwesome name="bell-slash" size={64} color="#ddd" />
                        <Text style={styles.emptyText}>{t('no_notifications')}</Text>
                    </View>
                ) : (
                    notifications.map((notif) => (
                        <TouchableOpacity
                            key={notif.id}
                            style={[styles.notifCard, !notif.is_read && styles.unreadCard]}
                            onPress={() => handleNotificationPress(notif)}>
                            <View style={[styles.iconContainer, { backgroundColor: getColor(notif.type) + '20' }]}>
                                <FontAwesome name={getIcon(notif.type) as any} size={20} color={getColor(notif.type)} />
                            </View>
                            <View style={styles.contentContainer}>
                                <View style={styles.titleRow}>
                                    <Text style={[styles.title, !notif.is_read && styles.unreadTitle]}>
                                        {notif.title}
                                    </Text>
                                    {!notif.is_read && <View style={styles.unreadDot} />}
                                </View>
                                <Text style={styles.body}>{notif.body}</Text>
                                <Text style={styles.time}>{formatTime(notif.created_at)}</Text>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: 12,
        paddingHorizontal: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    markAllBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#FFF5F0',
    },
    markAllText: {
        fontSize: 14,
        color: '#FF6B35',
        fontWeight: '500',
    },
    list: {
        flex: 1,
        padding: 16,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 64,
        backgroundColor: 'transparent',
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        color: '#999',
    },
    notifCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    unreadCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#FF6B35',
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentContainer: {
        flex: 1,
        marginLeft: 12,
        backgroundColor: 'transparent',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    title: {
        fontSize: 16,
        color: '#333',
        flex: 1,
    },
    unreadTitle: {
        fontWeight: '600',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF6B35',
        marginLeft: 8,
    },
    body: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    time: {
        fontSize: 12,
        color: '#999',
        marginTop: 6,
    },
});
