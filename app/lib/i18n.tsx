// i18n - Hindi/English Language Support
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Lang = 'en' | 'hi';

interface I18nContextType {
    lang: Lang;
    setLang: (lang: Lang) => void;
    t: (key: string) => string;
}

const translations: Record<string, Record<Lang, string>> = {
    // Home Screen
    'greeting': { en: 'Hello! 🙏', hi: 'नमस्ते! 🙏' },
    'shop_name': { en: 'Sharma Kirana Store', hi: 'शर्मा किराना स्टोर' },
    'today_sales': { en: "Today's Sales", hi: 'आज की बिक्री' },
    'pending_orders': { en: 'Pending Orders', hi: 'लंबित ऑर्डर' },
    'low_stock': { en: 'Low Stock', hi: 'कम स्टॉक' },
    'customers': { en: 'Customers', hi: 'ग्राहक' },
    'recent_orders': { en: '📋 Recent Orders', hi: '📋 हाल के ऑर्डर' },
    'no_orders': { en: 'No orders yet', hi: 'अभी कोई ऑर्डर नहीं' },
    'quick_actions': { en: '⚡ Quick Actions', hi: '⚡ त्वरित कार्य' },
    'quick_sale': { en: 'Quick Sale', hi: 'त्वरित बिक्री' },
    'quick_udhaar': { en: 'Quick Udhaar', hi: 'त्वरित उधार' },
    'quick_sale_title': { en: '💰 Quick Sale', hi: '💰 त्वरित बिक्री' },
    'quick_udhaar_title': { en: '📝 Quick Udhaar', hi: '📝 त्वरित उधार' },
    'amount': { en: 'Amount (₹) *', hi: 'राशि (₹) *' },
    'enter_amount': { en: 'Enter amount', hi: 'राशि दर्ज करें' },
    'customer_name': { en: 'Customer Name', hi: 'ग्राहक का नाम' },
    'optional': { en: '(Optional)', hi: '(वैकल्पिक)' },
    'enter_customer_name': { en: 'Enter customer name', hi: 'ग्राहक का नाम दर्ज करें' },
    'item_optional': { en: 'Item (Optional)', hi: 'वस्तु (वैकल्पिक)' },
    'item_placeholder': { en: 'E.g., Rice 5kg, Milk', hi: 'जैसे, चावल 5kg, दूध' },
    'saving': { en: 'Saving...', hi: 'सहेज रहे हैं...' },
    'record_sale': { en: 'Record Sale', hi: 'बिक्री दर्ज करें' },
    'record_udhaar': { en: 'Record Udhaar', hi: 'उधार दर्ज करें' },

    // Tab Bar
    'tab_home': { en: 'Home', hi: 'होम' },
    'tab_orders': { en: 'Orders', hi: 'ऑर्डर' },
    'tab_stock': { en: 'Stock', hi: 'स्टॉक' },
    'tab_reports': { en: 'Reports', hi: 'रिपोर्ट' },
    'tab_profile': { en: 'Profile', hi: 'प्रोफ़ाइल' },

    // Reports Screen
    'today': { en: 'Today', hi: 'आज' },
    'this_week': { en: 'This Week', hi: 'इस सप्ताह' },
    'this_month': { en: 'This Month', hi: 'इस महीने' },
    'total_revenue': { en: 'Total Revenue', hi: 'कुल आय' },
    'payment_breakdown': { en: '💳 Payment Breakdown', hi: '💳 भुगतान विवरण' },
    'cash': { en: 'Cash', hi: 'नकद' },
    'upi': { en: 'UPI', hi: 'यूपीआई' },
    'credit_given': { en: 'Credit Given', hi: 'उधार दिया' },
    'pending_udhaar': { en: '⏳ Pending Udhaar', hi: '⏳ लंबित उधार' },
    'no_pending_debts': { en: 'No pending debts! 🎉', hi: 'कोई लंबित उधार नहीं! 🎉' },
    'remind': { en: 'Remind', hi: 'याद दिलाएं' },
    'total_pending': { en: 'Total Pending', hi: 'कुल लंबित' },
    'download_reports': { en: '📥 Download Reports', hi: '📥 रिपोर्ट डाउनलोड करें' },
    'sales_report_pdf': { en: 'Sales Report PDF', hi: 'बिक्री रिपोर्ट PDF' },
    'export_excel': { en: 'Export to Excel', hi: 'एक्सेल में निर्यात' },
    'sales_breakdown': { en: '📊 Sales Breakdown', hi: '📊 बिक्री विवरण' },
    'quick_sales': { en: 'Quick Sales', hi: 'त्वरित बिक्री' },
    'telegram_sales': { en: 'Telegram Sales', hi: 'टेलीग्राम बिक्री' },
    'udhaar_given': { en: 'Udhaar Given', hi: 'उधार दिया' },
    'order_sales': { en: 'Order Sales', hi: 'ऑर्डर बिक्री' },
    'orders_word': { en: 'orders', hi: 'ऑर्डर' },
    'avg': { en: 'Avg', hi: 'औसत' },

    // Notifications Screen
    'notifications': { en: '🔔 Notifications', hi: '🔔 सूचनाएं' },
    'mark_all_read': { en: 'Mark all read', hi: 'सभी पढ़ा गया' },
    'no_notifications': { en: 'No notifications yet', hi: 'अभी कोई सूचना नहीं' },
    'just_now': { en: 'Just now', hi: 'अभी' },
    'ago': { en: 'ago', hi: 'पहले' },

    // Profile Screen
    'language': { en: 'Language', hi: 'भाषा' },
    'switch_to_hindi': { en: 'हिंदी', hi: 'हिंदी' },
    'switch_to_english': { en: 'English', hi: 'English' },
    'current_language': { en: 'English', hi: 'हिंदी' },

    // Orders
    'orders_header': { en: '📋 Orders', hi: '📋 ऑर्डर' },
    'inventory_header': { en: '📦 Inventory', hi: '📦 इन्वेंट्री' },
    'reports_header': { en: '📊 Reports', hi: '📊 रिपोर्ट' },
    'profile_header': { en: '👤 Profile', hi: '👤 प्रोफ़ाइल' },
    'home_header': { en: '🏪 Bharat Biz-Agent', hi: '🏪 भारत बिज़-एजेंट' },

    // Alerts & Errors
    'error': { en: 'Error', hi: 'त्रुटि' },
    'success': { en: 'Success', hi: 'सफल' },
    'valid_amount_error': { en: 'Please enter a valid amount', hi: 'कृपया सही राशि दर्ज करें' },
    'customer_required': { en: 'Customer name is required for Udhaar', hi: 'उधार के लिए ग्राहक का नाम आवश्यक है' },
    'sale_recorded': { en: 'sale recorded!', hi: 'बिक्री दर्ज!' },
    'udhaar_recorded': { en: 'udhaar recorded for', hi: 'उधार दर्ज' },
    'failed_record': { en: 'Failed to record transaction', hi: 'लेनदेन रिकॉर्ड करने में विफल' },
    'done': { en: 'Done', hi: 'हो गया' },
    'all_marked_read': { en: 'All notifications marked as read', hi: 'सभी सूचनाएं पढ़ी गई' },
};

const I18nContext = createContext<I18nContextType>({
    lang: 'en',
    setLang: () => { },
    t: (key: string) => key,
});

const LANG_STORAGE_KEY = '@app_language';

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [lang, setLangState] = useState<Lang>('hi'); // Default Hindi

    useEffect(() => {
        // Load saved language preference
        AsyncStorage.getItem(LANG_STORAGE_KEY).then((saved) => {
            if (saved === 'en' || saved === 'hi') {
                setLangState(saved);
            }
        });
    }, []);

    const setLang = (newLang: Lang) => {
        setLangState(newLang);
        AsyncStorage.setItem(LANG_STORAGE_KEY, newLang);
    };

    const t = (key: string): string => {
        return translations[key]?.[lang] || key;
    };

    return (
        <I18nContext.Provider value={{ lang, setLang, t }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useLanguage() {
    return useContext(I18nContext);
}
