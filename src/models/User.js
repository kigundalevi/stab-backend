const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
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
  },
  createdAt: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model('User', userSchema);