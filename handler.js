const fs = require('fs');
const path = require('path');
const config = require('./config');

// Objek untuk menyimpan perintah
const commands = {};

fs.readdirSync(path.join(__dirname, 'plugins')).forEach(file => {
  const command = require(`./plugins/${file}`);
  if (command.command) {
    config.prefixes.forEach(prefix => {
      commands[prefix + command.command] = command;
    });
  }
});

module.exports = {
  commands
};
