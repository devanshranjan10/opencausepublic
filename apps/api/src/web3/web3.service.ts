import { Injectable } from "@nestjs/common";
import { createWalletClient, createPublicClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonZkEvm } from "viem/chains";
import type { Address } from "viem";
import { AnchorEvidenceDto } from "@opencause/types";
import { createHash } from "crypto";

@Injectable()
export class Web3Service {
  private account = privateKeyToAccount(
    (process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001") as `0x${string}`
  );

  private publicClient = createPublicClient({
    chain: polygonZkEvm,
    transport: http(process.env.RPC_URL || "https://rpc.public.zkevm-test.net"),
  });

  private walletClient = createWalletClient({
    account: this.account,
    chain: polygonZkEvm,
    transport: http(process.env.RPC_URL || "https://rpc.public.zkevm-test.net"),
  });

  // Common token addresses on Polygon zkEVM
  private readonly TOKEN_ADDRESSES: Record<string, string> = {
    USDC: process.env.USDC_TOKEN_ADDRESS || "0xA8CE8aee21bC2A48a5EF670afCc9254C68Dd62c3", // Polygon zkEVM USDC
    USDT: process.env.USDT_TOKEN_ADDRESS || "0x1E4a5963aBFD975d8c9021ce480b42188849D41d", // Polygon zkEVM USDT
    NATIVE: "0x0000000000000000000000000000000000000000", // Native token (ETH/MATIC)
  };

  /**
   * Deploy campaign vault (stub - returns mock address for MVP)
   * In production, this should deploy the actual CampaignVault contract
   */
  async deployCampaignVault(campaignId: string, organizerAddress: string): Promise<string> {
    // For MVP, generate a deterministic address from campaign ID
    // This ensures the same campaign always gets the same vault address
    // In production, deploy actual CampaignVault contract using CREATE2
    
    // Create deterministic address from campaign ID
    const hash = createHash("sha256").update(`vault-${campaignId}`).digest("hex");
    
    // Take first 40 characters and prefix with 0x for valid Ethereum address
    const address = `0x${hash.substring(0, 40)}`;
    
    // Validate address format
    if (!address.startsWith("0x") || address.length !== 42) {
      throw new Error(`Invalid vault address generated: ${address}`);
    }
    
    return address;
  }

  /**
   * Anchor evidence hash on-chain
   */
  async anchorEvidence(dto: AnchorEvidenceDto): Promise<string> {
    // For MVP, simulate anchoring
    // In production, call EvidenceRegistry.anchorEvidence()
    console.log("Anchoring evidence:", dto);
    return "0x" + "0".repeat(64); // Mock tx hash
  }

  /**
   * Release funds from vault
   * For direct withdrawals (no milestone), uses milestoneId 0
   */
  async releaseFunds(
    vaultAddress: string,
    milestoneId: string | null,
    tokenAddress: string,
    amount: string,
    payee: string,
    evidenceHash: string
  ): Promise<string> {
    if (!vaultAddress || vaultAddress === "0x" || vaultAddress.length < 42) {
      throw new Error("Invalid vault address");
    }

    // Use milestone 0 for direct withdrawals (no milestone specified)
    const milestoneIdNum = milestoneId ? BigInt(milestoneId) : BigInt(0);
    const amountBigInt = BigInt(amount);
    
    // Validate addresses
    if (!payee.startsWith("0x") || payee.length !== 42) {
      throw new Error("Invalid payee address");
    }

    try {
      // CampaignVault ABI - release function
      const releaseAbi = [
        {
          inputs: [
            { name: "milestoneId", type: "uint256" },
            { name: "token", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "payee", type: "address" },
            { name: "evidenceHash", type: "bytes32" },
          ],
          name: "release",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        },
      ] as const;

      // Convert evidenceHash from hex string to bytes32
      const evidenceHashBytes = evidenceHash.startsWith("0x") 
        ? evidenceHash.slice(2).padStart(64, "0")
        : evidenceHash.padStart(64, "0");

      // Determine token address
      // For native token (ETH/MATIC), use address(0)
      // For ERC20 tokens, use the provided tokenAddress or lookup common tokens
      let tokenAddr: `0x${string}`;
      if (!tokenAddress || tokenAddress === "NATIVE" || tokenAddress === "") {
        tokenAddr = this.TOKEN_ADDRESSES.NATIVE as `0x${string}`;
      } else if (this.TOKEN_ADDRESSES[tokenAddress.toUpperCase()]) {
        // Check if it's a known token symbol (USDC, USDT, etc.)
        tokenAddr = this.TOKEN_ADDRESSES[tokenAddress.toUpperCase()] as `0x${string}`;
      } else {
        if (!tokenAddress.startsWith("0x") || tokenAddress.length !== 42) {
          throw new Error(`Invalid token address: ${tokenAddress}`);
        }
        tokenAddr = tokenAddress as `0x${string}`;
      }

      console.log("Releasing crypto funds:", {
        vaultAddress,
        milestoneId: milestoneIdNum.toString(),
        tokenAddress: tokenAddr,
        amount: amountBigInt.toString(),
        payee,
        evidenceHash: `0x${evidenceHashBytes}`,
      });

      // Call the release function on the vault contract
      const hash = await this.walletClient.writeContract({
        address: vaultAddress as Address,
        abi: releaseAbi,
        functionName: "release",
        args: [
          milestoneIdNum,
          tokenAddr,
          amountBigInt,
          payee as Address,
          `0x${evidenceHashBytes}` as `0x${string}`,
        ],
        chain: polygonZkEvm,
      } as any);

      // Wait for transaction receipt
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
      
      if (receipt.status === "reverted") {
        throw new Error("Transaction reverted");
      }

      console.log("Funds released successfully:", hash);
      return hash;
    } catch (error: any) {
      console.error("Failed to release funds:", error);
      throw new Error(`Failed to release funds: ${error.message || "Unknown error"}`);
    }
  }

  /**
   * Get token balance
   */
  async getBalance(address: string, tokenAddress?: string): Promise<string> {
    if (tokenAddress && tokenAddress !== "0x0000000000000000000000000000000000000000") {
      // ERC20 balance
      const erc20Abi = [
        {
          inputs: [{ name: "account", type: "address" }],
          name: "balanceOf",
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
      ] as const;

      try {
        const balance = await (this.publicClient as any).readContract({
          address: tokenAddress as Address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address as Address],
        });
        return balance.toString();
      } catch (error) {
        console.error("Failed to get ERC20 balance:", error);
        return "0";
      }
    }
    
    // Native token balance
    const balance = await this.publicClient.getBalance({ address: address as `0x${string}` });
    return balance.toString();
  }

  /**
   * Get vault balance for a specific token
   */
  async getVaultBalance(vaultAddress: string, tokenAddress?: string): Promise<string> {
    return this.getBalance(vaultAddress, tokenAddress);
  }

  /**
   * Get transaction receipt to verify crypto donations
   */
  async getTransactionReceipt(txHash: string): Promise<any> {
    try {
      const receipt = await this.publicClient.getTransactionReceipt({
        hash: txHash as `0x${string}`,
      });
      return {
        status: receipt.status === "success" ? "success" : "failed",
        blockNumber: receipt.blockNumber.toString(),
        from: receipt.from,
        to: receipt.to,
      };
    } catch (error: any) {
      throw new Error(`Failed to get transaction receipt: ${error.message}`);
    }
  }
}


