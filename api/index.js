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

// Ganti dengan ID chat pemilik
let chatId = '5897375263';

mongoose.connect(
  'mongodb+srv://herza:herza@cluster0.yxn8yc1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
  { useNewUrlParser: true, useUnifiedTopology: true }
);

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

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Batas 10MB
});

async function checkDatabaseSize() {
  const stats = await mongoose.connection.db.stats();
  const dbSizeMB = stats.dataSize / (1024 * 1024); // Ukuran database dalam MB
  const targetSizeMB = 50;

  if (dbSizeMB > targetSizeMB) {
    console.log(`Database penuh: ${dbSizeMB.toFixed(2)} MB. Menghapus file...`);
    const excessSize = dbSizeMB - targetSizeMB;

    // Urutkan berdasarkan waktu upload (terlama dihapus lebih dulu)
    const files = await File.find({}).sort({ createdAt: 1 }).lean();

    let deletedSize = 0;
    for (const file of files) {
      deletedSize += file.data.length / (1024 * 1024); // Ukuran file dalam MB
      await File.deleteOne({ fileId: file.fileId });
      if (deletedSize >= excessSize) break;
    }
    console.log(
      `File berhasil dihapus hingga database berada di bawah ${targetSizeMB} MB.`
    );
  }
}

app.post('/upload', upload.single('file'), async (req, res) => {
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
    await checkDatabaseSize(); // Periksa ukuran database setelah upload

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

app.get('/', (req, res) => {
  res.sendFile(path.resolve('public', 'index.html'));
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
