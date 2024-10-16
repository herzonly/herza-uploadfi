const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

const File = mongoose.model('File', fileSchema);

module.exports = File;
