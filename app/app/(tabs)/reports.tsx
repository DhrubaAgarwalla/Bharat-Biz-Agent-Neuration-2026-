// Reports Screen - Sales analytics and reports
import React, { useEffect, useState } from 'react';
import {
    StyleSheet,
    ScrollView,
    RefreshControl,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from '@/components/Themed';
import { supabase, SHOP_ID } from '@/lib/supabase';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLanguage } from '@/lib/i18n';

const { width } = Dimensions.get('window');

interface SalesData {
    date: string;
    total_orders: number;
    total_amount: number;
    cash_amount: number;
    upi_amount: number;
    credit_amount: number;
}

interface TopProduct {
    name: string;
    quantity: number;
    revenue: number;
}

interface CustomerDebt {
    name: string;
    phone: string;
    total_udhaar: number;
}

export default function ReportsScreen() {
    const { t } = useLanguage();
    const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
    const [salesData, setSalesData] = useState<SalesData[]>([]);
    const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
    const [pendingDebts, setPendingDebts] = useState<CustomerDebt[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalOrders: 0,
        avgOrderValue: 0,
        cashCollection: 0,
        upiCollection: 0,
        creditGiven: 0,
    });
    const [salesBreakdown, setSalesBreakdown] = useState({
        quickSales: 0,
        telegramSales: 0,
        udhaarGiven: 0,
        orderSales: 0,
    });

    const getDateRange = () => {
        const now = new Date();
        let startDate: Date;

        switch (period) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
        }

        return startDate.toISOString();
    };

    const fetchReports = async () => {
        try {
            const startDateISO = getDateRange();
            const startDate = startDateISO.split('T')[0];

            // Fetch sales data from sales table
            const { data: sales } = await supabase
                .from('sales')
                .select('*')
                .eq('shop_id', SHOP_ID)
                .gte('sale_date', startDate)
                .order('sale_date', { ascending: false });

            // Calculate stats from sales table
            const totalRevenue = sales?.reduce((sum, s) => sum + s.total_amount, 0) || 0;
            const totalOrders = sales?.reduce((sum, s) => sum + s.total_orders, 0) || 0;
            const cashCollection = sales?.reduce((sum, s) => sum + s.cash_amount, 0) || 0;
            const upiCollection = sales?.reduce((sum, s) => sum + s.upi_amount, 0) || 0;
            const creditGiven = sales?.reduce((sum, s) => sum + s.credit_amount, 0) || 0;

            // Fetch quick transactions for breakdown
            const { data: quickTxns } = await supabase
                .from('quick_transactions')
                .select('amount, type')
                .eq('shop_id', SHOP_ID)
                .gte('created_at', startDateISO);

            const quickSalesTotal = quickTxns
                ?.filter((tx) => tx.type === 'sale')
                .reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;

            const udhaarTotal = quickTxns
                ?.filter((tx) => tx.type === 'udhaar')
                .reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;

            // Fetch confirmed/completed orders (telegram sales)
            const { data: confirmedOrders } = await supabase
                .from('orders')
                .select('total_amount')
                .eq('shop_id', SHOP_ID)
                .in('status', ['confirmed', 'completed'])
                .gte('created_at', startDateISO);

            const telegramSalesTotal = confirmedOrders?.reduce(
                (sum, o) => sum + Number(o.total_amount), 0
            ) || 0;

            // Combined total revenue
            const combinedRevenue = totalRevenue + quickSalesTotal + telegramSalesTotal;
            const combinedOrders = totalOrders + (quickTxns?.filter(t => t.type === 'sale').length || 0) + (confirmedOrders?.length || 0);

            setStats({
                totalRevenue: combinedRevenue,
                totalOrders: combinedOrders,
                avgOrderValue: combinedOrders > 0 ? combinedRevenue / combinedOrders : 0,
                cashCollection,
                upiCollection,
                creditGiven,
            });

            setSalesBreakdown({
                quickSales: quickSalesTotal,
                telegramSales: telegramSalesTotal,
                udhaarGiven: udhaarTotal,
                orderSales: totalRevenue,
            });

            setSalesData(sales || []);

            // Fetch top customers with pending debt
            const { data: customers } = await supabase
                .from('customers')
                .select('name, phone, total_udhaar')
                .eq('shop_id', SHOP_ID)
                .gt('total_udhaar', 0)
                .order('total_udhaar', { ascending: false })
                .limit(5);

            setPendingDebts(customers || []);

        } catch (error) {
            console.error('Fetch reports error:', error);
        }
    };

    useEffect(() => {
        fetchReports();
    }, [period]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchReports();
        setRefreshing(false);
    };

    const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

    const PeriodButton = ({ value, label }: { value: typeof period; label: string }) => (
        <TouchableOpacity
            style={[styles.periodButton, period === value && styles.periodButtonActive]}
            onPress={() => setPeriod(value)}>
            <Text style={[styles.periodText, period === value && styles.periodTextActive]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    const StatCard = ({ title, value, color, icon }: any) => (
        <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
                <FontAwesome name={icon} size={20} color={color} />
            </View>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{title}</Text>
        </View>
    );

    const BreakdownCard = ({ title, value, color, icon }: any) => (
        <View style={styles.breakdownCard}>
            <View style={[styles.breakdownIcon, { backgroundColor: color + '15' }]}>
                <FontAwesome name={icon} size={18} color={color} />
            </View>
            <View style={styles.breakdownInfo}>
                <Text style={styles.breakdownTitle}>{title}</Text>
                <Text style={[styles.breakdownValue, { color }]}>{value}</Text>
            </View>
        </View>
    );

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B35']} />
            }>
            {/* Period Selector */}
            <View style={styles.periodSelector}>
                <PeriodButton value="today" label={t('today')} />
                <PeriodButton value="week" label={t('this_week')} />
                <PeriodButton value="month" label={t('this_month')} />
            </View>

            {/* Revenue Summary */}
            <LinearGradient colors={['#4CAF50', '#66BB6A']} style={styles.revenueCard}>
                <Text style={styles.revenueLabel}>{t('total_revenue')}</Text>
                <Text style={styles.revenueValue}>{formatCurrency(stats.totalRevenue)}</Text>
                <Text style={styles.revenueSubtext}>
                    {stats.totalOrders} {t('orders_word')} • {t('avg')} {formatCurrency(stats.avgOrderValue)}
                </Text>
            </LinearGradient>

            {/* Sales Breakdown */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('sales_breakdown')}</Text>
                <View style={styles.breakdownGrid}>
                    <BreakdownCard
                        title={t('quick_sales')}
                        value={formatCurrency(salesBreakdown.quickSales)}
                        color="#4CAF50"
                        icon="money"
                    />
                    <BreakdownCard
                        title={t('telegram_sales')}
                        value={formatCurrency(salesBreakdown.telegramSales)}
                        color="#0088cc"
                        icon="shopping-cart"
                    />
                    <BreakdownCard
                        title={t('udhaar_given')}
                        value={formatCurrency(salesBreakdown.udhaarGiven)}
                        color="#FF9800"
                        icon="credit-card"
                    />
                    <BreakdownCard
                        title={t('order_sales')}
                        value={formatCurrency(salesBreakdown.orderSales)}
                        color="#9C27B0"
                        icon="file-text-o"
                    />
                </View>
            </View>

            {/* Payment Breakdown */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('payment_breakdown')}</Text>
                <View style={styles.statsGrid}>
                    <StatCard
                        title={t('cash')}
                        value={formatCurrency(stats.cashCollection)}
                        color="#4CAF50"
                        icon="money"
                    />
                    <StatCard
                        title={t('upi')}
                        value={formatCurrency(stats.upiCollection)}
                        color="#2196F3"
                        icon="mobile"
                    />
                    <StatCard
                        title={t('credit_given')}
                        value={formatCurrency(stats.creditGiven)}
                        color="#FF9800"
                        icon="clock-o"
                    />
                </View>
            </View>

            {/* Pending Debts */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('pending_udhaar')}</Text>
                {pendingDebts.length === 0 ? (
                    <View style={styles.emptyState}>
                        <FontAwesome name="check-circle" size={48} color="#4CAF50" />
                        <Text style={styles.emptyText}>{t('no_pending_debts')}</Text>
                    </View>
                ) : (
                    pendingDebts.map((customer, index) => (
                        <View key={index} style={styles.debtCard}>
                            <View style={styles.debtInfo}>
                                <Text style={styles.debtName}>{customer.name}</Text>
                                <Text style={styles.debtPhone}>{customer.phone}</Text>
                            </View>
                            <View style={styles.debtAmount}>
                                <Text style={styles.debtValue}>{formatCurrency(customer.total_udhaar)}</Text>
                                <TouchableOpacity style={styles.remindBtn}>
                                    <FontAwesome name="telegram" size={16} color="#0088cc" />
                                    <Text style={styles.remindText}>{t('remind')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
                {pendingDebts.length > 0 && (
                    <View style={styles.totalDebt}>
                        <Text style={styles.totalDebtLabel}>{t('total_pending')}</Text>
                        <Text style={styles.totalDebtValue}>
                            {formatCurrency(pendingDebts.reduce((sum, d) => sum + d.total_udhaar, 0))}
                        </Text>
                    </View>
                )}
            </View>

            {/* Download Reports */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('download_reports')}</Text>
                <View style={styles.downloadGrid}>
                    <TouchableOpacity style={styles.downloadBtn}>
                        <FontAwesome name="file-pdf-o" size={24} color="#F44336" />
                        <Text style={styles.downloadText}>{t('sales_report_pdf')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.downloadBtn}>
                        <FontAwesome name="file-excel-o" size={24} color="#4CAF50" />
                        <Text style={styles.downloadText}>{t('export_excel')}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    periodSelector: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#fff',
    },
    periodButton: {
        flex: 1,
        paddingVertical: 10,
        marginHorizontal: 4,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
        alignItems: 'center',
    },
    periodButtonActive: {
        backgroundColor: '#FF6B35',
    },
    periodText: {
        fontSize: 14,
        color: '#666',
    },
    periodTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    revenueCard: {
        margin: 16,
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
    },
    revenueLabel: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
    },
    revenueValue: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#fff',
        marginVertical: 8,
    },
    revenueSubtext: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
    },
    section: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 16,
        borderRadius: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 16,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: 'transparent',
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
        padding: 8,
        backgroundColor: 'transparent',
    },
    statIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
    },
    // Sales Breakdown
    breakdownGrid: {
        backgroundColor: 'transparent',
    },
    breakdownCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
        backgroundColor: 'transparent',
    },
    breakdownIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    breakdownInfo: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginLeft: 12,
        backgroundColor: 'transparent',
    },
    breakdownTitle: {
        fontSize: 15,
        color: '#333',
        fontWeight: '500',
    },
    breakdownValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    emptyState: {
        alignItems: 'center',
        padding: 24,
        backgroundColor: 'transparent',
    },
    emptyText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
    debtCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        backgroundColor: 'transparent',
    },
    debtInfo: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    debtName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    debtPhone: {
        fontSize: 13,
        color: '#666',
        marginTop: 2,
    },
    debtAmount: {
        alignItems: 'flex-end',
        backgroundColor: 'transparent',
    },
    debtValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FF6B35',
    },
    remindBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    remindText: {
        fontSize: 12,
        color: '#0088cc',
        marginLeft: 4,
    },
    totalDebt: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 16,
        marginTop: 8,
        backgroundColor: 'transparent',
    },
    totalDebtLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    totalDebtValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#F44336',
    },
    downloadGrid: {
        flexDirection: 'row',
        backgroundColor: 'transparent',
    },
    downloadBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        marginHorizontal: 4,
        borderRadius: 12,
        backgroundColor: '#f5f5f5',
    },
    downloadText: {
        fontSize: 13,
        color: '#333',
        marginLeft: 8,
    },
});
