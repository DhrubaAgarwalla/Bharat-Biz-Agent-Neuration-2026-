// Dashboard Screen - Shopkeeper Home
import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from '@/components/Themed';
import { supabase, Order, Product, Notification, SHOP_ID } from '@/lib/supabase';
import { recordQuickSale, recordQuickUdhaar } from '@/lib/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import LoadingScreen from '@/components/LoadingScreen';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { useLanguage } from '@/lib/i18n';

const { width } = Dimensions.get('window');

interface DashboardStats {
  todaySales: number;
  pendingOrders: number;
  lowStockCount: number;
  totalCustomers: number;
}

export default function DashboardScreen() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    pendingOrders: 0,
    lowStockCount: 0,
    totalCustomers: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Quick Sale/Udhaar Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'sale' | 'udhaar'>('sale');
  const [amount, setAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [itemName, setItemName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      // Fetch pending orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('shop_id', SHOP_ID)
        .eq('status', 'pending');

      // Fetch low stock products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('shop_id', SHOP_ID)
        .filter('stock', 'lte', 'low_stock_threshold');

      // Fetch today's sales from sales table
      const today = new Date().toISOString().split('T')[0];
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .eq('shop_id', SHOP_ID)
        .eq('sale_date', today)
        .single();

      // Fetch today's quick transactions (includes telegram sales)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: quickTxns } = await supabase
        .from('quick_transactions')
        .select('amount, type')
        .eq('shop_id', SHOP_ID)
        .gte('created_at', todayStart.toISOString());

      const quickSalesTotal = quickTxns
        ?.filter((tx) => tx.type === 'sale')
        .reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;

      // Fetch today's confirmed/completed order totals
      const { data: todayOrders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('shop_id', SHOP_ID)
        .in('status', ['confirmed', 'completed'])
        .gte('created_at', todayStart.toISOString());

      const orderSalesTotal = todayOrders?.reduce(
        (sum, o) => sum + Number(o.total_amount), 0
      ) || 0;

      // Fetch recent orders
      const { data: recent, error: recentError } = await supabase
        .from('orders')
        .select('*')
        .eq('shop_id', SHOP_ID)
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch customer count
      const { count: customerCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', SHOP_ID);

      // Total today's sales = sales table + quick transactions + telegram orders
      const totalTodaySales = (sales?.total_amount || 0) + quickSalesTotal + orderSalesTotal;

      setStats({
        todaySales: totalTodaySales,
        pendingOrders: orders?.length || 0,
        lowStockCount: products?.length || 0,
        totalCustomers: customerCount || 0,
      });

      setRecentOrders(recent || []);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 30 seconds
  useAutoRefresh(fetchDashboardData, { interval: 30000, refreshOnFocus: true });

  useEffect(() => {
    // Subscribe to realtime order updates
    const ordersSubscription = supabase
      .channel('orders-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      ordersSubscription.unsubscribe();
    };
  }, [fetchDashboardData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const openQuickModal = (type: 'sale' | 'udhaar') => {
    setModalType(type);
    setAmount('');
    setCustomerName('');
    setItemName('');
    setModalVisible(true);
  };

  const handleQuickSubmit = async () => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert(t('error'), t('valid_amount_error'));
      return;
    }
    if (modalType === 'udhaar' && !customerName.trim()) {
      Alert.alert(t('error'), t('customer_required'));
      return;
    }

    setSubmitting(true);
    try {
      if (modalType === 'sale') {
        await recordQuickSale(amountNum, customerName.trim() || undefined, itemName.trim() || undefined);
        Alert.alert(t('success'), `₹${amountNum} ${t('sale_recorded')}`);
      } else {
        await recordQuickUdhaar(customerName.trim(), amountNum, itemName.trim() || undefined);
        Alert.alert(t('success'), `₹${amountNum} ${t('udhaar_recorded')} ${customerName}!`);
      }
      setModalVisible(false);
      fetchDashboardData();
    } catch (error) {
      Alert.alert(t('error'), t('failed_record'));
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const StatCard = ({
    title,
    value,
    icon,
    colors,
    suffix = ''
  }: {
    title: string;
    value: number | string;
    icon: string;
    colors: string[];
    suffix?: string;
  }) => (
    <LinearGradient colors={colors as any} style={styles.statCard}>
      <FontAwesome name={icon as any} size={24} color="#fff" />
      <Text style={styles.statValue}>{value}{suffix}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </LinearGradient>
  );

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FFA500';
      case 'confirmed': return '#4CAF50';
      case 'completed': return '#2196F3';
      case 'rejected': return '#F44336';
      default: return '#888';
    }
  };

  // Show loading screen on first load
  if (loading) {
    return <LoadingScreen message="Loading dashboard..." />;
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B35']} />
      }>
      {/* Welcome Header */}
      <LinearGradient colors={['#FF6B35', '#FF8E53']} style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>{t('greeting')}</Text>
          <Text style={styles.shopName}>{t('shop_name')}</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('hi-IN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Text>
        </View>
      </LinearGradient>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          title={t('today_sales')}
          value={formatCurrency(stats.todaySales)}
          icon="rupee"
          colors={['#4CAF50', '#66BB6A']}
        />
        <StatCard
          title={t('pending_orders')}
          value={stats.pendingOrders}
          icon="clock-o"
          colors={['#FF9800', '#FFB74D']}
        />
        <StatCard
          title={t('low_stock')}
          value={stats.lowStockCount}
          icon="exclamation-triangle"
          colors={['#F44336', '#EF5350']}
        />
        <StatCard
          title={t('customers')}
          value={stats.totalCustomers}
          icon="users"
          colors={['#2196F3', '#42A5F5']}
        />
      </View>

      {/* Recent Orders */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('recent_orders')}</Text>
        {recentOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome name="inbox" size={48} color="#ccc" />
            <Text style={styles.emptyText}>{t('no_orders')}</Text>
          </View>
        ) : (
          recentOrders.map((order) => (
            <TouchableOpacity key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.customerNameText}>{order.customer_name}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                  <Text style={styles.statusText}>{order.status.toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.orderDetails}>
                <Text style={styles.orderAmount}>{formatCurrency(order.total_amount)}</Text>
                <Text style={styles.orderTime}>
                  {new Date(order.created_at).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Quick Actions - Only Quick Sale and Quick Udhaar */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('quick_actions')}</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionButton} onPress={() => openQuickModal('sale')}>
            <FontAwesome name="money" size={32} color="#4CAF50" />
            <Text style={styles.actionText}>{t('quick_sale')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => openQuickModal('udhaar')}>
            <FontAwesome name="credit-card" size={32} color="#FF9800" />
            <Text style={styles.actionText}>{t('quick_udhaar')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 20 }} />

      {/* Quick Sale/Udhaar Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalType === 'sale' ? t('quick_sale_title') : t('quick_udhaar_title')}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <FontAwesome name="times" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('amount')}</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder={t('enter_amount')}
                keyboardType="numeric"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                {t('customer_name')} {modalType === 'udhaar' ? '*' : t('optional')}
              </Text>
              <TextInput
                style={styles.input}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder={t('enter_customer_name')}
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('item_optional')}</Text>
              <TextInput
                style={styles.input}
                value={itemName}
                onChangeText={setItemName}
                placeholder={t('item_placeholder')}
                placeholderTextColor="#999"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: modalType === 'sale' ? '#4CAF50' : '#FF9800' }
              ]}
              onPress={handleQuickSubmit}
              disabled={submitting}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? t('saving') : modalType === 'sale' ? t('record_sale') : t('record_udhaar')}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 24,
    paddingTop: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    backgroundColor: 'transparent',
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  shopName: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  date: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    marginTop: 12,
    backgroundColor: 'transparent',
  },
  statCard: {
    width: (width - 48) / 2,
    margin: 6,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statTitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  orderCard: {
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginBottom: 8,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  customerNameText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
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
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    backgroundColor: 'transparent',
  },
  orderAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  orderTime: {
    fontSize: 14,
    color: '#888',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: 'transparent',
  },
  emptyText: {
    marginTop: 12,
    color: '#888',
    fontSize: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'transparent',
  },
  actionButton: {
    alignItems: 'center',
    padding: 16,
  },
  actionText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  submitButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
