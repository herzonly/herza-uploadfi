module.exports = {
  name: 'restart',
  description: 'Restart the bot (owner only)',
  owner: true, // This marks the command as owner-only
  execute: async (bot, msg) => {
    const chatId = msg.chat.id;
    
    // Send a message before restarting the bot
    await bot.sendMessage(chatId, 'Bot is restarting...');

    // Simulate bot restart (in real scenarios, you may use process.exit or similar logic)
    setTimeout(() => {
      process.exit(0); // Restart the bot by exiting the current process
    }, 1000);
  }
};
