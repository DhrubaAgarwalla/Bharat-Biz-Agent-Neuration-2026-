// Supabase Client Configuration
// Environment variables are loaded from app/.env (EXPO_PUBLIC_ prefix)

import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Shared Shop ID — used across all screens
export const SHOP_ID = process.env.EXPO_PUBLIC_SHOP_ID!;

// Only import AsyncStorage on native platforms (not during SSR)
let storage: any = undefined;
if (Platform.OS !== 'web' || typeof window !== 'undefined') {
    // Dynamic import workaround for SSR
    try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        storage = AsyncStorage;
    } catch (e) {
        console.log('AsyncStorage not available');
    }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: storage,
        autoRefreshToken: true,
        persistSession: Platform.OS !== 'web' || typeof window !== 'undefined',
        detectSessionInUrl: false,
    },
});

// Database Types
export interface ShopProfile {
    id: string;
    owner_phone: string;
    shop_name: string;
    owner_name: string;
    address?: string;
    upi_id?: string;
    gst_number?: string;
    qr_image_url?: string;
    created_at: string;
}

export interface Customer {
    id: string;
    shop_id: string;
    name: string;
    phone?: string;
    total_udhaar: number;
    created_at: string;
}

export interface Product {
    id: string;
    shop_id: string;
    name: string;
    name_hindi?: string;
    category?: string;
    price: number;
    stock: number;
    unit: string;
    low_stock_threshold: number;
    is_active: boolean;
    created_at: string;
}

export interface Order {
    id: string;
    shop_id: string;
    customer_id?: string;
    customer_name: string;
    customer_phone: string;
    status: 'pending' | 'confirmed' | 'rejected' | 'completed' | 'cancelled';
    payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
    total_amount: number;
    notes?: string;
    created_at: string;
    order_items?: OrderItem[];
}

export interface OrderItem {
    id: string;
    order_id: string;
    product_id?: string;
    product_name: string;
    quantity: number;
    unit: string;
    price: number;
    subtotal: number;
}

export interface Payment {
    id: string;
    shop_id: string;
    order_id?: string;
    customer_id?: string;
    amount: number;
    payment_method: string;
    screenshot_url?: string;
    status: 'pending' | 'paid' | 'failed' | 'refunded';
    verified_at?: string;
    notes?: string;
    created_at: string;
}

export interface Notification {
    id: string;
    shop_id: string;
    type: 'new_order' | 'payment_received' | 'low_stock' | 'payment_reminder' | 'system';
    title: string;
    body: string;
    data?: Record<string, any>;
    is_read: boolean;
    created_at: string;
}

export interface OrderOngoing {
    id: string;
    order_id?: string;
    customer_telegram_id: string;
    customer_name?: string;
    status: 'payment_pending' | 'payment_verified' | 'payment_warning' | 'confirmed' | 'completed' | 'rejected';
    items_json: Array<{ name: string; qty: number; unit: string; price: number }>;
    total_amount: number;
    payment_data?: {
        utr?: string;
        amount_paid?: number;
        sender?: string;
        app?: string;
        status?: string;
    };
    warning_message?: string;
    screenshot_url?: string;
    created_at: string;
    updated_at: string;
}
