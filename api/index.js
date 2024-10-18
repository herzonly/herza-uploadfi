const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { bot } = require('./bot'); // Pastikan bot di-load

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// MongoDB Connection
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
  url: String
});
const File = mongoose.model('File', fileSchema);

// Multer setup
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Upload route
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const fileId = uuidv4();
  const extension = req.file.originalname.split('.').pop();
  const filename = `${fileId}.${extension}`;
  const fileUrl = `https://herza-upload.vercel.app/api/file/${filename}`;

  const file = new File({
    filename,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    data: req.file.buffer,
    url: fileUrl
  });

  await file.save();

  // Send file via Telegram
  const formData = new FormData();
  formData.append('chat_id', global.owner);
  formData.append('caption', `File uploaded by <IP>\nFile size: ${req.file.size} bytes\nUploaded at: ${new Date().toISOString()}`);
  formData.append('document', req.file.buffer, {
    filename: req.file.originalname,
    contentType: req.file.mimetype,
  });

  await axios.post(`https://api.telegram.org/bot${global.token}/sendDocument`, formData, {
    headers: formData.getHeaders()
  });

  res.json({ url: fileUrl });
});

// Serve files
app.get('/api/file/:filename', async (req, res) => {
  const file = await File.findOne({ filename: req.params.filename });
  if (!file) return res.status(404).send('File not found');

  res.set('Content-Type', file.mimetype);
  res.send(file.data);
});

module.exports = app;
    
