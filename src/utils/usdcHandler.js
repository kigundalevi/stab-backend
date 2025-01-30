const { 
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID 
} = require('@solana/spl-token');
const { decryptPrivateKey } = require('./encryptor');
const { getAssociatedTokenAddress, getAccount, getMint } = require('@solana/spl-token');
const { Connection, Keypair, PublicKey, Transaction } = require('@solana/web3.js');
const { createTransferInstruction } = require('@solana/spl-token');
require('dotenv').config();

// USDC Mint Address (Devnet)
const USDC_MINT_ADDRESS = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

// Initialize fee payer once
const feePayerKeypair = Keypair.fromSecretKey(
  Buffer.from(process.env.FEE_PAYER_PRIVATE_KEY, 'hex')
);

const sendUSDC = async (encryptedPrivateKey, iv, salt, pin, toAddress, amount) => {
  try {
    // 1. Decrypt user's private key
    const privateKey = decryptPrivateKey(pin, encryptedPrivateKey, iv, salt);
    const userKeypair = Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const usdcMint = new PublicKey(USDC_MINT_ADDRESS);

    // 2. Get token accounts
    const fromTokenAccount = await getAssociatedTokenAddress(usdcMint, userKeypair.publicKey);
    const toTokenAccount = await getAssociatedTokenAddress(usdcMint, new PublicKey(toAddress));

    // 3. Check if recipient account exists
    let createATAInstruction;
    try {
      await getAccount(connection, toTokenAccount);
    } catch {
      createATAInstruction = createAssociatedTokenAccountInstruction(
        feePayerKeypair.publicKey, // Payer (fee account)
        toTokenAccount,
        new PublicKey(toAddress),
        usdcMint
      );
    }

    // 4. Create transfer instruction
    const transferInstruction = createTransferInstruction(
      fromTokenAccount,
      toTokenAccount,
      userKeypair.publicKey,
      amount * 10 ** 6
    );

    // 5. Build transaction
    const transaction = new Transaction();
    if (createATAInstruction) transaction.add(createATAInstruction);
    transaction.add(transferInstruction);

    // Set fee payer and blockhash
    transaction.feePayer = feePayerKeypair.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    // 6. Sign with both parties
    transaction.sign(feePayerKeypair, userKeypair);

    // 7. Send and confirm transaction
    const rawTransaction = transaction.serialize();
    const txSignature = await connection.sendRawTransaction(rawTransaction);
    await connection.confirmTransaction(txSignature);

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
    const ata = await getAssociatedTokenAddress(new PublicKey(USDC_MINT_ADDRESS), new PublicKey(publicKey));

    const accountInfo = await connection.getAccountInfo(ata);
    if (!accountInfo) return 0;

    const tokenAccount = await getAccount(connection, ata, 'confirmed');
    const mintInfo = await getMint(connection, new PublicKey(USDC_MINT_ADDRESS), 'confirmed');

    return Number(tokenAccount.amount) / 10 ** mintInfo.decimals;

  } catch (error) {
    console.error('Balance check error:', error);
    throw new Error('Failed to retrieve balance');
  }
};

module.exports = { sendUSDC, getUSDCBalance, USDC_MINT_ADDRESS };