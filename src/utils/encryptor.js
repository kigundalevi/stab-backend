// utilities/encryptor.js
const crypto = require('crypto');


const encryptPrivateKey = (pin, privateKey) => {
  try {
    // Create random salt (16 bytes)
    const salt = crypto.randomBytes(16);
    
    // Derive encryption key using PBKDF2
    const key = crypto.pbkdf2Sync(pin, salt, 100000, 32, 'sha512');
    
    // Create random initialization vector (16 bytes)
    const iv = crypto.randomBytes(16);
    
    // Create AES-256-CBC cipher
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    // Encrypt the private key
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return values needed for decryption (store these)
    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      salt: salt.toString('hex')
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt private key');
  }
};

const decryptPrivateKey = (pin, encryptedData, iv, salt) => {
  try {
    const key = crypto.pbkdf2Sync(pin, Buffer.from(salt, 'hex'), 100000, 32, 'sha512');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed - invalid PIN or corrupted data');
  }
};


module.exports = { encryptPrivateKey, decryptPrivateKey };