const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const os = require('os');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve('public')));

const token = '8089126957:AAHmb-g0XQ4pekjlqd4F8b_CU0vdykP904M';
const bot = new TelegramBot(token, { polling: true });

let chatId = '5897375263';

// Koneksi MongoDB
mongoose.connect(
  'mongodb+srv://herza:herza@cluster0.stvrg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
  { useNewUrlParser: true, useUnifiedTopology: true }
);

// Skema File
const fileSchema = new mongoose.Schema({
  fileId: {
    type: String,
    required: true,
    unique: true,
  },
  filename: String,
  originalname: String,
  mimetype: String,
  data: Buffer,
  url: String,
  createdAt: { type: Date, default: Date.now },
});
const File = mongoose.model('File', fileSchema);

// Skema IPBlock
const ipBlockSchema = new mongoose.Schema({
  ip: {
    type: String,
    required: true,
    unique: true
  },
  uploadCount: {
    type: Number,
    default: 0
  },
  lastUploadTime: {
    type: Date,
    default: null
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  blockUntil: {
    type: Date,
    default: null
  }
});
const IPBlock = mongoose.model('IPBlock', ipBlockSchema);

// Konfigurasi Multer
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Batas 10MB
});

// Middleware Proteksi Upload
const protectUpload = async (req, res, next) => {
  const userIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  try {
    let ipRecord = await IPBlock.findOne({ ip: userIP });

    // Jika record tidak ada, buat baru
    if (!ipRecord) {
      ipRecord = new IPBlock({ ip: userIP });
    }

    // Cek apakah IP masih diblokir
    if (ipRecord.isBlocked && ipRecord.blockUntil > new Date()) {
      return res.status(403).json({ 
        message: `IP Anda diblokir sampai ${ipRecord.blockUntil.toLocaleString()}` 
      });
    }

    // Reset blokir jika sudah melewati waktu
    if (ipRecord.isBlocked && ipRecord.blockUntil < new Date()) {
      ipRecord.isBlocked = false;
      ipRecord.blockUntil = null;
      ipRecord.uploadCount = 0;
    }

    const currentTime = new Date();

    // Cek jika upload terjadi kurang dari 1 detik
    if (ipRecord.lastUploadTime) {
      const timeDiff = currentTime - ipRecord.lastUploadTime;
      if (timeDiff < 1000) {
        ipRecord.uploadCount++;

        // Jika upload terlalu cepat 3 kali, blokir
        if (ipRecord.uploadCount >= 3) {
          ipRecord.isBlocked = true;
          // Blokir sampai bulan depan
          const nextMonth = new Date();
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          nextMonth.setDate(1);
          nextMonth.setHours(0, 0, 0, 0);
          ipRecord.blockUntil = nextMonth;

          await ipRecord.save();
          return res.status(403).json({ 
            message: `Anda diblokir sampai ${nextMonth.toLocaleString()}` 
          });
        }
      } else {
        // Reset hitungan jika delay sudah cukup
        ipRecord.uploadCount = 0;
      }
    }

    // Update record terakhir
    ipRecord.lastUploadTime = currentTime;
    await ipRecord.save();

    next();
  } catch (error) {
    console.error('Error dalam proteksi upload:', error);
    res.status(500).json({ message: 'Terjadi kesalahan sistem' });
  }
};

// Fungsi Utilitas
async function checkDatabaseSize() {
  const stats = await mongoose.connection.db.stats();
  const dbSizeMB = stats.dataSize / (1024 * 1024);
  const targetSizeMB = 50;

  if (dbSizeMB > targetSizeMB) {
    console.log(`Database penuh: ${dbSizeMB.toFixed(2)} MB. Menghapus file...`);
    const excessSize = dbSizeMB - targetSizeMB;

    const files = await File.find({}).sort({ createdAt: 1 }).lean();

    let deletedSize = 0;
    for (const file of files) {
      deletedSize += file.data.length / (1024 * 1024);
      await File.deleteOne({ fileId: file.fileId });
      if (deletedSize >= excessSize) break;
    }
    console.log(
      `File berhasil dihapus hingga database berada di bawah ${targetSizeMB} MB.`
    );
  }
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let formattedBytes = bytes;

  while (formattedBytes >= 1024 && unitIndex < units.length - 1) {
    formattedBytes /= 1024;
    unitIndex++;
  }

  return `${formattedBytes.toFixed(2)} ${units[unitIndex]}`;
}

// Routes
app.post('/upload', protectUpload, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const fileId = uuidv4();
  const extension = req.file.originalname.split('.').pop();
  const filename = `${fileId}.${extension}`;
  const baseUrl = 'https://uploadfile.notmebot.us.kg';
  const fileUrl = `${baseUrl}/file/${filename}`;

  const file = new File({
    fileId,
    filename,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    data: req.file.buffer,
    url: fileUrl,
  });

  try {
    await file.save();
    await checkDatabaseSize();

    const userIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Kirim file ke bot Telegram
    bot
      .sendDocument(chatId, req.file.buffer, {
        caption: `File uploaded by ${userIP}\nFile ID: ${fileId}\nFile size: ${req.file.size} bytes\nUploaded at: ${new Date().toISOString()}`,
      })
      .then(() => {
        bot.sendMessage(chatId, 'Please select about this file:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Send File ID', callback_data: `send_id_${fileId}` }],
            ],
          },
        });
      })
      .catch((error) => {
        console.error('Error sending file to Telegram:', error);
      });

    res.json({ url: fileUrl });
  } catch (error) {
    console.error('Error saving file to database:', error);
    res.status(500).json({ message: 'Error saving file' });
  }
});

app.get('/api/status', async (req, res) => {
  try {
    const uptime = process.uptime();
    const days = Math.floor(uptime / (3600 * 24));
    const hours = Math.floor((uptime % (3600 * 24)) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    const formattedUptime = `${days}D ${hours}H ${minutes}M ${seconds}S`;

    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const remainingRAMFormatted = formatBytes(totalMemory - freeMemory);
    const totalMemoryFormatted = formatBytes(totalMemory);

    const uploadedFileCount = await File.countDocuments({});

    res.json({
      uptime: formattedUptime,
      ram: `${remainingRAMFormatted} / ${totalMemoryFormatted}`,
      uploadedFiles: uploadedFileCount,
    });
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({ error: 'Failed to fetch server status' });
  }
});

app.get('/api/ping', (req, res) => {
  res.json({ ping: Date.now() });
});

app.get('/file/:filename', async (req, res) => {
  const file = await File.findOne({ filename: req.params.filename });
  if (!file) return res.status(404).send('File not found');

  res.set('Content-Type', file.mimetype);
  res.send(file.data);
});

app.get('/api/check-block-status', async (req, res) => {
  const userIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  try {
    const ipRecord = await IPBlock.findOne({ ip: userIP });
    
    if (!ipRecord || !ipRecord.isBlocked) {
      return res.json({ blocked: false });
    }

    res.json({
      blocked: true,
      blockUntil: ipRecord.blockUntil
    });
  } catch (error) {
    console.error('Error memeriksa status blokir:', error);
    res.status(500).json({ message: 'Terjadi kesalahan sistem' });
  }
});

// Telegram Bot Handlers
bot.on('callback_query', async (callbackQuery) => {
  const data = callbackQuery.data;
  const message = callbackQuery.message;

  if (data.startsWith('send_id_')) {
    const fileId = data.split('_')[2];
    bot.sendMessage(chatId, `File ID: ${fileId}`);
  }
});

bot.onText(/\/delete (.+)/, async (msg, match) => {
  const fileId = match[1];

  try {
    const file = await File.findOne({ fileId });
    if (file) {
      await File.deleteOne({ fileId });
      bot.sendMessage(
        msg.chat.id,
        `File with ID ${fileId} has been deleted from the database.`
      );
    } else {
      bot.sendMessage(msg.chat.id, 'File not found.');
    }
  } catch (error) {
    console.error('Error deleting file from database:', error);
    bot.sendMessage(
      msg.chat.id,
      'There was an error deleting the file. Please try again later.'
    );
  }
});

// Root Route
app.get('/', (req, res) => {
  res.sendFile(path.resolve('public', 'index.html'));
});

// Jalankan Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
