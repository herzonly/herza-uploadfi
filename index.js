const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { Telegraf, Markup } = require('telegraf');
const app = express();
const bot = require ('./bot.js')

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

// Replace with your actual bot token and chat ID
const chatId = '5897375263';

mongoose.connect('mongodb+srv://herza:herza@cluster0.yxn8yc1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// File schema
const fileSchema = new mongoose.Schema({
  filename: String,
  originalname: String,
  mimetype: String,
  data: Buffer,
  url: String // Store the URL for the file
});
const File = mongoose.model('File', fileSchema);

// Multer setup
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max file size
});

// Helper function to send file to Telegram with caption
// Helper function to send file to Telegram with caption
async function sendFileToTelegram(fileUrl, fileSize, mimeType, uploaderIP, fileBuffer, fileName) {
  const caption = `Uploaded by ${uploaderIP}\nFile size: ${(fileSize / 1024 / 1024).toFixed(2)} MB\nMimetype: ${mimeType}`;

  const options = {
    caption: caption,
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Copy URL', callback_data: `copy_${fileUrl}` }],
        [{ text: 'Delete File', callback_data: `delete_${fileUrl}` }]
      ]
    }
  };

  // Check file type to send either as a document or a photo
  if (mimeType.startsWith('image/')) {
    await bot.sendPhoto(chatId, fileBuffer, options);
  } else {
    await bot.sendDocument(chatId, fileBuffer, options);
  }
}


// File upload route
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  if (req.file.size > 10 * 1024 * 1024) {
    return res.status(400).json({ message: 'File is too large. Max size is 10MB.' });
  }

  const fileId = uuidv4();
  const extension = req.file.originalname.split('.').pop();
  const filename = `${fileId}.${extension}`;
  const fileUrl = `https://55e3d2f3-51cc-48df-bf75-a485237c8622-00-e0kc3lb0203f.pike.replit.dev/file/${filename}`;

  const file = new File({
    filename,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    data: req.file.buffer,
    url: fileUrl
  });

  await file.save();

  // Send file info and file itself to Telegram
  const uploaderIP = req.ip;
  await sendFileToTelegram(fileUrl, req.file.size, req.file.mimetype, uploaderIP, req.file.buffer, req.file.originalname);

  res.json({ url: fileUrl });
});

// File access route
app.get('/file/:filename', async (req, res) => {
  const file = await File.findOne({ filename: req.params.filename });
  if (!file) return res.status(404).send('File not found');

  res.set('Content-Type', file.mimetype);
  res.send(file.data);
});

// Start Telegram bot
bot.launch();

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
