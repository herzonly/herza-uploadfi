const fs = require('fs');
const path = require('path');

// Load all command files in the plugins directory
const commandFiles = fs.readdirSync(path.join(__dirname, 'plugins')).filter(file => file.endsWith('.js'));

// Store commands in an object for easy lookup
const commands = {};

for (const file of commandFiles) {
  const command = require(`./plugins/${file}`);
  commands[command.name] = command;
}

// Get handler for the specific command
const handleCommand = (commandName) => {
  return commands[commandName];
};

module.exports = {
  handleCommand
};
