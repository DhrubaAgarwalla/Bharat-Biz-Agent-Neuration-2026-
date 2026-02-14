// Supabase Edge Function for Sending Push Notifications
// Triggered via Database Webhook when a new notification is inserted

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

interface NotificationPayload {
    id: string
    shop_id: string
    type: string
    title: string
    body: string
    data?: Record<string, any>
}

serve(async (req) => {
    try {
        // Get request body
        const payload = await req.json()

        // Handle both direct calls and database webhook format
        const notification: NotificationPayload = payload.record || payload

        if (!notification.shop_id) {
            return new Response(
                JSON.stringify({ error: 'Missing shop_id' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            )
        }

        // Create Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Get push tokens for this shop
        const { data: tokens, error: tokenError } = await supabase
            .from('push_tokens')
            .select('expo_push_token')
            .eq('shop_id', notification.shop_id)
            .eq('is_active', true)

        if (tokenError) {
            console.error('Error fetching tokens:', tokenError)
            return new Response(
                JSON.stringify({ error: 'Failed to fetch push tokens' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            )
        }

        if (!tokens || tokens.length === 0) {
            console.log('No push tokens found for shop:', notification.shop_id)
            return new Response(
                JSON.stringify({ message: 'No push tokens found' }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        }

        // Prepare Expo push messages
        const messages = tokens.map(token => ({
            to: token.expo_push_token,
            sound: 'default',
            title: notification.title,
            body: notification.body,
            data: {
                ...notification.data,
                notification_id: notification.id,
                type: notification.type
            },
            channelId: 'orders', // Android notification channel
            priority: 'high',
        }))

        // Send to Expo Push Service
        const response = await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
        })

        const result = await response.json()
        console.log('Expo Push API response:', JSON.stringify(result))

        // Check for errors in tickets
        if (result.data) {
            for (const ticket of result.data) {
                if (ticket.status === 'error') {
                    console.error('Push ticket error:', ticket.message)

                    // If token is invalid, mark it as inactive
                    if (ticket.details?.error === 'DeviceNotRegistered') {
                        const invalidToken = messages.find((_, i) => result.data[i] === ticket)?.to
                        if (invalidToken) {
                            await supabase
                                .from('push_tokens')
                                .update({ is_active: false })
                                .eq('expo_push_token', invalidToken)
                        }
                    }
                }
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                sent_to: tokens.length,
                tickets: result.data
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Edge function error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
})
