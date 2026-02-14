// Profile Screen - Shop details and settings
import React, { useEffect, useState } from 'react';
import {
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    Linking,
    Image,
    ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from '@/components/Themed';
import { supabase, ShopProfile, SHOP_ID } from '@/lib/supabase';
import { openShopkeeperBot } from '@/lib/api';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLanguage } from '@/lib/i18n';

export default function ProfileScreen() {
    const { lang, setLang, t } = useLanguage();
    const [profile, setProfile] = useState<ShopProfile | null>(null);
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(true);

    // Form fields
    const [shopName, setShopName] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [address, setAddress] = useState('');
    const [upiId, setUpiId] = useState('');
    const [gstNumber, setGstNumber] = useState('');
    const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
    const [uploadingQr, setUploadingQr] = useState(false);

    const fetchProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('shop_profiles')
                .select('*')
                .eq('id', SHOP_ID)
                .single();

            if (error) throw error;

            if (data) {
                setProfile(data);
                setShopName(data.shop_name || '');
                setOwnerName(data.owner_name || '');
                setAddress(data.address || '');
                setUpiId(data.upi_id || '');
                setGstNumber(data.gst_number || '');
                setQrImageUrl(data.qr_image_url || null);
            }
        } catch (error) {
            console.error('Fetch profile error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    const handleSave = async () => {
        try {
            const { error } = await supabase
                .from('shop_profiles')
                .update({
                    shop_name: shopName,
                    owner_name: ownerName,
                    address,
                    upi_id: upiId,
                    gst_number: gstNumber,
                })
                .eq('id', SHOP_ID);

            if (error) throw error;

            setEditing(false);
            fetchProfile();
            Alert.alert('Success', 'Profile updated successfully!');
        } catch (error) {
            console.error('Save profile error:', error);
            Alert.alert('Error', 'Failed to update profile');
        }
    };

    const MenuItem = ({ icon, title, subtitle, onPress, color = '#666' }: any) => (
        <TouchableOpacity style={styles.menuItem} onPress={onPress}>
            <View style={[styles.menuIcon, { backgroundColor: color + '20' }]}>
                <FontAwesome name={icon} size={20} color={color} />
            </View>
            <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{title}</Text>
                {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
            </View>
            <FontAwesome name="chevron-right" size={16} color="#ccc" />
        </TouchableOpacity>
    );

    const handleQrUpload = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Please allow access to your photo library');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (result.canceled) return;

            setUploadingQr(true);
            const uri = result.assets[0].uri;
            const fileName = `qr_${SHOP_ID}_${Date.now()}.jpg`;

            // Use FormData for React Native compatibility
            const formData = new FormData();
            formData.append('file', {
                uri: uri,
                name: fileName,
                type: 'image/jpeg',
            } as any);

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('shop-assets')
                .upload(fileName, formData, {
                    contentType: 'multipart/form-data',
                    upsert: true,
                });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('shop-assets')
                .getPublicUrl(fileName);

            const publicUrl = urlData.publicUrl;

            // Save to shop_profiles
            const { error: updateError } = await supabase
                .from('shop_profiles')
                .update({ qr_image_url: publicUrl })
                .eq('id', SHOP_ID);

            if (updateError) throw updateError;

            setQrImageUrl(publicUrl);
            Alert.alert('Success ✅', 'UPI QR code uploaded successfully!');
        } catch (error: any) {
            console.error('QR upload error:', error);
            Alert.alert('Error', error.message || 'Failed to upload QR code');
        } finally {
            setUploadingQr(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            {/* Profile Header */}
            <LinearGradient colors={['#FF6B35', '#FF8E53']} style={styles.header}>
                <View style={styles.avatarContainer}>
                    <FontAwesome name="building" size={40} color="#fff" />
                </View>
                <Text style={styles.shopNameHeader}>{profile?.shop_name || 'Your Shop'}</Text>
                <Text style={styles.ownerNameHeader}>{profile?.owner_name || 'Shop Owner'}</Text>
            </LinearGradient>

            {/* Shop Details */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>🏪 Shop Details</Text>
                    <TouchableOpacity onPress={() => setEditing(!editing)}>
                        <Text style={styles.editBtn}>{editing ? 'Cancel' : 'Edit'}</Text>
                    </TouchableOpacity>
                </View>

                {editing ? (
                    <View style={styles.formContainer}>
                        <Text style={styles.label}>Shop Name</Text>
                        <TextInput
                            style={styles.input}
                            value={shopName}
                            onChangeText={setShopName}
                            placeholder="Enter shop name"
                        />

                        <Text style={styles.label}>Owner Name</Text>
                        <TextInput
                            style={styles.input}
                            value={ownerName}
                            onChangeText={setOwnerName}
                            placeholder="Enter owner name"
                        />

                        <Text style={styles.label}>Address</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={address}
                            onChangeText={setAddress}
                            placeholder="Enter shop address"
                            multiline
                            numberOfLines={3}
                        />

                        <Text style={styles.label}>UPI ID</Text>
                        <TextInput
                            style={styles.input}
                            value={upiId}
                            onChangeText={setUpiId}
                            placeholder="yourname@upi"
                            autoCapitalize="none"
                        />

                        <Text style={styles.label}>GST Number (Optional)</Text>
                        <TextInput
                            style={styles.input}
                            value={gstNumber}
                            onChangeText={setGstNumber}
                            placeholder="22AAAAA0000A1Z5"
                            autoCapitalize="characters"
                        />

                        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                            <Text style={styles.saveBtnText}>Save Changes</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.detailsList}>
                        <View style={styles.detailRow}>
                            <FontAwesome name="home" size={18} color="#666" />
                            <Text style={styles.detailText}>{profile?.address || 'No address set'}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <FontAwesome name="phone" size={18} color="#666" />
                            <Text style={styles.detailText}>{profile?.owner_phone || 'No phone'}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <FontAwesome name="credit-card" size={18} color="#666" />
                            <Text style={styles.detailText}>{profile?.upi_id || 'No UPI ID set'}</Text>
                        </View>
                        {profile?.gst_number && (
                            <View style={styles.detailRow}>
                                <FontAwesome name="file-text" size={18} color="#666" />
                                <Text style={styles.detailText}>GST: {profile.gst_number}</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>

            {/* Quick Actions */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>

                <MenuItem
                    icon="telegram"
                    title="Open Shopkeeper Bot"
                    subtitle="Manage via Telegram"
                    color="#0088cc"
                    onPress={openShopkeeperBot}
                />

                <MenuItem
                    icon="qrcode"
                    title="Payment QR Code"
                    subtitle={qrImageUrl ? 'Tap to update QR image' : 'Upload your UPI QR image'}
                    color="#4CAF50"
                    onPress={handleQrUpload}
                />
                {uploadingQr && (
                    <View style={styles.qrUploadingContainer}>
                        <ActivityIndicator size="small" color="#4CAF50" />
                        <Text style={{ marginLeft: 8, color: '#666' }}>Uploading QR...</Text>
                    </View>
                )}
                {qrImageUrl && !uploadingQr && (
                    <View style={styles.qrPreviewContainer}>
                        <Image
                            source={{ uri: qrImageUrl }}
                            style={styles.qrPreviewImage}
                            resizeMode="contain"
                        />
                        <Text style={styles.qrPreviewLabel}>Current UPI QR Code</Text>
                    </View>
                )}

                <MenuItem
                    icon="download"
                    title="Export Data"
                    subtitle="Download sales & inventory data"
                    color="#2196F3"
                    onPress={() => Alert.alert('Coming Soon', 'Data export coming soon!')}
                />
            </View>

            {/* Language Toggle */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>🌐 {t('language')}</Text>
                <View style={styles.langToggleContainer}>
                    <TouchableOpacity
                        style={[
                            styles.langButton,
                            lang === 'en' && styles.langButtonActive,
                        ]}
                        onPress={() => setLang('en')}
                    >
                        <Text style={[
                            styles.langButtonText,
                            lang === 'en' && styles.langButtonTextActive,
                        ]}>English</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.langButton,
                            lang === 'hi' && styles.langButtonActive,
                        ]}
                        onPress={() => setLang('hi')}
                    >
                        <Text style={[
                            styles.langButtonText,
                            lang === 'hi' && styles.langButtonTextActive,
                        ]}>हिंदी</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* App Info */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>ℹ️ About</Text>

                <MenuItem
                    icon="info-circle"
                    title="App Version"
                    subtitle="1.0.0 (Neurathon 2026)"
                    color="#666"
                    onPress={() => { }}
                />

                <MenuItem
                    icon="question-circle"
                    title="Help & Support"
                    subtitle="Get help using the app"
                    color="#FF9800"
                    onPress={() => Linking.openURL('https://t.me/Neurathon_ShopKeeper_bot')}
                />
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
    header: {
        paddingTop: 40,
        paddingBottom: 30,
        alignItems: 'center',
    },
    avatarContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    shopNameHeader: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    ownerNameHeader: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.9)',
        marginTop: 4,
    },
    section: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: 16,
        padding: 16,
        borderRadius: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        backgroundColor: 'transparent',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    editBtn: {
        fontSize: 14,
        color: '#FF6B35',
        fontWeight: '600',
    },
    formContainer: {
        backgroundColor: 'transparent',
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
    textArea: {
        height: 80,
        textAlignVertical: 'top',
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
    detailsList: {
        backgroundColor: 'transparent',
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        backgroundColor: 'transparent',
    },
    detailText: {
        fontSize: 16,
        color: '#333',
        marginLeft: 12,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    menuIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuContent: {
        flex: 1,
        marginLeft: 12,
        backgroundColor: 'transparent',
    },
    menuTitle: {
        fontSize: 16,
        color: '#333',
    },
    menuSubtitle: {
        fontSize: 13,
        color: '#999',
        marginTop: 2,
    },
    langToggleContainer: {
        flexDirection: 'row',
        backgroundColor: '#f0f0f0',
        borderRadius: 12,
        padding: 4,
    },
    langButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 10,
    },
    langButtonActive: {
        backgroundColor: '#FF6B35',
        shadowColor: '#FF6B35',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    langButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
    },
    langButtonTextActive: {
        color: '#fff',
    },
    qrUploadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        backgroundColor: 'transparent',
    },
    qrPreviewContainer: {
        alignItems: 'center',
        paddingVertical: 16,
        backgroundColor: 'transparent',
    },
    qrPreviewImage: {
        width: 180,
        height: 180,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#4CAF50',
    },
    qrPreviewLabel: {
        marginTop: 8,
        fontSize: 13,
        color: '#4CAF50',
        fontWeight: '600',
    },
});
