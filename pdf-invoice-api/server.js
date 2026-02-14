const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Create public directory for PDFs
const publicDir = path.join(__dirname, 'public', 'invoices');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());

// Serve static PDF files
app.use('/invoices', express.static(path.join(__dirname, 'public', 'invoices')));

// Load invoice template
const templatePath = path.join(__dirname, 'templates', 'invoice.html');

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'pdf-invoice-api' });
});

// Generate PDF Invoice
app.post('/api/invoice/generate', async (req, res) => {
    try {
        const {
            shop_name = 'My Kirana Store',
            shop_upi = '',
            shop_gst = '',
            shop_address = '',
            shop_phone = '',
            customer_name = 'Customer',
            customer_phone = '',
            invoice_number = 'INV-001',
            invoice_date = new Date().toLocaleDateString('en-IN'),
            items = [],
            subtotal = 0,
            tax_amount = 0,
            total_amount = 0,
            notes = '',
            is_paid = false,
            paid_date = new Date().toLocaleDateString('en-IN')
        } = req.body;

        // Read and populate template
        let template = fs.readFileSync(templatePath, 'utf8');

        // Generate items HTML
        const itemsHtml = items.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${item.name}</td>
        <td>${item.qty} ${item.unit || 'pcs'}</td>
        <td>₹${item.price.toFixed(2)}</td>
        <td>₹${(item.qty * item.price).toFixed(2)}</td>
      </tr>
    `).join('');

        // Replace placeholders
        template = template
            .replace(/{{SHOP_NAME}}/g, shop_name)
            .replace(/{{SHOP_ADDRESS}}/g, shop_address || '')
            .replace(/{{SHOP_PHONE}}/g, shop_phone || '')
            .replace(/{{SHOP_GST}}/g, shop_gst ? `GSTIN: ${shop_gst}` : '')
            .replace(/{{SHOP_UPI}}/g, shop_upi || '')
            .replace(/{{CUSTOMER_NAME}}/g, customer_name)
            .replace(/{{CUSTOMER_PHONE}}/g, customer_phone || '')
            .replace(/{{INVOICE_NUMBER}}/g, invoice_number)
            .replace(/{{INVOICE_DATE}}/g, invoice_date)
            .replace(/{{ITEMS}}/g, itemsHtml)
            .replace(/{{SUBTOTAL}}/g, subtotal.toFixed(2))
            .replace(/{{TAX_AMOUNT}}/g, tax_amount.toFixed(2))
            .replace(/{{TOTAL_AMOUNT}}/g, total_amount.toFixed(2))
            .replace(/{{NOTES}}/g, notes || '');

        // Show/hide tax row
        if (tax_amount === 0) {
            template = template.replace(/{{TAX_ROW_DISPLAY}}/g, 'none');
        } else {
            template = template.replace(/{{TAX_ROW_DISPLAY}}/g, 'table-row');
        }

        // Show/hide PAID stamp
        if (is_paid) {
            template = template.replace(/{{PAID_DISPLAY}}/g, 'block');
            template = template.replace(/{{PAID_DATE}}/g, paid_date);
        } else {
            template = template.replace(/{{PAID_DISPLAY}}/g, 'none');
            template = template.replace(/{{PAID_DATE}}/g, '');
        }

        // Launch Puppeteer and generate PDF
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setContent(template, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '10mm',
                right: '10mm',
                bottom: '10mm',
                left: '10mm'
            }
        });

        await browser.close();

        // Save PDF to public folder
        const filename = `${invoice_number.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;
        const filepath = path.join(publicDir, filename);
        fs.writeFileSync(filepath, pdfBuffer);

        // Generate public URL (nginx proxies port 8090 to 3001)
        const pdfUrl = `http://${HOST}:8090/invoices/${filename}`;

        // Shorten URL using TinyURL for WhatsApp clickability
        let shortUrl = pdfUrl;
        try {
            const tinyResponse = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(pdfUrl)}`);
            if (tinyResponse.ok) {
                shortUrl = await tinyResponse.text();
            }
        } catch (e) {
            console.log('URL shortening failed, using original:', e.message);
        }

        // Return URL for WhatsApp to download
        res.json({
            success: true,
            invoice_number: invoice_number,
            pdf_url: shortUrl,
            original_url: pdfUrl,
            filename: filename,
            message: `Invoice ${invoice_number} generated successfully`
        });

    } catch (error) {
        console.error('PDF generation error:', error);
        res.status(500).json({
            error: 'Failed to generate PDF',
            message: error.message
        });
    }
});

// Cleanup old PDFs (optional - run daily)
const cleanupOldPdfs = () => {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now = Date.now();

    fs.readdirSync(publicDir).forEach(file => {
        const filepath = path.join(publicDir, file);
        const stats = fs.statSync(filepath);
        if (now - stats.mtimeMs > maxAge) {
            fs.unlinkSync(filepath);
            console.log(`Cleaned up old PDF: ${file}`);
        }
    });
};

// Run cleanup every 24 hours
setInterval(cleanupOldPdfs, 24 * 60 * 60 * 1000);

// Start server
app.listen(PORT, () => {
    console.log(`🧾 PDF Invoice API running on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Generate: POST http://localhost:${PORT}/api/invoice/generate`);
    console.log(`   PDFs available at: http://${HOST}:${PORT}/invoices/`);
});
