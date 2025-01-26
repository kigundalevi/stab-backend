const { Keypair } = require('@solana/web3.js');

const createAddress = () => {
  try {
    const keypair = Keypair.generate();
    return {
      privateKey: Buffer.from(keypair.secretKey).toString('hex'),
      publicKey: keypair.publicKey.toString(),
      address: keypair.publicKey.toString() // For Solana, address = public key
    };
  } catch (error) {
    throw new Error('Failed to generate wallet');
  }
};

module.exports = createAddress;