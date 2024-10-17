const { Telegraf } = require('telegraf');
const config = require('./config');
const handler = require('./handler');

// Inisialisasi bot dengan token dari config
const bot = new Telegraf(config.token);

bot.on('message', (ctx) => {
  const chatId = ctx.chat.id;
  const messageText = ctx.message.text;

  // Cek apakah pesan diawali dengan prefix
  const command = messageText.trim().split(' ')[0];
  const prefix = config.prefixes.find(p => command.startsWith(p));
  
  if (prefix && handler.commands[command]) {
    const cmd = handler.commands[command];
    
    // Cek jika perintah memerlukan owner
    if (cmd.owner && chatId !== parseInt(config.owner)) {
      return ctx.reply("You are not authorized to use this command.");
    }

    // Jalankan perintah
    cmd.run(ctx);
  } else {
    ctx.reply("Command not found.");
  }
});

bot.launch();
