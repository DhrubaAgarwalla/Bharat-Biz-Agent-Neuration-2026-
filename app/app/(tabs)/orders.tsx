// Orders Screen - View and manage customer orders
import React, { useEffect, useState, useCallback } from 'react';
import {
    StyleSheet,
    ScrollView,
    RefreshControl,
    TouchableOpacity,
    Alert,
    Dimensions,
    Linking,
    Image,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import { supabase, Order, OrderItem, OrderOngoing, SHOP_ID } from '@/lib/supabase';
import { confirmOrder, rejectOrder } from '@/lib/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import LoadingScreen from '@/components/LoadingScreen';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

const { width } = Dimensions.get('window');

type FilterStatus = 'all' | 'pending' | 'confirmed' | 'completed' | 'rejected';

// Extended order type with payment tracking
interface OrderWithTracking extends Order {
    ongoing?: OrderOngoing | null;
}

export default function OrdersScreen() {
    const [orders, setOrders] = useState<OrderWithTracking[]>([]);
    const [filter, setFilter] = useState<FilterStatus>('pending');
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

    const fetchOrders = useCallback(async () => {
        try {
            let query = supabase
                .from('orders')
                .select(`
          *,
          order_items (*)
        `)
                .eq('shop_id', SHOP_ID)
                .order('created_at', { ascending: false });

            if (filter !== 'all') {
                query = query.eq('status', filter);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Fetch order_ongoing data for all orders
            const orderIds = (data || []).map((o: Order) => o.id);
            let ongoingMap: Record<string, OrderOngoing> = {};

            if (orderIds.length > 0) {
                const { data: ongoingData, error: ongoingError } = await supabase
                    .from('order_ongoing')
                    .select('*')
                    .in('order_id', orderIds);

                if (ongoingError) {
                    console.error('Error fetching order_ongoing:', ongoingError);
                }

                if (ongoingData) {
                    ongoingData.forEach((og: any) => {
                        if (og.order_id) {
                            // Parse payment_data if it's a string (AI stores it as JSON string)
                            let paymentData = og.payment_data;
                            if (typeof paymentData === 'string') {
                                try { paymentData = JSON.parse(paymentData); } catch (e) { paymentData = null; }
                            }
                            // Parse items_json if it's a string
                            let itemsJson = og.items_json;
                            if (typeof itemsJson === 'string') {
                                try { itemsJson = JSON.parse(itemsJson); } catch (e) { itemsJson = []; }
                            }
                            ongoingMap[og.order_id] = {
                                ...og,
                                payment_data: paymentData,
                                items_json: itemsJson,
                            };
                        }
                    });
                }
            }

            // Merge ongoing data into orders
            const ordersWithTracking: OrderWithTracking[] = (data || []).map((order: Order) => ({
                ...order,
                ongoing: ongoingMap[order.id] || null,
            }));

            setOrders(ordersWithTracking);
        } catch (error) {
            console.error('Fetch orders error:', error);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    // Auto-refresh every 30 seconds
    useAutoRefresh(fetchOrders, { interval: 30000, refreshOnFocus: true });

    useEffect(() => {
        // Realtime subscription for both orders and order_ongoing
        const subscription = supabase
            .channel('orders-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchOrders();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_ongoing' }, () => {
                fetchOrders();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [filter, fetchOrders]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchOrders();
        setRefreshing(false);
    };

    const handleConfirm = async (order: Order) => {
        Alert.alert(
            'Confirm Order',
            `Confirm order for ${order.customer_name}?\nTotal: ₹${order.total_amount}`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm ✓',
                    style: 'default',
                    onPress: async () => {
                        try {
                            await confirmOrder(order.id, order.customer_name, order.total_amount);
                            Alert.alert('Success', 'Order confirmed! Customer will be notified.');
                        } catch (error) {
                            Alert.alert('Error', 'Failed to confirm order');
                        }
                    },
                },
            ]
        );
    };

    const handleReject = async (order: Order) => {
        Alert.alert(
            'Reject Order',
            `Are you sure you want to reject this order?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject ✗',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await rejectOrder(order.id, order.customer_name);
                            Alert.alert('Done', 'Order rejected.');
                        } catch (error) {
                            Alert.alert('Error', 'Failed to reject order');
                        }
                    },
                },
            ]
        );
    };

    const handleComplete = async (order: Order) => {
        try {
            await supabase
                .from('orders')
                .update({ status: 'completed', payment_status: 'paid' })
                .eq('id', order.id);

            // Also update order_ongoing
            await supabase
                .from('order_ongoing')
                .update({ status: 'completed' })
                .eq('order_id', order.id);

            Alert.alert('Success', 'Order marked as completed!');
        } catch (error) {
            Alert.alert('Error', 'Failed to complete order');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return '#FFA500';
            case 'confirmed': return '#4CAF50';
            case 'completed': return '#2196F3';
            case 'rejected': return '#F44336';
            case 'cancelled': return '#9E9E9E';
            default: return '#888';
        }
    };

    const getPaymentBadge = (ongoing: OrderOngoing | null | undefined) => {
        if (!ongoing) return null;

        switch (ongoing.status) {
            case 'payment_verified':
                return { label: '💳 PAID', color: '#4CAF50', bgColor: '#E8F5E9' };
            case 'payment_warning':
                return { label: '⚠️ MISMATCH', color: '#FF9800', bgColor: '#FFF3E0' };
            case 'payment_pending':
                return { label: '⏳ AWAITING', color: '#9E9E9E', bgColor: '#F5F5F5' };
            case 'completed':
                return { label: '✅ COMPLETED', color: '#2196F3', bgColor: '#E3F2FD' };
            case 'confirmed':
                return { label: '✓ CONFIRMED', color: '#4CAF50', bgColor: '#E8F5E9' };
            default:
                return null;
        }
    };

    const FilterButton = ({ status, label }: { status: FilterStatus; label: string }) => (
        <TouchableOpacity
            style={[styles.filterButton, filter === status && styles.filterButtonActive]}
            onPress={() => setFilter(status)}>
            <Text style={[styles.filterText, filter === status && styles.filterTextActive]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return date.toLocaleDateString('en-IN');
    };

    // Show loading screen on first load
    if (loading) {
        return <LoadingScreen message="Loading orders..." />;
    }

    return (
        <View style={styles.container}>
            {/* Filter Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
                <FilterButton status="pending" label="⏳ Pending" />
                <FilterButton status="confirmed" label="✓ Confirmed" />
                <FilterButton status="completed" label="✓✓ Completed" />
                <FilterButton status="rejected" label="✗ Rejected" />
                <FilterButton status="all" label="All" />
            </ScrollView>

            {/* Orders List */}
            <ScrollView
                style={styles.ordersList}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B35']} />
                }>
                {orders.length === 0 ? (
                    <View style={styles.emptyState}>
                        <FontAwesome name="inbox" size={64} color="#ddd" />
                        <Text style={styles.emptyText}>No {filter === 'all' ? '' : filter} orders</Text>
                    </View>
                ) : (
                    orders.map((order) => {
                        const paymentBadge = getPaymentBadge(order.ongoing);

                        return (
                            <TouchableOpacity
                                key={order.id}
                                style={styles.orderCard}
                                onPress={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                                {/* Order Header */}
                                <View style={styles.orderHeader}>
                                    <View style={styles.customerInfo}>
                                        <Text style={styles.customerName}>{order.customer_name}</Text>
                                        <Text style={styles.customerPhone}>📱 {order.customer_phone}</Text>
                                    </View>
                                    <View style={styles.orderMeta}>
                                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                                            <Text style={styles.statusText}>{order.status.toUpperCase()}</Text>
                                        </View>
                                        <Text style={styles.orderTime}>{formatTime(order.created_at)}</Text>
                                    </View>
                                </View>

                                {/* Payment Status Badge */}
                                {paymentBadge && (
                                    <View style={[styles.paymentBadge, { backgroundColor: paymentBadge.bgColor }]}>
                                        <Text style={[styles.paymentBadgeText, { color: paymentBadge.color }]}>
                                            {paymentBadge.label}
                                        </Text>
                                    </View>
                                )}

                                {/* Payment Warning */}
                                {order.ongoing?.warning_message && (
                                    <View style={styles.warningBanner}>
                                        <Text style={styles.warningText}>
                                            ⚠️ {order.ongoing.warning_message}
                                        </Text>
                                    </View>
                                )}

                                {/* Order Amount */}
                                <View style={styles.amountRow}>
                                    <Text style={styles.amountLabel}>Total Amount</Text>
                                    <Text style={styles.amountValue}>₹{order.total_amount.toLocaleString('en-IN')}</Text>
                                </View>

                                {/* Expanded Details */}
                                {expandedOrder === order.id && (
                                    <View style={styles.expandedSection}>
                                        <Text style={styles.itemsTitle}>📦 Items:</Text>
                                        {order.order_items?.map((item: OrderItem) => (
                                            <View key={item.id} style={styles.itemRow}>
                                                <Text style={styles.itemName}>{item.product_name}</Text>
                                                <Text style={styles.itemQty}>×{item.quantity}</Text>
                                                <Text style={styles.itemPrice}>₹{item.subtotal}</Text>
                                            </View>
                                        ))}

                                        {/* Payment Details from order_ongoing */}
                                        {order.ongoing?.payment_data && (
                                            <View style={styles.paymentDetailsSection}>
                                                <Text style={styles.paymentDetailsTitle}>💳 Payment Details:</Text>
                                                {order.ongoing.payment_data.utr && (
                                                    <Text style={styles.paymentDetailLine}>
                                                        UTR: {order.ongoing.payment_data.utr}
                                                    </Text>
                                                )}
                                                {order.ongoing.payment_data.amount_paid != null && (
                                                    <Text style={styles.paymentDetailLine}>
                                                        Amount Paid: ₹{order.ongoing.payment_data.amount_paid}
                                                    </Text>
                                                )}
                                                {order.ongoing.payment_data.sender && (
                                                    <Text style={styles.paymentDetailLine}>
                                                        Sender: {order.ongoing.payment_data.sender}
                                                    </Text>
                                                )}
                                                {order.ongoing.payment_data.app && (
                                                    <Text style={styles.paymentDetailLine}>
                                                        App: {order.ongoing.payment_data.app}
                                                    </Text>
                                                )}
                                                {order.ongoing.payment_data.status && (
                                                    <Text style={styles.paymentDetailLine}>
                                                        Status: {order.ongoing.payment_data.status}
                                                    </Text>
                                                )}
                                            </View>
                                        )}

                                        {/* Payment Screenshot Link */}
                                        {order.ongoing?.screenshot_url && (
                                            <TouchableOpacity
                                                style={styles.screenshotLink}
                                                onPress={() => Linking.openURL(order.ongoing!.screenshot_url!)}>
                                                <Image
                                                    source={{ uri: order.ongoing.screenshot_url }}
                                                    style={styles.screenshotThumb}
                                                    resizeMode="cover"
                                                />
                                                <View style={styles.screenshotLinkTextBox}>
                                                    <Text style={styles.screenshotLinkTitle}>📸 Payment Screenshot</Text>
                                                    <Text style={styles.screenshotLinkSub}>Tap to view full image</Text>
                                                </View>
                                            </TouchableOpacity>
                                        )}

                                        {/* Action Buttons */}
                                        {order.status === 'pending' && (
                                            <View style={styles.actionButtons}>
                                                <TouchableOpacity
                                                    style={[styles.actionBtn, styles.rejectBtn]}
                                                    onPress={() => handleReject(order)}>
                                                    <FontAwesome name="times" size={18} color="#fff" />
                                                    <Text style={styles.actionBtnText}>Reject</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.actionBtn, styles.confirmBtn]}
                                                    onPress={() => handleConfirm(order)}>
                                                    <FontAwesome name="check" size={18} color="#fff" />
                                                    <Text style={styles.actionBtnText}>Confirm</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}

                                        {order.status === 'confirmed' && (
                                            <TouchableOpacity
                                                style={[styles.actionBtn, styles.completeBtn, { marginTop: 12 }]}
                                                onPress={() => handleComplete(order)}>
                                                <FontAwesome name="check-circle" size={18} color="#fff" />
                                                <Text style={styles.actionBtnText}>Mark Complete</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}

                                {/* Expand Indicator */}
                                <View style={styles.expandIndicator}>
                                    <FontAwesome
                                        name={expandedOrder === order.id ? 'chevron-up' : 'chevron-down'}
                                        size={12}
                                        color="#999"
                                    />
                                </View>
                            </TouchableOpacity>
                        );
                    })
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
    filterContainer: {
        backgroundColor: '#fff',
        paddingVertical: 12,
        paddingHorizontal: 8,
        maxHeight: 60,
    },
    filterButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginHorizontal: 4,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
    },
    filterButtonActive: {
        backgroundColor: '#FF6B35',
    },
    filterText: {
        fontSize: 14,
        color: '#666',
    },
    filterTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    ordersList: {
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
    orderCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: 'transparent',
    },
    customerInfo: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    customerName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    customerPhone: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    orderMeta: {
        alignItems: 'flex-end',
        backgroundColor: 'transparent',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#fff',
    },
    orderTime: {
        fontSize: 12,
        color: '#999',
        marginTop: 4,
    },
    // Payment tracking styles
    paymentBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        marginTop: 10,
    },
    paymentBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    warningBanner: {
        backgroundColor: '#FFF3E0',
        borderLeftWidth: 3,
        borderLeftColor: '#FF9800',
        padding: 10,
        borderRadius: 8,
        marginTop: 10,
    },
    warningText: {
        fontSize: 13,
        color: '#E65100',
    },
    amountRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        backgroundColor: 'transparent',
    },
    amountLabel: {
        fontSize: 14,
        color: '#666',
    },
    amountValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#4CAF50',
    },
    expandedSection: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        backgroundColor: 'transparent',
    },
    itemsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    itemRow: {
        flexDirection: 'row',
        paddingVertical: 6,
        backgroundColor: 'transparent',
    },
    itemName: {
        flex: 1,
        fontSize: 14,
        color: '#666',
    },
    itemQty: {
        width: 50,
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    },
    itemPrice: {
        width: 80,
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        textAlign: 'right',
    },
    // Payment details in expanded view
    paymentDetailsSection: {
        marginTop: 14,
        padding: 12,
        backgroundColor: '#F8F9FA',
        borderRadius: 10,
    },
    paymentDetailsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    paymentDetailLine: {
        fontSize: 13,
        color: '#555',
        marginBottom: 4,
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
        backgroundColor: 'transparent',
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        marginHorizontal: 4,
    },
    rejectBtn: {
        backgroundColor: '#F44336',
    },
    confirmBtn: {
        backgroundColor: '#4CAF50',
    },
    completeBtn: {
        backgroundColor: '#2196F3',
    },
    actionBtnText: {
        color: '#fff',
        fontWeight: '600',
        marginLeft: 8,
    },
    expandIndicator: {
        alignItems: 'center',
        marginTop: 8,
        backgroundColor: 'transparent',
    },
    // Screenshot styles
    screenshotLink: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F7FF',
        borderRadius: 12,
        padding: 10,
        marginTop: 14,
        borderWidth: 1,
        borderColor: '#D0E4FF',
    },
    screenshotThumb: {
        width: 56,
        height: 56,
        borderRadius: 8,
        backgroundColor: '#ddd',
    },
    screenshotLinkTextBox: {
        marginLeft: 12,
        flex: 1,
        backgroundColor: 'transparent',
    },
    screenshotLinkTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1976D2',
    },
    screenshotLinkSub: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
});
