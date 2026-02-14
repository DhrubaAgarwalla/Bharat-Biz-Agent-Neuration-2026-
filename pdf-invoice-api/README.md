# PDF Invoice API - VPS Setup Guide (Ubuntu)

## Prerequisites
- Ubuntu 18.04 or later
- Node.js 18+ installed
- Root or sudo access

## Step 1: Install Node.js (if not installed)

```bash
# Update package list
sudo apt update

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version
```

## Step 2: Install Chromium Dependencies (Required for Puppeteer)

```bash
# Install required system dependencies
sudo apt install -y \
  ca-certificates \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libatspi2.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  xdg-utils \
  wget \
  fonts-noto-color-emoji

# Install Hindi fonts for proper rendering
sudo apt install -y fonts-deva fonts-indic
```

## Step 3: Upload and Setup the API

```bash
# Create directory for the API
mkdir -p /opt/pdf-invoice-api
cd /opt/pdf-invoice-api

# Upload the files (from your local machine):
# scp -r pdf-invoice-api/* user@your-vps:/opt/pdf-invoice-api/

# Or clone from your repo if uploaded there

# Install dependencies
npm install

# Test run
node server.js
# You should see: 🧾 PDF Invoice API running on port 3001
```

## Step 4: Setup as Systemd Service (Auto-start on boot)

```bash
# Create systemd service file
sudo nano /etc/systemd/system/pdf-invoice.service
```

Paste this content:

```ini
[Unit]
Description=PDF Invoice Generation API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/pdf-invoice-api
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
```

Save and exit (Ctrl+X, Y, Enter), then:

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable auto-start on boot
sudo systemctl enable pdf-invoice

# Start the service
sudo systemctl start pdf-invoice

# Check status
sudo systemctl status pdf-invoice
```

## Step 5: Configure Firewall (Optional)

If using UFW firewall:

```bash
# Allow port 3001 (only if you need external access)
# For local n8n access, this is NOT needed
sudo ufw allow 3001
```

## Step 6: Test the API

```bash
# Test health endpoint
curl http://localhost:3001/health

# Test PDF generation
curl -X POST http://localhost:3001/api/invoice/generate \
  -H "Content-Type: application/json" \
  -d '{
    "shop_name": "Sharma Kirana Store",
    "shop_upi": "sharma@upi",
    "customer_name": "Rahul Gupta",
    "invoice_number": "INV-TEST-001",
    "items": [
      {"name": "Atta", "qty": 5, "unit": "kg", "price": 45},
      {"name": "Sugar", "qty": 2, "unit": "kg", "price": 45}
    ],
    "subtotal": 315,
    "total_amount": 315
  }' --output test-invoice.pdf

# Open the PDF to verify
# (download to your machine and open)
```

## Useful Commands

```bash
# View logs
sudo journalctl -u pdf-invoice -f

# Restart service
sudo systemctl restart pdf-invoice

# Stop service
sudo systemctl stop pdf-invoice

# Check if running
sudo systemctl status pdf-invoice
```

## n8n Integration

In your n8n workflow, use an **HTTP Request** node to call:

- **URL**: `http://localhost:3001/api/invoice/generate`
- **Method**: POST
- **Body Content Type**: JSON
- **Response Format**: File

The API will return a PDF binary that you can save or send via WhatsApp.

---

## Troubleshooting

### Error: "Failed to launch the browser process"
```bash
# Install missing Chrome dependencies
sudo apt install -y chromium-browser
```

### Error: "Protocol error (Page.navigate): Target closed"
```bash
# Increase memory limits
export NODE_OPTIONS="--max-old-space-size=4096"
```

### Hindi fonts not rendering correctly
```bash
# Install additional Hindi fonts
sudo apt install -y fonts-deva-extra fonts-noto
sudo fc-cache -fv
sudo systemctl restart pdf-invoice
```
