module.exports = {
  command: 'start',
  owner: true, // Hanya bisa dijalankan oleh owner
  run: (ctx) => {
    ctx.reply('Bot has been started by the owner.');
  }
};
