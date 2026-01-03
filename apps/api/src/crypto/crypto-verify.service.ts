import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { createPublicClient, http, decodeEventLog, parseAbiItem } from "viem";
import * as admin from "firebase-admin";
import { getNetwork, getAsset } from "@opencause/crypto-core";
import { normalizeTxHash } from "@opencause/crypto-core";
import { FxRateService } from "./fx-rate.service";

const ERC20_TRANSFER = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

/**
 * Format units from raw bigint amount
 */

@Injectable()
export class CryptoVerifyService {
  constructor(private fxRate: FxRateService) {}

  /**
   * Format units from raw bigint amount
   */
  private formatUnits(value: bigint, decimals: number): string {
    const s = value.toString().padStart(decimals + 1, "0");
    const i = s.slice(0, -decimals);
    const d = s.slice(-decimals).replace(/0+$/, "");
    return d ? `${i}.${d}` : i;
  }

  /**
   * Verify transaction for a payment intent (intent-based, chain-truth only)
   */
  async verifyIntentTx(intentId: string, txHashInput: string) {
    // Load intent first to determine network type
    const db = admin.firestore();
    const intentRef = db.collection("payment_intents").doc(intentId);
    const intentSnap = await intentRef.get();
    if (!intentSnap.exists) {
      throw new NotFoundException("Payment intent not found");
    }
    const intent = intentSnap.data() as any;
    
    // Log intent data for debugging
    console.log(`[verifyIntentTx] Intent data:`, {
      intentId,
      networkId: intent.networkId,
      assetId: intent.assetId,
    });
    
    const network = getNetwork(intent.networkId);
    const asset = getAsset(intent.assetId);
    
    if (!network || !asset) {
      throw new NotFoundException(`Network or asset not found: ${intent.networkId}/${intent.assetId}`);
    }
    
    // Normalize tx hash based on network type
    // IMPORTANT: Check network type FIRST to avoid calling normalizeTxHash for UTXO networks
    let txHash: string;
    
    console.log(`[verifyIntentTx] Network: ${network.name}, Type: ${network.type}, NetworkId: ${intent.networkId}, TxHash input: ${txHashInput.substring(0, 20)}...`);
    
    // CRITICAL: Check UTXO FIRST before EVM to prevent calling normalizeTxHash
    // Also check networkId string to catch Litecoin/Bitcoin even if type is wrong
    const isUtxoNetwork = network.type === "UTXO" || 
                          intent.networkId?.includes("litecoin") || 
                          intent.networkId?.includes("bitcoin");
    
    if (isUtxoNetwork) {
      // UTXO networks (Bitcoin, Litecoin): remove 0x prefix if present, keep as lowercase hex
      txHash = txHashInput.trim().toLowerCase();
      if (txHash.startsWith("0x")) {
        txHash = txHash.slice(2);
      }
      // Validate format (64 hex characters for Bitcoin/Litecoin)
      if (!/^[0-9a-f]{64}$/.test(txHash)) {
        throw new BadRequestException(
          `Invalid transaction hash format for ${network.name || "UTXO"}. Expected 64 hex characters (no 0x prefix). Got: ${txHash.length} chars, hash: ${txHash.substring(0, 20)}...`
        );
      }
      console.log(`[verifyIntentTx] UTXO tx hash normalized: ${txHash.substring(0, 20)}...`);
    } else if (network.type === "EVM") {
      // EVM networks: use normalizeTxHash which adds 0x prefix
      try {
        txHash = normalizeTxHash(txHashInput) as string;
        console.log(`[verifyIntentTx] EVM tx hash normalized: ${txHash.substring(0, 20)}...`);
      } catch (error: any) {
        throw new BadRequestException(`Invalid transaction hash: ${error.message}`);
      }
    } else {
      // Solana and others: handle similarly to UTXO for now
      txHash = txHashInput.trim().toLowerCase();
      if (txHash.startsWith("0x")) {
        txHash = txHash.slice(2);
      }
      console.log(`[verifyIntentTx] Other network type (${network.type}), tx hash: ${txHash.substring(0, 20)}...`);
    }

    // Support EVM, UTXO (Bitcoin/Litecoin), and Solana networks
    // Use same check as above to ensure consistency
    if (isUtxoNetwork) {
      console.log(`[verifyIntentTx] Detected UTXO network, calling verifyUtxoIntentTx with txHash: ${txHash}`);
      // Load deposit address for UTXO verification
      const depositSnap = await db.collection("campaign_deposits").doc(intent.depositRef).get();
      if (!depositSnap.exists) {
        throw new NotFoundException("Campaign deposit not found");
      }
      const deposit = depositSnap.data() as any;
      console.log(`[verifyIntentTx] Deposit address: ${deposit.address}`);
      return await this.verifyUtxoIntentTx(intentId, txHash, intent, network, asset, deposit);
    }
    
    if (network.type === "SOL") {
      throw new BadRequestException("Solana verification not yet implemented");
    }
    
    if (network.type !== "EVM") {
      throw new BadRequestException(`Unsupported network type: ${network.type}`);
    }

    // Load deposit address (for EVM networks)
    const depositSnap = await db.collection("campaign_deposits").doc(intent.depositRef).get();
    if (!depositSnap.exists) {
      throw new NotFoundException("Campaign deposit not found");
    }
    const deposit = depositSnap.data() as any;
    const depositAddress = (deposit.address as string).toLowerCase();

    // Idempotency: Check if tx already recorded
    const txDocId = `${intent.networkId}_${txHash}`;
    const txRef = db.collection("chain_txs").doc(txDocId);
    const existingTx = await txRef.get();
    if (existingTx.exists) {
      // Already recorded - return existing data (don't double-count)
      const existing = existingTx.data() as any;
      return {
        intentId,
        txHash,
        amountNative: existing.amountNative,
        amountRaw: existing.amountRaw,
        usdLive: existing.usdLive || "0",
        explorerUrl: existing.explorerUrl,
        status: "CONFIRMED",
        alreadyRecorded: true,
      };
    }

    // Get RPC URL
    const rpcUrl = this.getRpcUrl(intent.networkId);
    if (!rpcUrl) {
      throw new BadRequestException(`RPC URL not configured for ${intent.networkId}`);
    }

    // Create public client
    const publicClient = createPublicClient({
      transport: http(rpcUrl),
    });

    // Get transaction receipt
    let receipt;
    try {
      receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
    } catch (error: any) {
      throw new BadRequestException(`Transaction not found: ${error.message}`);
    }

    if (!receipt) {
      throw new BadRequestException("Transaction receipt not found");
    }

    if (receipt.status !== "success") {
      throw new BadRequestException("Transaction failed on chain");
    }

    // Check startBlock guard (prevent replay of old transactions)
    const blockNumber = receipt.blockNumber;
    const startBlock = intent.startBlock ? BigInt(intent.startBlock) : BigInt(0);
    if (blockNumber < startBlock) {
      throw new BadRequestException(
        `Transaction is older than payment intent (replay blocked). Transaction block: ${blockNumber}, Intent start block: ${startBlock}`
      );
    }

    // Get current block for confirmations
    const currentBlock = await publicClient.getBlockNumber();
    const confirmations = Number(currentBlock - blockNumber);

    // Determine actual on-chain amount received
    let amountRaw: bigint = 0n;
    let fromAddr: string | undefined;
    let toAddr: string | undefined;

    if (asset.assetType === "NATIVE") {
      // Native token transfer
      const tx = await publicClient.getTransaction({ hash: txHash as `0x${string}` });
      toAddr = (tx.to || "").toLowerCase();
      fromAddr = (tx.from || "").toLowerCase();

      if (toAddr !== depositAddress) {
        throw new BadRequestException(
          `Native transaction was not sent to campaign address. Expected: ${depositAddress}, Got: ${toAddr}`
        );
      }

      amountRaw = tx.value;
    } else if (asset.assetType === "ERC20") {
      // ERC20 token transfer
      const tokenAddress = (asset.contractAddress as string).toLowerCase();

      for (const log of receipt.logs) {
        if ((log.address || "").toLowerCase() !== tokenAddress) {
          continue;
        }

        try {
          const decoded = decodeEventLog({
            abi: [ERC20_TRANSFER],
            data: log.data,
            topics: log.topics,
          }) as { args: { from: `0x${string}`; to: `0x${string}`; value: bigint } };

          const to = decoded.args.to.toLowerCase();
          const from = decoded.args.from.toLowerCase();
          const value = decoded.args.value;

          if (to === depositAddress) {
            amountRaw += value;
            fromAddr = fromAddr ?? from;
            toAddr = toAddr ?? to;
          }
        } catch (error) {
          // Ignore non-matching logs
          continue;
        }
      }

      if (amountRaw === 0n) {
        throw new BadRequestException(
          `No ERC20 Transfer event found sending tokens to campaign address ${depositAddress}`
        );
      }
    } else {
      throw new BadRequestException(`Unsupported asset type: ${asset.assetType}`);
    }

    // Get decimals (prefer registry, fallback to chain read for ERC20)
    let decimals = Number(asset.decimals ?? 18);
    if (asset.assetType === "ERC20" && (!asset.decimals || asset.decimals === 18) && asset.contractAddress) {
      try {
        const decimalsResult = await publicClient.readContract({
          address: asset.contractAddress as `0x${string}`,
          abi: [
            {
              type: "function",
              name: "decimals",
              stateMutability: "view",
              inputs: [],
              outputs: [{ type: "uint8" }],
            },
          ],
          functionName: "decimals",
          authorizationList: [],
        });
        decimals = Number(decimalsResult);
      } catch (error) {
        console.warn(`Failed to read decimals from chain for ${asset.contractAddress}, using registry value: ${decimals}`);
      }
    }

    // Format amount in native units
    const amountNative = this.formatUnits(amountRaw, decimals);

    // Get USD price (live)
    const priceUsd = parseFloat(await this.fxRate.getRate(asset.coingeckoId || asset.assetId));
    const usdLive = (Number(amountNative) * priceUsd).toFixed(2);

    // Build explorer URL
    const explorerUrl = `${network.explorerBaseUrl}/tx/${txHash}`;

    // Load campaign to get organizer info
    const campaignSnap = await db.collection("campaigns").doc(intent.campaignId).get();
    if (!campaignSnap.exists) {
      throw new NotFoundException("Campaign not found");
    }
    const campaign = campaignSnap.data() as any;

    // Write transaction, update intent, and create donation record (atomic)
    await db.runTransaction(async (transaction) => {
      // Double-check idempotency inside transaction
      const txSnap = await transaction.get(txRef);
      if (txSnap.exists) {
        // Already recorded in another request, skip
        return;
      }

      // Record transaction
      transaction.set(txRef, {
        networkId: intent.networkId,
        assetId: intent.assetId,
        depositRef: intent.depositRef,
        intentId,
        txHash,
        from: fromAddr || null,
        to: depositAddress,
        amountRaw: amountRaw.toString(),
        amountNative,
        decimals,
        blockNumber: blockNumber.toString(),
        confirmations,
        status: "CONFIRMED",
        explorerUrl,
        usdLive, // Snapshot at confirmation time
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update intent
      transaction.update(intentRef, {
        status: "CONFIRMED",
        confirmedTxHash: txHash,
        actualAmountNative: amountNative,
        actualAmountRaw: amountRaw.toString(),
        usdAtConfirm: usdLive, // Snapshot USD at confirmation
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create donation record using actual chain amounts
      // Use guest donor ID (can be updated later if user is authenticated)
      const donationRef = db.collection("donations").doc();
      transaction.set(donationRef, {
        campaignId: intent.campaignId,
        donorId: `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`, // Guest donation
        type: "CRYPTO",
        amount: amountRaw.toString(), // Store raw amount (smallest unit) - chain truth
        amountNative, // Human-readable native amount
        amountUsd: usdLive, // USD at confirmation time
        tokenAddress: deposit.address,
        tokenType: asset.symbol,
        txHash,
        isGuest: true,
        guestName: null, // Will be set by frontend if provided
        guestEmail: null, // Will be set by frontend if provided
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update campaign totals using actual chain amounts
      const currentRaisedCrypto = BigInt(campaign.raisedCrypto || "0");
      const newRaisedCrypto = (currentRaisedCrypto + amountRaw).toString();
      
      // Get INR price directly from CoinGecko for accurate conversion
      let priceInr = 0;
      try {
        const coingeckoId = asset.coingeckoId || asset.assetId;
        const inrPriceUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=inr`;
        const inrPriceResponse = await fetch(inrPriceUrl);
        if (inrPriceResponse.ok) {
          const inrPriceData = await inrPriceResponse.json();
          if (inrPriceData[coingeckoId]?.inr) {
            priceInr = inrPriceData[coingeckoId].inr;
          }
        }
      } catch (error) {
        console.warn(`[verifyIntentTx] Failed to fetch INR price, using USD conversion:`, error);
      }
      
      // Calculate INR value: use direct INR price if available, otherwise convert from USD
      const amountInrRupees = priceInr > 0 
        ? (Number(amountNative) * priceInr)
        : (parseFloat(usdLive) * 90); // Fallback: use ~90 as USD to INR rate
      
      // Convert to paise (smallest unit) for storage - raisedInr is stored in paise
      const amountInrPaise = Math.round(amountInrRupees * 100);
      const currentRaisedInr = BigInt(campaign.raisedInr || "0");
      const newRaisedInr = (currentRaisedInr + BigInt(amountInrPaise)).toString();
      
      console.log(`[verifyIntentTx] Campaign update: amountNative=${amountNative}, amountInrRupees=${amountInrRupees.toFixed(2)}, amountInrPaise=${amountInrPaise}, current=${currentRaisedInr.toString()}, new=${newRaisedInr}`);

      const campaignRef = db.collection("campaigns").doc(intent.campaignId);
      transaction.update(campaignRef, {
        raisedCrypto: newRaisedCrypto,
        raisedInr: newRaisedInr,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return {
      intentId,
      txHash,
      amountNative,
      amountRaw: amountRaw.toString(),
      usdLive,
      explorerUrl,
      confirmations,
      status: "CONFIRMED",
    };
  }

  /**
   * Verify UTXO transaction (Bitcoin, Litecoin) using Blockchair API
   */
  private async verifyUtxoIntentTx(
    intentId: string,
    txHashInput: string,
    intent: any,
    network: any,
    asset: any,
    deposit: any
  ) {
    // Normalize tx hash - remove 0x prefix if present, ensure lowercase
    let txHash = txHashInput.trim().toLowerCase();
    if (txHash.startsWith("0x")) {
      txHash = txHash.slice(2);
    }
    
    // Validate tx hash format (64 hex characters for Bitcoin/Litecoin)
    if (!/^[0-9a-f]{64}$/.test(txHash)) {
      throw new BadRequestException(
        `Invalid transaction hash format for ${network.name}. Expected 64 hex characters (no 0x prefix).`
      );
    }

    const db = admin.firestore();
    const depositAddress = (deposit.address as string).toLowerCase();
    const txDocId = `${intent.networkId}_${txHash}`;
    const txRef = db.collection("chain_txs").doc(txDocId);
    const intentRef = db.collection("payment_intents").doc(intentId);

    // Check idempotency
    const existingTx = await txRef.get();
    if (existingTx.exists) {
      const existing = existingTx.data() as any;
      return {
        intentId,
        txHash,
        amountNative: existing.amountNative,
        amountRaw: existing.amountRaw,
        usdLive: existing.usdLive || "0",
        explorerUrl: existing.explorerUrl,
        status: "CONFIRMED",
        alreadyRecorded: true,
      };
    }

    // Determine Blockchair chain identifier - use full chain name for Litecoin
    const blockchairChain = network.networkId === "litecoin_mainnet" ? "litecoin" : (network.networkId === "bitcoin_mainnet" ? "bitcoin" : "btc");
    const blockchairUrl = `https://api.blockchair.com/${blockchairChain}/dashboards/transaction/${txHash}`;

    console.log(`[verifyUtxoIntentTx] Network: ${network.name}, Chain: ${blockchairChain}, TxHash: ${txHash}`);
    console.log(`[verifyUtxoIntentTx] Blockchair URL: ${blockchairUrl}`);

    try {
      // Fetch transaction from Blockchair
      let response: Response;
      try {
        response = await fetch(blockchairUrl, {
          headers: {
            'User-Agent': 'OpenCause/1.0',
            'Accept': 'application/json',
          },
        });
      } catch (fetchError: any) {
        console.error(`[verifyUtxoIntentTx] Fetch error:`, fetchError);
        throw new BadRequestException(`Failed to fetch from Blockchair: ${fetchError.message}`);
      }
      
      console.log(`[verifyUtxoIntentTx] Response status: ${response.status}, ok: ${response.ok}`);
      
      const responseText = await response.text();
      
      // Handle 404 - transaction not found
      if (response.status === 404) {
        console.error(`[verifyUtxoIntentTx] ❌ 404 from Blockchair. URL: ${blockchairUrl}`);
        console.error(`[verifyUtxoIntentTx] Response:`, responseText.substring(0, 300));
        throw new BadRequestException("Transaction not found on blockchain. Please verify the transaction hash.");
      }
      
      if (!response.ok) {
        console.error(`[verifyUtxoIntentTx] ❌ HTTP ${response.status}:`, responseText.substring(0, 200));
        throw new BadRequestException(`Blockchair API error: ${response.status}`);
      }
      
      // Check if HTML
      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        throw new BadRequestException("Blockchair API returned an error page");
      }
      
      let data: any;
      try {
        data = JSON.parse(responseText);
        console.log(`[verifyUtxoIntentTx] ✅ Response parsed`);
      } catch (parseError: any) {
        console.error(`[verifyUtxoIntentTx] ❌ JSON parse failed:`, responseText.substring(0, 500));
        throw new BadRequestException(`Invalid response from Blockchair: ${parseError.message}`);
      }

      // Get transaction data - Blockchair returns it in data.data[txHash]
      // Be flexible about response structure
      const responseData = data.data || data;
      if (!responseData || typeof responseData !== 'object') {
        console.error(`[verifyUtxoIntentTx] ❌ Invalid response structure. Keys:`, Object.keys(data));
        throw new BadRequestException("Transaction not found on blockchain");
      }
      
      // Try to find transaction data with various key formats
      const dataKeys = Object.keys(responseData);
      let txData = responseData[txHash] || responseData[txHash.toLowerCase()] || responseData[txHash.toUpperCase()];
      
      // If still not found, try case-insensitive search
      if (!txData && dataKeys.length > 0) {
        const matchingKey = dataKeys.find(key => key.toLowerCase() === txHash.toLowerCase());
        if (matchingKey) {
          txData = responseData[matchingKey];
        }
      }
      
      if (!txData) {
        console.error(`[verifyUtxoIntentTx] ❌ Transaction not found! Hash: "${txHash}", Available keys:`, dataKeys.slice(0, 5));
        throw new BadRequestException("Transaction not found on blockchain");
      }
      
      console.log(`[verifyUtxoIntentTx] ✅ Transaction found!`);

      // Blockchair returns: data[txHash].transaction and data[txHash].outputs[]
      const tx = txData.transaction;
      const outputs = txData.outputs || [];

      if (!tx) {
        throw new BadRequestException("Transaction object not found in Blockchair response");
      }

      // Check transaction status (block_id === -1 means unconfirmed)
      if (tx.block_id === -1 || !tx.block_id) {
        throw new BadRequestException("Transaction is not yet confirmed");
      }

      // Get current block height from context
      const currentBlockHeight = data.context?.state || tx.block_id;
      const blockHeight = tx.block_id;
      const confirmations = currentBlockHeight - blockHeight + 1;
      const minConfirmations = network.confirmationsRequired || 1;
      
      if (confirmations < minConfirmations) {
        throw new BadRequestException(
          `Transaction needs at least ${minConfirmations} confirmations. Current: ${confirmations}`
        );
      }

      // Check startBlock guard (prevent replay)
      const startBlock = intent.startBlock ? parseInt(intent.startBlock) : 0;
      if (blockHeight < startBlock) {
        throw new BadRequestException(
          `Transaction is older than payment intent (replay blocked). Transaction block: ${blockHeight}, Intent start block: ${startBlock}`
        );
      }

      // Find outputs to our deposit address
      let amountRaw = 0n;
      let foundOutput = false;

      // Blockchair returns outputs array with recipient and value fields
      for (const output of outputs) {
        // Normalize addresses for comparison (handle bech32 and legacy formats)
        const outputAddress = (output.recipient || output.address || "").toLowerCase();
        const normalizedOutputAddr = outputAddress.replace(/^ltc1|^bc1/, "");
        const normalizedDepositAddr = depositAddress.replace(/^ltc1|^bc1/, "");
        
        // Check if this output goes to our deposit address
        if (outputAddress === depositAddress || normalizedOutputAddr === normalizedDepositAddr) {
          // Value is in satoshis (smallest unit: 1 LTC = 100,000,000 satoshis, 1 BTC = 100,000,000 satoshis)
          const outputValue = output.value || 0;
          amountRaw += BigInt(outputValue);
          foundOutput = true;
        }
      }

      if (!foundOutput || amountRaw === 0n) {
        throw new BadRequestException(
          `No outputs found sending to campaign address ${depositAddress}`
        );
      }

      // Format amount in native units (LTC/BTC)
      const decimals = Number(asset.decimals ?? 8); // UTXO networks use 8 decimals
      const amountNative = this.formatUnits(amountRaw, decimals);

      // Get USD price
      const priceUsd = parseFloat(await this.fxRate.getRate(asset.coingeckoId || asset.assetId));
      const usdLive = (Number(amountNative) * priceUsd).toFixed(2);

      // Get INR price directly from CoinGecko (more accurate)
      let priceInr = 0;
      try {
        const coingeckoId = asset.coingeckoId || asset.assetId;
        const inrPriceUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=inr`;
        const inrPriceResponse = await fetch(inrPriceUrl);
        if (inrPriceResponse.ok) {
          const inrPriceData = await inrPriceResponse.json();
          if (inrPriceData[coingeckoId]?.inr) {
            priceInr = inrPriceData[coingeckoId].inr;
          }
        }
      } catch (error) {
        console.warn(`[verifyUtxoIntentTx] Failed to fetch INR price, using USD conversion:`, error);
      }
      
      // Calculate INR value: use direct INR price if available, otherwise convert from USD
      const amountInrValue = priceInr > 0 
        ? (Number(amountNative) * priceInr).toFixed(2)
        : (parseFloat(usdLive) * 90).toFixed(2); // Fallback: use ~90 as USD to INR rate

      // Build explorer URL
      const explorerUrl = `${network.explorerBaseUrl}/tx/${txHash}`;

      // Load campaign
      const campaignSnap = await db.collection("campaigns").doc(intent.campaignId).get();
      if (!campaignSnap.exists) {
        throw new NotFoundException("Campaign not found");
      }
      const campaign = campaignSnap.data() as any;

      // Write transaction, update intent, and create donation record (atomic)
      await db.runTransaction(async (transaction) => {
        // Double-check idempotency
        const txSnap = await transaction.get(txRef);
        if (txSnap.exists) {
          return;
        }

        // Record transaction
        transaction.set(txRef, {
          networkId: intent.networkId,
          assetId: intent.assetId,
          depositRef: intent.depositRef,
          intentId,
          txHash,
          to: depositAddress,
          amountRaw: amountRaw.toString(),
          amountNative,
          decimals,
          blockNumber: blockHeight.toString(),
          confirmations,
          status: "CONFIRMED",
          explorerUrl,
          usdLive,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Update intent
        transaction.update(intentRef, {
          status: "CONFIRMED",
          confirmedTxHash: txHash,
          actualAmountNative: amountNative,
          actualAmountRaw: amountRaw.toString(),
          usdAtConfirm: usdLive,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Create donation record
        const donationRef = db.collection("donations").doc();
        transaction.set(donationRef, {
          campaignId: intent.campaignId,
          donorId: `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          type: "CRYPTO",
          amount: amountRaw.toString(),
          amountNative,
          amountUsd: usdLive, // USD value (e.g., "0.82" for 0.01 LTC)
          amountInr: amountInrValue, // INR value at confirmation (calculated above)
          tokenAddress: deposit.address,
          tokenType: asset.symbol,
          txHash,
          isGuest: true,
          guestName: null,
          guestEmail: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Update campaign totals
        const currentRaisedCrypto = BigInt(campaign.raisedCrypto || "0");
        const newRaisedCrypto = (currentRaisedCrypto + amountRaw).toString();
        
        // Convert INR amount to paise (smallest unit) for storage
        // amountInrValue is in rupees (e.g., "73.60"), convert to paise
        const amountInrPaise = Math.round(parseFloat(amountInrValue) * 100);
        const currentRaisedInr = BigInt(campaign.raisedInr || "0");
        const newRaisedInr = (currentRaisedInr + BigInt(amountInrPaise)).toString();
        
        console.log(`[verifyUtxoIntentTx] Updating campaign totals: amountInr=${amountInrValue} (${amountInrPaise} paise), current=${currentRaisedInr.toString()}, new=${newRaisedInr}`);

        const campaignRef = db.collection("campaigns").doc(intent.campaignId);
        transaction.update(campaignRef, {
          raisedCrypto: newRaisedCrypto,
          raisedInr: newRaisedInr,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      return {
        intentId,
        txHash,
        amountNative,
        amountRaw: amountRaw.toString(),
        usdLive,
        explorerUrl,
        confirmations,
        status: "CONFIRMED",
      };
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to verify transaction: ${error.message}`);
    }
  }

  /**
   * Detect transactions on-chain for a deposit address (lightweight detection, not full verification)
   * This scans recent blocks for transfers to the deposit address
   */
  async detectTransactionOnChain(
    intentId: string,
    depositAddress: string,
    networkId: string,
    assetId: string,
    startBlock: string
  ): Promise<{ txHash: string; amountNative: string } | null> {
    const network = getNetwork(networkId);
    const asset = getAsset(assetId);

    if (!network || !asset || network.type !== "EVM") {
      return null;
    }

    const rpcUrl = this.getRpcUrl(networkId);
    if (!rpcUrl) {
      return null;
    }

    try {
      const publicClient = createPublicClient({
        transport: http(rpcUrl),
      });

      const depositAddr = depositAddress.toLowerCase() as `0x${string}`;
      const startBlockNum = BigInt(startBlock);
      const currentBlock = await publicClient.getBlockNumber();
      
      // Only scan last 100 blocks to avoid heavy RPC calls
      const scanEnd = currentBlock;
      const scanStart = startBlockNum > scanEnd - 100n ? startBlockNum : scanEnd - 100n;

      // For native tokens, check transaction receipts
      if (asset.assetType === "NATIVE") {
        // Scan blocks for transactions to this address
        for (let blockNum = scanEnd; blockNum >= scanStart; blockNum--) {
          try {
            const block = await publicClient.getBlock({ blockNumber: blockNum, includeTransactions: true });
            
            if (block.transactions) {
              for (const tx of block.transactions) {
                if (typeof tx === "object" && tx.to && tx.to.toLowerCase() === depositAddr) {
                  // Found a transaction to our deposit address
                  const receipt = await publicClient.getTransactionReceipt({ hash: tx.hash });
                  if (receipt && receipt.status === "success" && tx.value > 0n) {
                    const decimals = Number(asset.decimals ?? 18);
                    const amountNative = this.formatUnits(tx.value, decimals);
                    return { txHash: tx.hash, amountNative };
                  }
                }
              }
            }
          } catch (blockError) {
            // Skip block if error, continue scanning
            console.warn(`Error scanning block ${blockNum}:`, blockError);
          }
        }
      } else if (asset.assetType === "ERC20" && asset.contractAddress) {
        // For ERC20, check Transfer events
        const tokenAddress = (asset.contractAddress as string).toLowerCase() as `0x${string}`;
        
        try {
          const logs = await publicClient.getLogs({
            address: tokenAddress,
            event: ERC20_TRANSFER,
            args: { to: depositAddr },
            fromBlock: scanStart,
            toBlock: scanEnd,
          });

          // Return the first matching transfer (most recent)
          if (logs.length > 0) {
            const latestLog = logs[logs.length - 1];
            const decoded = decodeEventLog({
              abi: [ERC20_TRANSFER],
              data: latestLog.data,
              topics: latestLog.topics,
            }) as { args: { from: `0x${string}`; to: `0x${string}`; value: bigint } };

            const decimals = Number(asset.decimals ?? 18);
            const amountNative = this.formatUnits(decoded.args.value, decimals);
            
            // Get the transaction hash from the log
            const txHash = latestLog.transactionHash;
            
            return { txHash, amountNative };
          }
        } catch (logsError) {
          console.warn("Error getting ERC20 transfer logs:", logsError);
        }
      }
    } catch (error) {
      console.error("Error detecting transaction on-chain:", error);
    }

    return null;
  }

  private getRpcUrl(networkId: string): string | null {
    const rpcUrls: Record<string, string> = {
      ethereum_mainnet: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
      polygon_mainnet: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      bsc_mainnet: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org",
      avalanche_mainnet: process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
      arbitrum_mainnet: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
      optimism_mainnet: process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io",
      base_mainnet: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      fantom_mainnet: process.env.FANTOM_RPC_URL || "https://rpc.ftm.tools",
    };

    return rpcUrls[networkId] || null;
  }
}


