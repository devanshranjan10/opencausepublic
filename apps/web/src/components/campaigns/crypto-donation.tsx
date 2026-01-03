"use client";

import { useState, useEffect } from "react";
// TODO: Re-enable when wagmi/rainbowkit are installed
// import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
// import { parseUnits, formatUnits, Address } from "viem";
// import { ConnectButton } from "@rainbow-me/rainbowkit";

// Stub types and functions
type Address = string;
const parseUnits = (value: string, decimals: number) => BigInt(0);
const formatUnits = (value: bigint, decimals: number) => "0";
const ConnectButton: any = () => null;
const useAccount = () => ({ address: undefined, isConnected: false, chain: undefined });
const useWriteContract = () => ({ 
  writeContract: (..._args: any[]) => {}, 
  isPending: false, 
  data: undefined as `0x${string}` | undefined, 
  error: null as Error | null 
});
const useWaitForTransactionReceipt = (_config?: any) => ({ isLoading: false, isSuccess: false });
const useReadContract = (_config?: any) => ({ data: undefined, isLoading: false });
import { apiRequest } from "@/lib/api";

interface CryptoDonationProps {
  campaign: any;
  amount: string;
  tokenType: "NATIVE" | "USDC" | "USDT";
  onSuccess: (txHash: string) => void;
  onError: (error: string) => void;
  guestName?: string;
  guestEmail?: string;
}

// Token addresses on Polygon zkEVM
const TOKEN_ADDRESSES: Record<string, Address> = {
  USDC: "0xA8CE8aee21bC2A48a5EF670afCc9254C68Dd62c3" as Address,
  USDT: "0x1E4a5963aBFD975d8c9021ce480b42188849D41d" as Address,
};

// ERC20 ABI
const ERC20_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// CampaignVault fund function ABI
const VAULT_FUND_ABI = [
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "fund",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export function CryptoDonation({
  campaign,
  amount,
  tokenType,
  onSuccess,
  onError,
  guestName,
  guestEmail,
}: CryptoDonationProps) {
  const { address, isConnected, chain } = useAccount();
  const [donationInfo, setDonationInfo] = useState<any>(null);
  const [tokenDecimals, setTokenDecimals] = useState<number>(18);
  const [userBalance, setUserBalance] = useState<string>("0");

  // Get donation info (vault address)
  useEffect(() => {
    const fetchDonationInfo = async () => {
      try {
        const info = await apiRequest(`/campaigns/${campaign.id}/donation-info`);
        setDonationInfo(info);
      } catch (error: any) {
        onError(`Failed to load donation info: ${error.message}`);
      }
    };
    fetchDonationInfo();
  }, [campaign.id]);

  // Get token decimals
  const { data: decimals } = useReadContract({
    address: tokenType !== "NATIVE" ? TOKEN_ADDRESSES[tokenType] : undefined,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: tokenType !== "NATIVE" && !!donationInfo },
  });

  useEffect(() => {
    if (decimals) {
      setTokenDecimals(Number(decimals));
    } else if (tokenType === "NATIVE") {
      setTokenDecimals(18); // Native token (ETH) has 18 decimals
    }
  }, [decimals, tokenType]);

  // Get user balance
  const { data: balance } = useReadContract({
    address: tokenType !== "NATIVE" ? TOKEN_ADDRESSES[tokenType] : undefined,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: tokenType !== "NATIVE" && !!address && isConnected },
  });

  useEffect(() => {
    if (balance) {
      setUserBalance(formatUnits(balance, tokenDecimals));
    }
  }, [balance, tokenDecimals]);

  // Prepare amount in wei/smallest unit
  const amountInWei = amount
    ? parseUnits(amount, tokenDecimals)
    : BigInt(0);

  // Check allowance for ERC20 tokens
  const { data: allowance } = useReadContract({
    address: tokenType !== "NATIVE" ? TOKEN_ADDRESSES[tokenType] : undefined,
    abi: ERC20_ABI,
    functionName: "allowance",
    args:
      tokenType !== "NATIVE" && address && donationInfo?.vaultAddress
        ? [address, donationInfo.vaultAddress as Address]
        : undefined,
    query: { enabled: tokenType !== "NATIVE" && !!address && !!donationInfo },
  });

  // Write contract for approvals
  const {
    writeContract: writeApprove,
    data: approveHash,
    isPending: isPendingApprove,
    error: approveError,
  } = useWriteContract();

  // Write contract for ERC20 fund
  const {
    writeContract: writeERC20Fund,
    data: erc20Hash,
    isPending: isPendingERC20,
    error: erc20Error,
  } = useWriteContract();

  // Write contract for native token
  const {
    writeContract: writeNative,
    data: nativeHash,
    isPending: isPendingNative,
    error: nativeError,
  } = useWriteContract();

  // Wait for approval transaction
  const { isLoading: isConfirmingApprove, isSuccess: isSuccessApprove } =
    useWaitForTransactionReceipt({
      hash: approveHash,
    });

  // Wait for ERC20 transaction
  const { isLoading: isConfirmingERC20, isSuccess: isSuccessERC20 } =
    useWaitForTransactionReceipt({
      hash: erc20Hash,
    });

  // Wait for native transaction
  const { isLoading: isConfirmingNative, isSuccess: isSuccessNative } =
    useWaitForTransactionReceipt({
      hash: nativeHash,
    });

  // Auto-call fund after approval succeeds
  useEffect(() => {
    if (isSuccessApprove && tokenType !== "NATIVE" && donationInfo?.vaultAddress) {
      // Approval successful, now call fund
      const tokenAddress = TOKEN_ADDRESSES[tokenType];
      writeERC20Fund({
        address: donationInfo.vaultAddress as Address,
        abi: VAULT_FUND_ABI,
        functionName: "fund",
        args: [tokenAddress, amountInWei],
      });
    }
  }, [isSuccessApprove, tokenType, donationInfo, amountInWei, writeERC20Fund]);

  // Handle transaction success
  useEffect(() => {
    const handleSuccess = async (txHash: string) => {
      try {
        // Record donation in backend
        await apiRequest("/donations", {
          method: "POST",
          body: JSON.stringify({
            campaignId: campaign.id,
            type: "CRYPTO",
            amount: amount,
            tokenType: tokenType,
            tokenAddress: tokenType === "NATIVE" ? "0x0000000000000000000000000000000000000000" : TOKEN_ADDRESSES[tokenType],
            txHash: txHash,
            guestName,
            guestEmail,
          }),
        });

        onSuccess(txHash);
      } catch (error: any) {
        onError(`Failed to record donation: ${error.message}`);
      }
    };

    if (isSuccessERC20 && erc20Hash) {
      handleSuccess(erc20Hash);
    } else if (isSuccessNative && nativeHash) {
      handleSuccess(nativeHash);
    }
  }, [isSuccessERC20, isSuccessNative, erc20Hash, nativeHash, campaign.id, amount, tokenType, guestName, guestEmail, onSuccess, onError]);

  // Handle errors
  useEffect(() => {
    if (approveError) {
      onError(`Approval failed: ${(approveError as any)?.message || 'Unknown error'}`);
    }
    if (erc20Error) {
      onError(`Transaction failed: ${(erc20Error as any)?.message || 'Unknown error'}`);
    }
    if (nativeError) {
      onError(`Transaction failed: ${(nativeError as any)?.message || 'Unknown error'}`);
    }
  }, [approveError, erc20Error, nativeError, onError]);

  const handleDonate = async () => {
    if (!isConnected || !address) {
      onError("Please connect your wallet first");
      return;
    }

    if (!donationInfo?.vaultAddress) {
      onError("Campaign vault address not found");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      onError("Please enter a valid amount");
      return;
    }

    try {
      if (tokenType === "NATIVE") {
        // Native token donation - send ETH directly to vault
        // The vault's receive() function will handle it
        writeNative({
          to: donationInfo.vaultAddress as Address,
          value: amountInWei,
        } as any);
      } else {
        // ERC20 token donation
        const tokenAddress = TOKEN_ADDRESSES[tokenType];
        const currentAllowance = allowance || BigInt(0);
        
        // Check if approval is needed
        if (currentAllowance < amountInWei) {
          // Approve first (approve a bit more for future donations)
          const approveAmount = amountInWei * BigInt(2); // Approve 2x for convenience
          writeApprove({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [donationInfo.vaultAddress as Address, approveAmount],
          });
        } else {
          // Already approved, call fund directly
          writeERC20Fund({
            address: donationInfo.vaultAddress as Address,
            abi: VAULT_FUND_ABI,
            functionName: "fund",
            args: [tokenAddress, amountInWei],
          });
        }
      }
    } catch (error: any) {
      onError(`Failed to initiate transaction: ${error.message}`);
    }
  };

  if (!donationInfo) {
    return (
      <div className="text-center py-4">
        <p className="text-white/60">Loading donation information...</p>
      </div>
    );
  }

  const isLoading =
    isPendingApprove ||
    isPendingERC20 ||
    isPendingNative ||
    isConfirmingApprove ||
    isConfirmingERC20 ||
    isConfirmingNative;

  return (
    <div className="space-y-4">
      {!isConnected ? (
        <div className="text-center py-4">
          <p className="text-white/60 mb-4">Connect your wallet to donate crypto</p>
          <ConnectButton />
        </div>
      ) : (
        <>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Your {tokenType} Balance:</span>
              <span className="font-medium">
                {tokenType === "NATIVE"
                  ? "Loading..."
                  : `${parseFloat(userBalance).toFixed(4)} ${tokenType}`}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Donation Amount:</span>
              <span className="font-medium">{amount} {tokenType}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-white/10">
              <span className="text-white/60">Vault Address:</span>
              <span className="font-mono text-xs break-all">
                {donationInfo.vaultAddress.slice(0, 6)}...{donationInfo.vaultAddress.slice(-4)}
              </span>
            </div>
          </div>

          <button
            onClick={handleDonate}
            disabled={isLoading || !amount || parseFloat(amount) <= 0}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all"
          >
            {isLoading
              ? isConfirmingApprove
                ? "Approving Token..."
                : isConfirmingERC20 || isConfirmingNative
                ? "Confirming Transaction..."
                : "Preparing Transaction..."
              : `Donate ${amount} ${tokenType === "NATIVE" ? "ETH" : tokenType}`}
          </button>

          {isLoading && (
            <p className="text-xs text-white/40 text-center">
              Please confirm the transaction in your wallet
            </p>
          )}
        </>
      )}
    </div>
  );
}






