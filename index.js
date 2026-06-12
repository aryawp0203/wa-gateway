const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json()); // Untuk membaca body JSON dari Laravel

let isClientReady = false;

// Inisialisasi Client WhatsApp dengan fitur simpan sesi lokal
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Penting jika nanti di-deploy ke VPS Linux
    }
});

// Event: Menampilkan QR Code di terminal
client.on('qr', (qr) => {
    console.log('Silakan scan QR Code di bawah ini menggunakan WhatsApp Anda:');
    qrcode.generate(qr, { small: true });
});

// Event: WhatsApp berhasil terkoneksi
client.on('ready', () => {
    isClientReady = true;
    console.log('WhatsApp Gateway sudah siap dan terhubung!');
});

// Event: Jika autentikasi gagal
client.on('auth_failure', msg => {
    isClientReady = false;
    console.error('Autentikasi gagal:', msg);
});

client.on('disconnected', () => {
    isClientReady = false;
    console.warn('WhatsApp Gateway terputus.');
});

// Jalankan client WhatsApp
client.initialize();

// ==========================================
// API ENDPOINT: POST /send-message
// ==========================================
app.post('/send-message', async (req, res) => {
    const { number, message } = req.body;

    if (!number || !message) {
        return res.status(400).json({ status: 'error', message: 'Nomor dan pesan wajib diisi!' });
    }

    if (!isClientReady) {
        return res.status(503).json({
            status: 'error',
            message: 'WhatsApp Gateway belum siap. Tunggu sampai client terhubung lalu coba lagi.',
        });
    }

    // Format nomor WA dari '0812...' atau '62812...' menjadi format wa.me (misal: 62812xxx@c.us)
    let formattedNumber = number;
    if (formattedNumber.startsWith('0')) {
        formattedNumber = '62' + formattedNumber.substring(1);
    }
    const chatId = `${formattedNumber}@c.us`;

    try {
        // Cek apakah nomor terdaftar di WA
        const isRegistered = await client.isRegisteredUser(chatId);

        if (!isRegistered) {
            return res.status(404).json({ status: 'error', message: 'Nomor tidak terdaftar di WhatsApp' });
        }

        // Kirim pesan
        await client.sendMessage(chatId, message);

        return res.status(200).json({ status: 'success', message: 'Pesan berhasil dikirim!' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 'error', message: 'Gagal mengirim pesan', error: error.message });
    }
});

// Jalankan server Express di port 3000
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server API berjalan di http://localhost:${PORT}`);
});