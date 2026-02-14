// API helper for Telegram Bot integration via n8n webhooks
import { supabase, SHOP_ID } from './supabase';
import { Linking, Alert } from 'react-native';

// Telegram Bot Links - Replace with your actual bot usernames
const CUSTOMER_BOT = 'Neurathon_Customer_bot';
const SHOPKEEPER_BOT = 'Neurathon_ShopKeeper_bot';

// Open Telegram Bot
export function openCustomerBot() {
    Linking.openURL(`https://t.me/${CUSTOMER_BOT}`);
}

export function openShopkeeperBot() {
    Linking.openURL(`https://t.me/${SHOPKEEPER_BOT}`);
}

// Order Actions - Direct database updates (no webhook needed for now)
export async function confirmOrder(orderId: string, customerName: string, totalAmount: number) {
    try {
        // Update order status
        const { error: orderError } = await supabase
            .from('orders')
            .update({ status: 'confirmed' })
            .eq('id', orderId);

        if (orderError) throw orderError;

        // Fetch order items to update stock
        const { data: orderItems, error: itemsError } = await supabase
            .from('order_items')
            .select('product_name, quantity')
            .eq('order_id', orderId);

        if (itemsError) {
            console.error('Error fetching order items:', itemsError);
        } else if (orderItems && orderItems.length > 0) {
            // Update stock for each product
            for (const item of orderItems) {
                // Find product by name and update stock
                const { data: product } = await supabase
                    .from('products')
                    .select('id, stock')
                    .eq('shop_id', SHOP_ID)
                    .ilike('name', item.product_name)
                    .single();

                if (product) {
                    const newStock = Math.max(0, product.stock - item.quantity);
                    await supabase
                        .from('products')
                        .update({ stock: newStock })
                        .eq('id', product.id);
                }
            }
        }

        // Update order_ongoing status to confirmed
        await supabase
            .from('order_ongoing')
            .update({ status: 'confirmed' })
            .eq('order_id', orderId);

        // Create notification for record
        const { error: notifError } = await supabase
            .from('notifications')
            .insert({
                shop_id: SHOP_ID,
                type: 'new_order',
                title: `✅ Order Confirmed`,
                body: `${customerName} का order confirm हुआ - ₹${totalAmount}`,
                data: { order_id: orderId },
            });

        return { success: true };
    } catch (error) {
        console.error('Confirm order error:', error);
        throw error;
    }
}

export async function rejectOrder(orderId: string, customerName: string) {
    try {
        const { error } = await supabase
            .from('orders')
            .update({ status: 'rejected' })
            .eq('id', orderId);

        if (error) throw error;

        // Update order_ongoing status to rejected
        await supabase
            .from('order_ongoing')
            .update({ status: 'rejected' })
            .eq('order_id', orderId);

        return { success: true };
    } catch (error) {
        console.error('Reject order error:', error);
        throw error;
    }
}

export async function completeOrder(orderId: string) {
    try {
        const { error } = await supabase
            .from('orders')
            .update({ status: 'completed', payment_status: 'paid' })
            .eq('id', orderId);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Complete order error:', error);
        throw error;
    }
}

// Send reminder via Telegram - opens the telegram bot with prefilled command
export function sendPaymentReminder(customerName: string, amount: number, customerPhone?: string) {
    // This will open the shopkeeper bot where they can ask to remind customer
    const message = `${customerName} को ${amount} का reminder भेजो`;
    // Note: Deep linking with prefilled message requires bot to be set up for it
    // For now, just open the bot
    openShopkeeperBot();
}

// Mark notification as read
export async function markNotificationRead(notificationId: string) {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Mark read error:', error);
        throw error;
    }
}

// Generate UPI payment link
export function generateUPILink(amount: number, customerName: string, orderId: string) {
    const upiId = 'sharmastore@upi'; // TODO: Get from shop profile
    const shopName = 'Sharma Kirana Store';
    const txnNote = `Order-${orderId.slice(0, 8)}`;

    return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${amount}&tn=${encodeURIComponent(txnNote)}&cu=INR`;
}

// Open UPI payment
export function openUPIPayment(amount: number, customerName: string, orderId: string) {
    const upiLink = generateUPILink(amount, customerName, orderId);
    Linking.canOpenURL(upiLink).then(supported => {
        if (supported) {
            Linking.openURL(upiLink);
        } else {
            Alert.alert('Error', 'No UPI app found. Please install GPay, PhonePe, or Paytm.');
        }
    });
}

// Add udhaar entry
export async function addUdhaar(customerId: string, amount: number, description: string) {
    try {
        const { error } = await supabase
            .from('udhaar_ledger')
            .insert({
                shop_id: SHOP_ID,
                customer_id: customerId,
                type: 'credit',
                amount,
                description,
            });

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Add udhaar error:', error);
        throw error;
    }
}

// Record payment
export async function recordPayment(customerId: string, amount: number, paymentMethod: string = 'Cash') {
    try {
        const { error } = await supabase
            .from('udhaar_ledger')
            .insert({
                shop_id: SHOP_ID,
                customer_id: customerId,
                type: 'payment',
                amount,
                description: paymentMethod,
            });

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Record payment error:', error);
        throw error;
    }
}

// Quick Sale for anonymous customers (amount required, customer name & item optional)
export async function recordQuickSale(amount: number, customerName?: string, itemName?: string) {
    try {
        const { error } = await supabase
            .from('quick_transactions')
            .insert({
                shop_id: SHOP_ID,
                type: 'sale',
                amount,
                customer_name: customerName || null,
                item_name: itemName || null,
                payment_method: 'cash'
            });

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Record quick sale error:', error);
        throw error;
    }
}

// Quick Udhaar for anonymous customers (name and amount required, item optional)
export async function recordQuickUdhaar(customerName: string, amount: number, itemName?: string) {
    try {
        const { error } = await supabase
            .from('quick_transactions')
            .insert({
                shop_id: SHOP_ID,
                type: 'udhaar',
                amount,
                customer_name: customerName,
                item_name: itemName || null
            });

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Record quick udhaar error:', error);
        throw error;
    }
}
