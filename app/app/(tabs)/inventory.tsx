// Inventory Screen - Manage products and stock
import React, { useEffect, useState } from 'react';
import {
    StyleSheet,
    ScrollView,
    RefreshControl,
    TouchableOpacity,
    TextInput,
    Modal,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import { supabase, Product, SHOP_ID } from '@/lib/supabase';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function InventoryScreen() {
    const [products, setProducts] = useState<Product[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    // Form State
    const [formName, setFormName] = useState('');
    const [formNameHindi, setFormNameHindi] = useState('');
    const [formCategory, setFormCategory] = useState('');
    const [formPrice, setFormPrice] = useState('');
    const [formStock, setFormStock] = useState('');
    const [formUnit, setFormUnit] = useState('pcs');
    const [formLowStock, setFormLowStock] = useState('5');

    const fetchProducts = async () => {
        try {
            let query = supabase
                .from('products')
                .select('*')
                .eq('shop_id', SHOP_ID)
                .order('name');

            if (searchQuery) {
                query = query.or(`name.ilike.%${searchQuery}%,name_hindi.ilike.%${searchQuery}%`);
            }

            const { data, error } = await query;
            if (error) throw error;
            setProducts(data || []);
        } catch (error) {
            console.error('Fetch products error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, [searchQuery]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchProducts();
        setRefreshing(false);
    };

    const openAddModal = () => {
        setEditingProduct(null);
        setFormName('');
        setFormNameHindi('');
        setFormCategory('');
        setFormPrice('');
        setFormStock('');
        setFormUnit('pcs');
        setFormLowStock('5');
        setModalVisible(true);
    };

    const openEditModal = (product: Product) => {
        setEditingProduct(product);
        setFormName(product.name);
        setFormNameHindi(product.name_hindi || '');
        setFormCategory(product.category || '');
        setFormPrice(product.price.toString());
        setFormStock(product.stock.toString());
        setFormUnit(product.unit);
        setFormLowStock(product.low_stock_threshold.toString());
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!formName || !formPrice) {
            Alert.alert('Error', 'Name and Price are required');
            return;
        }

        try {
            const productData = {
                shop_id: SHOP_ID,
                name: formName,
                name_hindi: formNameHindi || null,
                category: formCategory || null,
                price: parseFloat(formPrice),
                stock: parseInt(formStock) || 0,
                unit: formUnit,
                low_stock_threshold: parseInt(formLowStock) || 5,
            };

            if (editingProduct) {
                const { error } = await supabase
                    .from('products')
                    .update(productData)
                    .eq('id', editingProduct.id);
                if (error) throw error;
                Alert.alert('Success', 'Product updated!');
            } else {
                const { error } = await supabase
                    .from('products')
                    .insert(productData);
                if (error) throw error;
                Alert.alert('Success', 'Product added!');
            }

            setModalVisible(false);
            fetchProducts();
        } catch (error) {
            console.error('Save product error:', error);
            Alert.alert('Error', 'Failed to save product');
        }
    };

    const handleDelete = async (product: Product) => {
        Alert.alert(
            'Delete Product',
            `Are you sure you want to delete "${product.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('products')
                                .delete()
                                .eq('id', product.id);
                            if (error) throw error;
                            fetchProducts();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete product');
                        }
                    },
                },
            ]
        );
    };

    const updateStock = async (product: Product, delta: number) => {
        const newStock = Math.max(0, product.stock + delta);
        try {
            const { error } = await supabase
                .from('products')
                .update({ stock: newStock })
                .eq('id', product.id);
            if (error) throw error;

            // Update local state
            setProducts(products.map(p =>
                p.id === product.id ? { ...p, stock: newStock } : p
            ));
        } catch (error) {
            Alert.alert('Error', 'Failed to update stock');
        }
    };

    const isLowStock = (product: Product) => product.stock <= product.low_stock_threshold;

    const lowStockCount = products.filter(isLowStock).length;

    return (
        <View style={styles.container}>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <FontAwesome name="search" size={16} color="#999" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search products..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor="#999"
                />
                {searchQuery ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <FontAwesome name="times-circle" size={18} color="#999" />
                    </TouchableOpacity>
                ) : null}
            </View>

            {/* Low Stock Alert */}
            {lowStockCount > 0 && (
                <View style={styles.alertBanner}>
                    <FontAwesome name="exclamation-triangle" size={16} color="#F44336" />
                    <Text style={styles.alertText}>
                        {lowStockCount} product{lowStockCount > 1 ? 's' : ''} running low on stock!
                    </Text>
                </View>
            )}

            {/* Products List */}
            <ScrollView
                style={styles.productsList}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B35']} />
                }>
                {products.map((product) => (
                    <TouchableOpacity
                        key={product.id}
                        style={[styles.productCard, isLowStock(product) && styles.lowStockCard]}
                        onPress={() => openEditModal(product)}>
                        <View style={styles.productInfo}>
                            <View style={styles.productHeader}>
                                <Text style={styles.productName}>{product.name}</Text>
                                {isLowStock(product) && (
                                    <View style={styles.lowStockBadge}>
                                        <Text style={styles.lowStockText}>LOW</Text>
                                    </View>
                                )}
                            </View>
                            {product.name_hindi && (
                                <Text style={styles.productNameHindi}>{product.name_hindi}</Text>
                            )}
                            <Text style={styles.productCategory}>{product.category || 'Uncategorized'}</Text>
                            <Text style={styles.productPrice}>₹{product.price} / {product.unit}</Text>
                        </View>

                        <View style={styles.stockSection}>
                            <TouchableOpacity
                                style={styles.stockBtn}
                                onPress={() => updateStock(product, -1)}>
                                <FontAwesome name="minus" size={12} color="#F44336" />
                            </TouchableOpacity>

                            <View style={styles.stockDisplay}>
                                <Text style={[styles.stockValue, isLowStock(product) && styles.lowStockValue]}>
                                    {product.stock}
                                </Text>
                                <Text style={styles.stockUnit}>{product.unit}</Text>
                            </View>

                            <TouchableOpacity
                                style={styles.stockBtn}
                                onPress={() => updateStock(product, 1)}>
                                <FontAwesome name="plus" size={12} color="#4CAF50" />
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                ))}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Add Button */}
            <TouchableOpacity style={styles.fab} onPress={openAddModal}>
                <FontAwesome name="plus" size={24} color="#fff" />
            </TouchableOpacity>

            {/* Add/Edit Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingProduct ? 'Edit Product' : 'Add Product'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <FontAwesome name="times" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.formContainer}>
                            <Text style={styles.label}>Product Name *</Text>
                            <TextInput
                                style={styles.input}
                                value={formName}
                                onChangeText={setFormName}
                                placeholder="e.g. Rice 5kg"
                            />

                            <Text style={styles.label}>Hindi Name</Text>
                            <TextInput
                                style={styles.input}
                                value={formNameHindi}
                                onChangeText={setFormNameHindi}
                                placeholder="e.g. चावल 5kg"
                            />

                            <Text style={styles.label}>Category</Text>
                            <TextInput
                                style={styles.input}
                                value={formCategory}
                                onChangeText={setFormCategory}
                                placeholder="e.g. Grains, Pulses, Dairy"
                            />

                            <View style={styles.row}>
                                <View style={styles.halfInput}>
                                    <Text style={styles.label}>Price (₹) *</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formPrice}
                                        onChangeText={setFormPrice}
                                        placeholder="0"
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={styles.halfInput}>
                                    <Text style={styles.label}>Stock</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formStock}
                                        onChangeText={setFormStock}
                                        placeholder="0"
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                            <View style={styles.row}>
                                <View style={styles.halfInput}>
                                    <Text style={styles.label}>Unit</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formUnit}
                                        onChangeText={setFormUnit}
                                        placeholder="pcs, kg, litre"
                                    />
                                </View>
                                <View style={styles.halfInput}>
                                    <Text style={styles.label}>Low Stock Alert</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={formLowStock}
                                        onChangeText={setFormLowStock}
                                        placeholder="5"
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                                <Text style={styles.saveBtnText}>
                                    {editingProduct ? 'Update Product' : 'Add Product'}
                                </Text>
                            </TouchableOpacity>

                            {editingProduct && (
                                <TouchableOpacity
                                    style={styles.deleteBtn}
                                    onPress={() => {
                                        setModalVisible(false);
                                        handleDelete(editingProduct);
                                    }}>
                                    <Text style={styles.deleteBtnText}>Delete Product</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        margin: 16,
        paddingHorizontal: 16,
        borderRadius: 12,
        height: 48,
    },
    searchIcon: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
    },
    alertBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFEBEE',
        marginHorizontal: 16,
        marginBottom: 8,
        padding: 12,
        borderRadius: 8,
    },
    alertText: {
        marginLeft: 8,
        color: '#F44336',
        fontWeight: '500',
    },
    productsList: {
        flex: 1,
        paddingHorizontal: 16,
    },
    productCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    lowStockCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#F44336',
    },
    productInfo: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    productHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    productName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    lowStockBadge: {
        backgroundColor: '#F44336',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
    },
    lowStockText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    productNameHindi: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    productCategory: {
        fontSize: 12,
        color: '#999',
        marginTop: 4,
    },
    productPrice: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4CAF50',
        marginTop: 8,
    },
    stockSection: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    stockBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f0f0f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stockDisplay: {
        alignItems: 'center',
        marginHorizontal: 12,
        backgroundColor: 'transparent',
    },
    stockValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    lowStockValue: {
        color: '#F44336',
    },
    stockUnit: {
        fontSize: 10,
        color: '#999',
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FF6B35',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        backgroundColor: 'transparent',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    formContainer: {
        padding: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
        marginTop: 12,
    },
    input: {
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#333',
    },
    row: {
        flexDirection: 'row',
        marginHorizontal: -8,
    },
    halfInput: {
        flex: 1,
        marginHorizontal: 8,
    },
    saveBtn: {
        backgroundColor: '#FF6B35',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 24,
    },
    saveBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    deleteBtn: {
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#F44336',
    },
    deleteBtnText: {
        color: '#F44336',
        fontSize: 16,
        fontWeight: '600',
    },
});
