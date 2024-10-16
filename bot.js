const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const { ownerChatId } = require('./config.js'); // Ambil chat ID pemilik dari config
const { handleCommand } = require('./handler'); // Ambil handler perintah
const File = require('./fileModel'); // Path sesuai dengan lokasi fileModel.js


// Inisialisasi bot dengan mode polling
const bot = new TelegramBot('8089126957:AAHmb-g0XQ4pekjlqd4F8b_CU0vdykP904M', { polling: true });

// Ambil model file dari mongoose

// Middleware untuk memeriksa akses pemilik
const isOwner = (chatId) => chatId === ownerChatId;

// Menangani callback dari tombol Copy URL dan Delete File
bot.on('callback_query', async (callbackQuery) => {
  const action = callbackQuery.data; // Aksi yang dipilih
  const msg = callbackQuery.message; // Pesan yang terkait dengan tombol
  const chatId = msg.chat.id; // ID chat yang mengirim pesan

  // Jika tindakan adalah 'copy' untuk menyalin URL
  if (action.startsWith('copy_')) {
    const fileUrl = action.split('_')[1]; // Ambil URL file dari callback data
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'URL copied to clipboard' });
    await bot.sendMessage(chatId, `Here is the file URL: ${fileUrl}`);
  }

  // Jika tindakan adalah 'delete' untuk menghapus file
  if (action.startsWith('delete_')) {
    const fileUrl = action.split('_')[1]; // Ambil URL file dari callback data
    
    // Cari file di database berdasarkan URL
    const file = await File.findOne({ url: fileUrl });
    
    if (file) {
      // Hapus file dari database
      await File.deleteOne({ _id: file._id });
      
      // Kirim balasan di chat untuk konfirmasi penghapusan
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'File deleted', show_alert: true });
      await bot.sendMessage(chatId, 'The file has been successfully deleted.');
    } else {
      await bot.sendMessage(chatId, 'File not found or already deleted.');
    }
  }
});

// Menangani pesan teks yang diterima
bot.on('text', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Hanya tangani pesan yang dimulai dengan "/"
  if (!text.startsWith('/')) return;

  const command = text.split(' ')[0].slice(1); // Ambil perintah tanpa '/'
  const handler = handleCommand(command);

  if (!handler) {
    await bot.sendMessage(chatId, 'Unknown command.');
    return;
  }

  // Jika perintah hanya untuk pemilik, periksa ID chat pengguna
  if (handler.owner && !isOwner(chatId)) {
    await bot.sendMessage(chatId, "Not Allowed, You're not an owner");
    return;
  }

  // Eksekusi perintah jika pengguna adalah pemilik atau perintah bersifat publik
  try {
    await handler.execute(bot, msg);
  } catch (error) {
    await bot.sendMessage(chatId, `Error executing command: ${error.message}`);
  }
});

module.exports = bot;
