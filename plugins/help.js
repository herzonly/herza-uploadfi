module.exports = {
  name: 'help',
  description: 'Displays available commands',
  owner: false, // Public command
  execute: async (bot, msg) => {
    const chatId = msg.chat.id;

    const helpMessage = `
      Available commands:
      /help - Show this help message
      /restart - Restart the bot (owner only)
    `;

    await bot.sendMessage(chatId, helpMessage);
  }
};
