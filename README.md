# 🇮🇳 Bharat Biz-Agent

> **AI-Powered Commerce System for Indian Kirana Stores**
>
> A comprehensive, AI-driven platform that empowers Kirana (neighbourhood grocery) store owners to manage sales, inventory, orders, customer credit (udhaar), and invoicing — entirely through a mobile app and Telegram bots with **voice command support in Hindi/Hinglish/English**.

---

## 📑 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Mobile App (React Native / Expo)](#mobile-app-react-native--expo)
- [Database (Supabase / PostgreSQL)](#database-supabase--postgresql)
- [n8n Workflows (AI Agents & Automation)](#n8n-workflows-ai-agents--automation)
- [PDF Invoice API](#pdf-invoice-api)
- [Supabase Edge Functions](#supabase-edge-functions)
- [Environment Variables & Configuration](#environment-variables--configuration)
- [Setup & Installation](#setup--installation)
- [Key Features](#key-features)
- [Security Notes](#security-notes)

---

## Overview

**Bharat Biz-Agent** is built for the **Neurathon 2026** hackathon. It provides:

1. **Mobile App** — A React Native (Expo) app for the shopkeeper to manage the store via a rich dashboard, order management, inventory, reports, and profile settings.
2. **Customer Telegram Bot** — An AI-powered Telegram bot where customers can browse products, place orders, send UPI payment screenshots for verification, and receive invoices.
3. **Shopkeeper Telegram Bot** — A voice-first Telegram bot for the shopkeeper to manage stock, udhaar, orders, and sales by voice commands in Hindi/Hinglish.
4. **Order Confirmation Webhook** — An n8n workflow that notifies customers via Telegram when orders are confirmed or rejected from the mobile app.
5. **Invoice & QR Sub-workflow** — Generates PDF invoices and sends them along with shop UPI QR codes to customers via Telegram.
6. **PDF Invoice API** — A Node.js/Express server using Puppeteer to generate PDF invoices from HTML templates, with TinyURL shortening.
7. **Push Notifications** — A Supabase Edge Function that sends Expo push notifications to the shopkeeper's mobile device.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         BHARAT BIZ-AGENT                            │
├──────────────┬───────────────────┬─────────────────┬─────────────────┤
│  Mobile App  │  Telegram Bots    │  Invoice API    │  Edge Functions │
│  (Expo RN)   │  (n8n + Gemini)   │  (Express)      │  (Supabase)     │
├──────────────┴───────────────────┴─────────────────┴─────────────────┤
│                        Supabase (PostgreSQL)                        │
│        Realtime • Storage • Row Level Security • Webhooks           │
└──────────────────────────────────────────────────────────────────────┘
```

**Data Flow:**

```
Customer (Telegram)                     Shopkeeper (Mobile App)
       │                                        │
       ▼                                        ▼
  Customer Bot ──── order_ongoing ───── Orders Screen
  (n8n + Gemini)     (Supabase)         (React Native)
       │                                        │
       ▼                                        ▼
  Payment Screenshot ──→ AI OCR ──→ Verify ──→ Notification
       │                                        │
       ▼                                        ▼
  Invoice PDF ◄── Invoice API ◄── Order Confirm Webhook
  + UPI QR Code    (Puppeteer)     (n8n)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Mobile App** | React Native (Expo SDK), TypeScript, MaterialTopTabs |
| **Navigation** | `expo-router`, `@react-navigation/material-top-tabs` |
| **Backend DB** | Supabase (PostgreSQL), Realtime subscriptions |
| **AI / NLU** | Google Gemini 2.5 Flash (via n8n LangChain nodes) |
| **Automation** | n8n (self-hosted workflow engine) |
| **Telegram** | Telegram Bot API (via n8n nodes) |
| **Voice** | Gemini Audio transcription (Hindi/Hinglish support) |
| **Invoice** | Node.js + Express + Puppeteer (HTML→PDF) |
| **URL Shortening** | TinyURL API |
| **Push Notifications** | Expo Push API + Supabase Edge Functions (Deno) |
| **Storage** | Supabase Storage (shop-assets, payment-screenshots) |
| **i18n** | Custom React Context (English + Hindi) |

---

## Project Structure

```
neurathon-final/
├── app/                          # React Native Expo mobile app
│   ├── app/
│   │   ├── _layout.tsx           # Root layout (fonts, splash, push notifs, realtime)
│   │   ├── notifications.tsx     # Full notifications screen
│   │   └── (tabs)/
│   │       ├── _layout.tsx       # MaterialTopTabs layout + header with bell icon
│   │       ├── index.tsx         # Dashboard (stats, recent orders, quick sale/udhaar)
│   │       ├── orders.tsx        # Order management (filter, confirm, reject, complete)
│   │       ├── inventory.tsx     # Product CRUD (search, stock +/-, add/edit modal)
│   │       ├── reports.tsx       # Sales analytics (period selectors, breakdowns)
│   │       └── profile.tsx       # Shop details, QR upload, language toggle
│   ├── components/
│   │   ├── Themed.tsx            # Theme-aware Text/View wrapper
│   │   ├── LoadingScreen.tsx     # Loading spinner component
│   │   └── ...
│   ├── hooks/
│   │   └── useAutoRefresh.ts     # Auto-refresh + focus-refresh hook
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client + TypeScript interfaces
│   │   ├── api.ts                # API helpers (confirm/reject orders, quick sale/udhaar)
│   │   ├── i18n.tsx              # Internationalization context (EN/HI)
│   │   └── notifications.ts     # Push notification registration & listeners
│   ├── app.json                  # Expo configuration
│   └── package.json
│
├── database/
│   ├── supabase_schema.sql       # Full database schema (10+ tables)
│   └── migrations/
│       ├── add_order_ongoing.sql         # order_ongoing table for lifecycle tracking
│       ├── quick_transactions.sql        # Quick sale/udhaar transactions
│       ├── add_telegram_id_to_customers.sql  # telegram_id + address columns
│       ├── add_qr_image.sql              # QR image URL + storage bucket
│       └── add_screenshot_storage.sql    # Payment screenshot storage
│
├── pdf-invoice-api/
│   ├── server.js                 # Express server (Puppeteer PDF generation)
│   ├── templates/
│   │   └── invoice.html          # Invoice HTML template (bilingual)
│   ├── package.json
│   └── README.md                 # VPS setup guide (Ubuntu/systemd)
│
├── supabase/
│   └── functions/
│       └── send-push-notification/
│           └── index.ts          # Edge function: push via Expo API
│
└── workflows/
    ├── customer_telegram_bot.json       # AI Customer Agent (1221 lines)
    ├── shopkeeper_telegram_bot.json     # AI Owner Agent (751 lines)
    ├── order_confirmation_webhook.json  # Order status → Telegram (532 lines)
    └── send_invoice_and_qr.json        # Invoice PDF + QR sub-workflow (216 lines)
```

---

## Mobile App (React Native / Expo)

### Root Layout (`_layout.tsx`)

- Loads custom fonts (SpaceMono)
- Manages splash screen lifecycle
- Registers Expo Push Notifications on mount
- Sets up realtime Supabase notification listeners
- Wraps entire app in `LanguageProvider` for i18n and `GestureHandlerRootView` for swipe gestures

### Tab Navigation (`(tabs)/_layout.tsx`)

- Uses **MaterialTopTabBar** positioned at the bottom, enabling **swipe gesture page transitions**
- Custom global header with dynamic title per tab and a **notification bell icon** with a real-time unread badge count
- Tabs: **Dashboard** | **Orders** | **Inventory** | **Reports** | **Profile**
- Notification bell navigates to `/notifications`

### Screens

#### 🏠 Dashboard (`index.tsx`)
- **Stats Grid**: Today's sales (₹), pending orders, low stock alerts, total customers
- **Recent Orders**: Last 5 orders with status badges and payment info
- **Quick Action Buttons**: "Quick Sale" and "Record Udhaar" modals
- **Quick Sale Modal**: Amount, optional customer name, optional item name → records to `quick_transactions` table
- **Quick Udhaar Modal**: Amount, customer name (required), item name → records to `quick_transactions` table
- Auto-refreshes every 30 seconds via `useAutoRefresh` hook

#### 📦 Orders (`orders.tsx`)
- **Filter Tabs**: Pending | Confirmed | Completed | Rejected | All
- **Order Cards** with customer name, phone, status badge, time ago, total amount
- **Payment Tracking** via `order_ongoing` table — shows payment badges (PAID, MISMATCH, AWAITING, COMPLETED, CONFIRMED)
- **Payment Warning Banners** for amount mismatches
- **Expandable Details**: Order items, payment details (UTR, amount paid, sender, app, status), payment screenshot thumbnail (tappable)
- **Action Buttons**: Confirm ✓ / Reject ✗ (pending), Mark Complete (confirmed)
- Realtime subscriptions on both `orders` and `order_ongoing` tables
- Auto-refreshes every 30 seconds

#### 📋 Inventory (`inventory.tsx`)
- **Search Bar** with clear button (searches English + Hindi product names)
- **Low Stock Alert Banner** with count of low-stock products
- **Product Cards**: Name (English + Hindi), category, price/unit, stock +/− buttons with instant update
- **Low Stock Indicator**: Red left border + "LOW" badge on cards
- **FAB (+)** to add new products
- **Add/Edit Modal**: Product name, Hindi name, category, price, stock, unit, low stock threshold
- **Delete** option in edit mode with confirmation dialog

#### 📊 Reports (`reports.tsx`)
- **Period Selector**: Today | This Week | This Month
- **Revenue Summary Card** (LinearGradient): Total revenue, order count, average order value
- **Sales Breakdown**: Quick Sales, Telegram Sales, Udhaar Given, Order Sales — each with icon and color
- **Payment Breakdown**: Cash, UPI, Credit Given
- **Pending Udhaar Section**: Top 5 customers with highest debt, phone, total udhaar, "Remind" button (Telegram icon)
- **Download Reports** section (PDF / Excel — placeholder)

#### 👤 Profile (`profile.tsx`)
- **Profile Header** (LinearGradient): Shop name, owner name, building icon
- **Shop Details** (view/edit mode): Address, phone, UPI ID, GST number
- **Quick Actions**: Open Shopkeeper Bot (Telegram deep link), Upload UPI QR Code (image picker → Supabase Storage), Export Data (coming soon)
- **Language Toggle**: English / हिंदी switch with AsyncStorage persistence
- **About**: App version (1.0.0), Help & Support (Telegram link)

#### 🔔 Notifications (`notifications.tsx`)
- Full-screen notification list (not a tab, navigated from header bell)
- Type-based icons and colors: new_order (green cart), payment_received (blue money), low_stock (red warning), payment_reminder (orange clock)
- Unread indicator: Left orange border + dot
- **Mark All Read** button
- Tap to mark read + navigate to relevant tab (Orders / Inventory)
- Realtime subscription for new notifications

### Core Libraries

#### `supabase.ts`
- Supabase client initialized with URL + Anon Key
- Uses `expo-secure-store` for auth token persistence
- TypeScript interfaces for all database tables: `ShopProfile`, `Product`, `Customer`, `Order`, `OrderItem`, `OrderOngoing`, `Payment`, `UdhaarEntry`, `SalesData`, `Notification`, `QuickTransaction`

#### `api.ts`
- `confirmOrder(orderId, customerName, totalAmount)` — Updates order status + calls n8n webhook
- `rejectOrder(orderId, customerName)` — Updates order status + calls n8n webhook + deducts stock
- `generateUpiPayment(amount, upiId)` — Opens UPI deep link
- `openShopkeeperBot()` / `openCustomerBot()` — Telegram deep links
- `recordQuickSale(...)` / `recordQuickUdhaar(...)` — Inserts into `quick_transactions`
- `markNotificationRead(id)` — Updates notification

#### `i18n.tsx`
- `LanguageProvider` React Context with `lang`, `setLang`, `t()` function
- Supports `'en'` and `'hi'` languages
- 50+ translation keys covering all UI labels
- Language preference saved to `AsyncStorage`

#### `notifications.ts`
- `registerForPushNotifications()` — Gets Expo push token, saves to Supabase `push_tokens` table
- `setupNotificationListeners()` — Handles foreground/background/tap interactions
- `sendLocalNotification(title, body)` — Local fallback
- `setupRealtimeNotifications(shopId)` — Supabase Realtime listener on `notifications` table, triggers local notifications

#### `useAutoRefresh.ts` hook
- Accepts a callback, interval (default 30s), and `refreshOnFocus` flag
- Calls callback on mount, on interval, and on screen focus events

---

## Database (Supabase / PostgreSQL)

### Core Schema (`supabase_schema.sql`)

| Table | Purpose | Key Columns |
|---|---|---|
| `shop_profiles` | Store details | id, owner_phone, shop_name, address, upi_id, gst_number, qr_image_url |
| `customers` | Customer records | id, shop_id, name, phone, telegram_id, address, total_udhaar |
| `products` | Inventory | id, shop_id, name, name_hindi, category, price, stock, unit, low_stock_threshold |
| `orders` | Customer orders | id, shop_id, customer_name, customer_phone, status, payment_status, total_amount, notes |
| `order_items` | Line items per order | id, order_id, product_name, quantity, unit, price, subtotal (generated) |
| `order_ongoing` | Order lifecycle tracking | id, order_id, customer_telegram_id, status, items_json, total_amount, payment_data, warning_message, screenshot_url |
| `payments` | Payment records | id, order_id, amount, method, upi_screenshot_url |
| `udhaar_ledger` | Credit/debit ledger | id, shop_id, customer_id, type (credit/payment), amount, description |
| `sales` | Daily sales summary | id, shop_id, sale_date, total_orders, total_amount, cash_amount, upi_amount, credit_amount |
| `notifications` | Push notification records | id, shop_id, type, title, body, data, is_read |
| `push_tokens` | Expo push tokens | id, shop_id, token, device_info, is_active |
| `quick_transactions` | Quick sale/udhaar entries | id, shop_id, type, amount, customer_name, item_name, payment_method |

### Database Features

- **Triggers**: `update_updated_at()` on most tables, auto-calculates `subtotal` on `order_items`, auto-updates `total_udhaar` on `customers` when udhaar_ledger changes
- **Row Level Security**: Enabled on all tables (currently `USING (true)` — needs tightening for production)
- **Realtime**: Enabled for `orders`, `order_ongoing`, `notifications`, `products`
- **Storage Buckets**: `shop-assets` (UPI QR codes), `payment-screenshots` (payment proof images)
- **Unique Indexes**: `customers(shop_id, telegram_id)` for Telegram customer identification

### Migrations

| File | Description |
|---|---|
| `add_order_ongoing.sql` | Creates `order_ongoing` table with indexes, RLS, realtime, auto-update trigger |
| `quick_transactions.sql` | Creates `quick_transactions` table for anonymous sales/udhaar |
| `add_telegram_id_to_customers.sql` | Adds `telegram_id` and `address` columns to customers, unique index |
| `add_qr_image.sql` | Adds `qr_image_url` to `shop_profiles`, creates `shop-assets` storage bucket with public policies |
| `add_screenshot_storage.sql` | Adds `screenshot_url` to `order_ongoing`, creates `payment-screenshots` storage bucket |

---

## n8n Workflows (AI Agents & Automation)

### 1. Customer Telegram Bot (`customer_telegram_bot.json`)

**Purpose**: AI-powered shopping assistant for customers via Telegram.

**Flow**:
```
Telegram Trigger → Is Photo? ──[Yes]─→ Get Photo → Upload Screenshot → Analyze (Gemini OCR) → Format
                              └─[No]──→ Is Voice? ──[Yes]─→ Get Voice → Transcribe (Gemini) → Format
                                                   └─[No]──→ Format Text
                         ↓
                   Merge Messages → Fetch Store Info → Combine → AI Customer Agent → Send Response
```

**AI Agent Tools** (Supabase operations):
| Tool | Operation |
|---|---|
| Check Customer | Read `customers` by telegram_id |
| Register Customer | Create in `customers` |
| Read Products | Search `products` by name (ilike) |
| Create Order Ongoing | Insert into `order_ongoing` (pre-payment) |
| Read Order Ongoing | Get pending order by telegram_id |
| Update Order Ongoing | Update status, payment_data, screenshot_url |
| Create Order | Insert into `orders` (post-payment) |
| Create Order Item | Insert into `order_items` |
| Read Orders | Get customer's orders |
| Send Notification | Create notification for shopkeeper |
| Send Invoice and Payment QR | Calls sub-workflow |
| Get Shop QR | Reads shop QR image URL |

**Key Behaviors**:
- Registers new customers (name, phone, address)
- Shows products with prices and emojis
- Creates `order_ongoing` record before payment (status: `payment_pending`)
- Sends invoice PDF + UPI QR code via sub-workflow
- Uses Gemini to analyze payment screenshot OCR → extracts UTR, amount, sender, app, status
- Compares payment amount with expected → sets `payment_verified` or `payment_warning`
- Creates final order only AFTER payment screenshot is received
- Conversation memory per chat_id (20 messages window)
- Temperature: 0.7

### 2. Shopkeeper Telegram Bot (`shopkeeper_telegram_bot.json`)

**Purpose**: Voice-first management bot for the shop owner.

**Flow**:
```
Telegram Trigger → Is Voice? ──[Yes]─→ Get Voice → Transcribe (Gemini) → Format
                              └─[No]──→ Format Text
                         ↓
                   Merge Messages → AI Owner Agent → Send Response
```

**AI Agent Tools**:
| Tool | Operation |
|---|---|
| Read Products | Search products by name |
| Update Product Stock | Change stock quantity |
| Search Customer | Find customer by name |
| Create Customer | Add new customer |
| Add Udhaar | Record credit (udhaar_ledger) |
| Record Payment | Record payment received (udhaar_ledger) |
| Get Pending Udhaar | List all customers with pending credit |
| Read Orders | Get orders by status |
| Update Order | Change order status |
| Read Sales | Get sales data |

**Key Behaviors**:
- Supports Hindi/Hinglish voice commands (e.g., "Rice ka stock?", "Amit ko 200 ka udhaar likho")
- Inventory management, sales reports, udhaar tracking, order management
- Conversation memory per owner chat_id (30 messages window)
- Temperature: 0.5 (more deterministic than customer bot)

### 3. Order Confirmation Webhook (`order_confirmation_webhook.json`)

**Purpose**: When the shopkeeper confirms/rejects an order from the mobile app, this workflow notifies the customer on Telegram.

**Flow (Confirmed)**:
```
POST Webhook → Is Confirmed? → Get Order Ongoing → Extract Chat ID → Fetch Items
  → Generate PAID Invoice (PDF API) → Mark Ongoing Completed
  → Send Confirmation to Customer (Telegram)
  → Download Invoice PDF → Send as Document (Telegram)
```

**Flow (Rejected)**:
```
POST Webhook → Is Rejected? → Get Order Ongoing (Reject) → Extract Chat ID
  → Mark Ongoing Rejected → Send Rejection to Customer (Telegram)
```

**Triggered by**: `api.ts` → `confirmOrder()` / `rejectOrder()` which POST to the n8n webhook.

### 4. Send Invoice and QR (`send_invoice_and_qr.json`)

**Purpose**: Sub-workflow called by the Customer Bot to generate and send invoice + QR.

**Flow**:
```
Called by Another Workflow ──→ Generate Invoice API (PDF) → Download PDF → Send PDF (Telegram)
                            └─→ Get Shop QR (Supabase) → Download QR Image → Send Photo (Telegram)
```

Two parallel paths: one for the invoice PDF, one for the shop's UPI QR code image.

---

## PDF Invoice API

### Server (`pdf-invoice-api/server.js`)

- **Framework**: Express.js (Port 3001)
- **PDF Generation**: Puppeteer (headless Chromium) renders HTML template → PDF
- **Template**: `templates/invoice.html` with placeholder substitution
- **URL Shortening**: TinyURL API shortens the hosted PDF URL
- **Endpoints**:
  - `POST /api/invoice/generate` — Generates invoice PDF, returns `{ original_url, short_url }`
  - `GET /invoices/:filename` — Serves static PDF files
- **Auto-cleanup**: Optional cron to delete PDFs older than 7 days

### Invoice Template

- Bilingual labels (English/Hindi)
- Shop and customer details
- Itemized table with quantity, unit price, subtotal
- Payment status (PAID ✅ / UNPAID)
- UPI ID and thank-you message
- Professional styling with system fonts

### Deployment

See `pdf-invoice-api/README.md` for full Ubuntu VPS setup:
- Node.js 20.x installation
- Chromium dependencies
- systemd service configuration
- `ufw` firewall rules
- Puppeteer environment variables

---

## Supabase Edge Functions

### `send-push-notification/index.ts`

- **Runtime**: Deno (Supabase Edge Functions)
- **Trigger**: Supabase Database Webhook on `notifications` INSERT
- **Process**:
  1. Receives webhook payload with new notification record
  2. Creates Supabase admin client with Service Role Key
  3. Fetches active `push_tokens` for the notification's `shop_id`
  4. Sends push notifications via [Expo Push API](https://exp.host/--/api/v2/push/send)
  5. Handles `DeviceNotRegistered` errors by deactivating stale tokens
- **Environment Variables**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

## Environment Variables & Configuration

### Mobile App (`app/lib/supabase.ts`)

| Variable | Current Status | Description |
|---|---|---|
| `SUPABASE_URL` | Hardcoded | Supabase project URL |
| `SUPABASE_ANON_KEY` | Hardcoded | Supabase anonymous key |
| `SHOP_ID` | Hardcoded across screens | `c1b7bdf8-5661-4bdb-bfb3-ad11fff0adc4` |

> ⚠️ **These should be migrated to environment variables for production.**

### PDF Invoice API

| Variable | Default | Description |
|---|---|---|
| `PORT` | 3001 | Server port |
| `HOST` | 0.0.0.0 | Bind address |

### Supabase Edge Functions

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (full access) |

### n8n Workflows

- Store Telegram bot API credentials in n8n credential manager
- Store Supabase API credentials in n8n credential manager
- Store Google Gemini API key in n8n credential manager

---

## Setup & Installation

### Prerequisites

- Node.js 20+
- npm / yarn
- Expo CLI (`npm install -g expo-cli`)
- Supabase account + project
- n8n instance (self-hosted or cloud)
- Telegram bots (create via @BotFather)
- Google Gemini API key

### 1. Mobile App

```bash
cd app
npm install
npx expo start
```

Scan the QR code with Expo Go (Android/iOS) or run on emulator.

### 2. Database Setup

1. Create a Supabase project
2. Run `database/supabase_schema.sql` in the SQL editor
3. Run each migration in `database/migrations/` in order
4. Create storage buckets: `shop-assets` (public) and `payment-screenshots` (public)
5. Configure Database Webhook: `notifications` INSERT → `send-push-notification` Edge Function

### 3. PDF Invoice API

```bash
cd pdf-invoice-api
npm install
node server.js
```

For production deployment, see `pdf-invoice-api/README.md`.

### 4. Supabase Edge Functions

```bash
supabase functions deploy send-push-notification
supabase secrets set SUPABASE_URL=<your-url> SUPABASE_SERVICE_ROLE_KEY=<your-key>
```

### 5. n8n Workflows

1. Import each JSON from `workflows/` into your n8n instance
2. Configure credentials: Telegram Bot (customer + shopkeeper), Supabase, Google Gemini
3. Activate all 4 workflows

---

## Key Features

### 🤖 AI-Powered Bots
- **Natural Language Understanding** via Google Gemini 2.5 Flash
- **Voice commands** in Hindi/Hinglish/English (Gemini audio transcription)
- **Payment screenshot OCR** (Gemini image analysis) — auto-extracts UTR, amount, sender, app
- **Conversational memory** per user session (20-30 message window)

### 📱 Mobile App
- **Real-time updates** via Supabase Realtime (orders, products, notifications)
- **Push notifications** via Expo Push API + Supabase Edge Functions
- **Swipe navigation** with MaterialTopTabs
- **Bilingual UI** (English / हिंदी) with persistent language preference
- **Quick sale/udhaar** recording for walk-in customers
- **Stock management** with low-stock alerts and +/- buttons
- **UPI QR code upload** via image picker + Supabase Storage

### 💳 Payment Flow
1. Customer adds items to cart via Telegram bot
2. Bot creates `order_ongoing` (payment_pending) + sends invoice PDF + UPI QR code
3. Customer sends payment screenshot
4. Gemini OCR extracts payment details
5. Bot verifies amount match → creates order → notifies shopkeeper
6. Shopkeeper confirms/rejects from mobile app
7. Customer receives confirmation + paid invoice via Telegram

### 📊 Business Analytics
- Period-based reports (today/week/month)
- Sales breakdown by source (quick, Telegram, order, udhaar)
- Payment breakdown (cash, UPI, credit)
- Pending udhaar tracking with reminder button
- Top debtor customers list

### 📄 Invoice System
- Auto-generated PDF invoices via Puppeteer
- Bilingual template (English + Hindi labels)
- Sent as Telegram document + shortened URL
- Generated on order creation AND on confirmation

---

## Security Notes

> [!WARNING]
> The following items need to be addressed before production deployment:

1. **RLS Policies**: All tables use `USING (true)` — must be tightened to restrict access based on `shop_id` ownership
2. **Hardcoded Credentials**: Supabase URL and Anon Key are hardcoded in `supabase.ts` — should use environment variables
3. **Hardcoded Shop ID**: `SHOP_ID` constant is repeated across all screen files — should come from authenticated user session
4. **Service Role Key**: Used in Edge Function — ensure it's properly set as environment secret, never client-side
5. **Storage Policies**: Storage buckets have public read/write — should be restricted in production
6. **API Keys in Workflows**: n8n workflow JSONs contain credential IDs — ensure n8n instance is properly secured

---

## License

Built for **Neurathon 2026** Hackathon.

---

<p align="center">
  Made with ❤️ for Indian Kirana Stores 🇮🇳
</p>
