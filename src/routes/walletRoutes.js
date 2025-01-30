const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { encryptPrivateKey, decryptPrivateKey } = require('../utils/encryptor');
const createAddress = require('../utils/createWallet');
const { validatePin, walletLimiter, retrievalLimiter } = require('../middleware/security');
const { Connection, PublicKey } = require('@solana/web3.js');
const solanaConnection = new Connection('https://api.devnet.solana.com');
const { sendUSDC, getUSDCBalance, USDC_MINT_ADDRESS } = require('../utils/usdcHandler');



router.post('/create', walletLimiter, validatePin, async (req, res) => {
  try {
    const { name, pin } = req.body;

    // Validate name
    if (!name || name.length < 3) {
      return res.status(400).json({ error: 'Name must be at least 3 characters' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ name });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Generate wallet
    const { privateKey, publicKey, address } = createAddress();

    // Validate generated keys
    if (!address || !publicKey || !privateKey) {
      throw new Error('Failed to generate valid wallet keys');
    }

    // Encrypt private key
    const encryptedData = encryptPrivateKey(pin, privateKey);

    // Create new user with wallet data
    const user = new User({
      name,
      encryptedPrivateKey: encryptedData.encryptedData,
      iv: encryptedData.iv,
      salt: encryptedData.salt,
      publicKey,
      address
    });

    await user.save();

    res.json({
      success: true,
      name: user.name,
      address: user.address,
      publicKey: user.publicKey,
      createdAt: user.createdAt
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get wallet by user name
router.get('/:name', async (req, res) => {
  try {
    const user = await User.findOne({ 
      name: { $regex: new RegExp(`^${req.params.name}$`, 'i') } 
    });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    res.json({
      success: true,
      name: user.name,
      address: user.address,
      publicKey: user.publicKey,
      createdAt: user.createdAt
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Add this endpoint to retrieve decrypted private key
router.post('/retrieve', retrievalLimiter, async (req, res) => {
  try {
    const { name, pin } = req.body;

    const user = await User.findOne({ name });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const privateKey = decryptPrivateKey(
      pin,
      user.encryptedPrivateKey,
      user.iv,
      user.salt
    );

    res.json({
      success: true,
      publicKey: user.publicKey,
      privateKey: privateKey
    });

  } catch (error) {
    console.error('Retrieval error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve wallet',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/balance/:name', async (req, res) => {
  try {
    // 1. Find user in database
    const user = await User.findOne({ name: req.params.name });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 2. Get SOL address from user record
    const publicKey = new PublicKey(user.address);
    
    // 3. Fetch balance from So lana blockchain
    const balance = await solanaConnection.getBalance(publicKey);
    
    // 4. Convert lamports to SOL
    const solBalance = balance / 1000000000;

    res.json({
      success: true,
      name: user.name,
      address: user.address,
      balance: solBalance,
      lamports: balance,
      network: 'devnet'
    });

  } catch (error) {
    console.error('Balance check error:', error);
    res.status(500).json({
      error: 'Failed to check balance',
      details: error.message
    });
  }
});

// Get USDC Balance
router.get('/usdc-balance/:name', async (req, res) => {
  try {
    const user = await User.findOne({ name: req.params.name });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const balance = await getUSDCBalance(user.address);
    
    res.json({
      success: true,
      name: user.name,
      balance: balance,
      address: user.address,
      mint: USDC_MINT_ADDRESS
    });

  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get balance',
      details: error.message
    });
  }
});

// Send USDC
router.post('/send-usdc', async (req, res) => {
  try {
    const { senderName, pin, recipientName, amount } = req.body;

    // Validate input
    if (!senderName || !pin || !recipientName || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Find sender
    const sender = await User.findOne({ 
      name: { $regex: new RegExp(`^${senderName}$`, 'i') } 
    });
    if (!sender) return res.status(404).json({ error: 'Sender not found' });

    // Find recipient
    const recipient = await User.findOne({ 
      name: { $regex: new RegExp(`^${recipientName}$`, 'i') } 
    });
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

    // Validate PIN (implementation depends on your auth setup)
    // const isPinValid = await verifyPin(sender.encryptedPin, pin);
    // if (!isPinValid) {
    //   return res.status(401).json({ error: 'Invalid PIN' });
    // }

    // Send USDC
    const result = await sendUSDC(
      sender.encryptedPrivateKey,
      sender.iv,
      sender.salt,
      pin,
      recipient.address,
      amount
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Record transactions for both parties
    try {
      const transactionDate = new Date();
      
      // Update sender's transactions
      await User.updateOne(
        { name: sender.name },
        { 
          $push: { 
            transactions: {
              date: transactionDate,
              type: 'send',
              amount: amount,
              currency: 'USDC',
              counterparty: recipient.name,
              status: 'completed',
              txHash: result.txId
            }
          }
        }
      );

      // Update recipient's transactions
      await User.updateOne(
        { name: recipient.name },
        { 
          $push: { 
            transactions: {
              date: transactionDate,
              type: 'receive',
              amount: amount,
              currency: 'USDC',
              counterparty: sender.name,
              status: 'completed',
              txHash: result.txId
            }
          }
        }
      );

    } catch (dbError) {
      console.error('Transaction recording failed:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Transfer succeeded but failed to save transaction history',
        txId: result.txId,
        explorerLink: result.explorerLink
      });
    }

    // Success response
    res.json({
      success: true,
      message: 'USDC transfer completed',
      sender: sender.name,
      recipient: recipient.name,
      amount: amount,
      currency: 'USDC',
      txId: result.txId,
      explorerLink: result.explorerLink,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({
      error: 'Transfer failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// New search endpoint
router.post('/search', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const users = await User.find({
      name: { $regex: name, $options: 'i' }
    }).select('-encryptedPrivateKey -iv -salt -__v');

    res.json({
      success: true,
      count: users.length,
      users
    });

  } catch (error) {
    res.status(500).json({
      error: 'Search failed',
      details: error.message
    });
  }
});
  
// Get user transactions
router.get('/transactions/:name', async (req, res) => {
  try {
    const user = await User.findOne({ 
      name: { $regex: new RegExp(`^${req.params.name}$`, 'i') } 
    }).select('transactions');

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    res.json({
      success: true,
      transactions: user.transactions
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error'
    });
  }
});
 // Add this to your walletRoutes.js
router.get('/exchange-rate', async (req, res) => {
  try {
    // Hardcoded exchange rate (1 USDC = 129 KES)
    const hardcodedRate = 129;
    
    /* Uncomment this section to use real API data
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=kes');
    const rate = response.data['usd-coin'].kes;
    
    if (!rate) {
      throw new Error('Failed to fetch exchange rate');
    }
    */
    
    res.json({
      success: true,
      rate: hardcodedRate // Replace with 'rate' variable when using real API
    });

  } catch (error) {
    console.error('Exchange rate error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch exchange rate',
      // Include fallback rate in error response
      rate: 129 // Maintain 129 KES as fallback
    });
  }
});

module.exports = router;