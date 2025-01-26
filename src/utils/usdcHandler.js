
const { Token, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { decryptPrivateKey } = require('./encryptor');
const { getAssociatedTokenAddress, getAccount, getMint } = require('@solana/spl-token');
const { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { createTransferInstruction,  } = require('@solana/spl-token');


// USDC Mint Address (Devnet)
const USDC_MINT_ADDRESS = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

const sendUSDC = async (encryptedPrivateKey, iv, salt, pin, toAddress, amount) => {
    try {
      // 1. Decrypt private key
      const privateKey = decryptPrivateKey(pin, encryptedPrivateKey, iv, salt);
      const keypair = Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));
  
      // 2. Establish connection
      const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
      // 3. Get token accounts
      const fromTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(USDC_MINT_ADDRESS),
        keypair.publicKey
      );
  
      const toTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(USDC_MINT_ADDRESS),
        new PublicKey(toAddress)
      );
  
      // 4. Create transfer instruction
      const transferInstruction = createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        keypair.publicKey,
        amount * 10 ** 6 // Convert to 6 decimals
      );
  
      // 5. Create and send transaction
      const transaction = new Transaction().add(transferInstruction);
      const txSignature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [keypair]
      );
  
      return {
        success: true,
        txId: txSignature,
        explorerLink: `https://solscan.io/tx/${txSignature}?cluster=devnet`
      };
  
    } catch (error) {
      console.error('Transfer Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  };

const getUSDCBalance = async (publicKey) => {
    try {
      const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
      
      // Get associated token account address
      const ata = await getAssociatedTokenAddress(
        new PublicKey(USDC_MINT_ADDRESS),
        new PublicKey(publicKey)
      );
  
      // Check if account exists
      const accountInfo = await connection.getAccountInfo(ata);
      if (!accountInfo) return 0;
  
      // Get token account details
      const tokenAccount = await getAccount(
        connection,
        ata,
        'confirmed'
      );
  
      // Get mint decimals
      const mintInfo = await getMint(
        connection,
        new PublicKey(USDC_MINT_ADDRESS),
        'confirmed'
      );
  
      return Number(tokenAccount.amount) / 10 ** mintInfo.decimals;
  
    } catch (error) {
      console.error('Balance check error:', error);
      throw new Error('Failed to retrieve balance');
    }
  };
module.exports = { sendUSDC, getUSDCBalance, USDC_MINT_ADDRESS};