const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  encryptedPrivateKey: {
    type: String,
    required: true
  },
  iv: String,
  salt: String,
  publicKey: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    unique: true,
    validate: {
      validator: (v) => v.length > 30, // Adjust based on your address format
      message: 'Invalid address format'
    }
  }
});

module.exports = mongoose.model('Wallet', walletSchema);