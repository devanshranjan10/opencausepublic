import { ethers } from "ethers";
import { KYC_CONFIG } from "./config";
import { hashData } from "./encryption";

// Simple KYC Registry Contract ABI (minimal interface)
const KYC_REGISTRY_ABI = [
  "function submitKYCHash(bytes32 dataHash, string memory metadataURI) external returns (uint256)",
  "function getKYCRecord(address user) external view returns (bytes32 dataHash, uint256 timestamp, bool isVerified, string memory metadataURI)",
  "function updateVerificationStatus(address user, bool verified) external",
  "event KYCRecordSubmitted(address indexed user, bytes32 indexed dataHash, uint256 timestamp)",
  "event VerificationStatusUpdated(address indexed user, bool verified, uint256 timestamp)",
];

/**
 * Get Web3 provider (MetaMask or custom RPC)
 */
export async function getWeb3Provider(): Promise<ethers.BrowserProvider | null> {
  if (typeof window === "undefined") return null;

  // Try MetaMask first
  if ((window as any).ethereum) {
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      return provider;
    } catch (error) {
      console.error("Failed to initialize MetaMask provider:", error);
    }
  }

  // Fallback to custom RPC
  if (KYC_CONFIG.blockchainRPC) {
    try {
      const provider = new ethers.JsonRpcProvider(KYC_CONFIG.blockchainRPC);
      return provider as any; // Cast for compatibility
    } catch (error) {
      console.error("Failed to initialize RPC provider:", error);
    }
  }

  return null;
}

/**
 * Connect to MetaMask wallet
 */
export async function connectWallet(): Promise<string | null> {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("MetaMask is not installed");
  }

  try {
    await (window as any).ethereum.request({ method: "eth_requestAccounts" });
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    return address;
  } catch (error) {
    console.error("Failed to connect wallet:", error);
    throw error;
  }
}

/**
 * Get contract instance
 */
export async function getKYCContract(signerOrProvider: ethers.Signer | ethers.Provider) {
  if (!KYC_CONFIG.contractAddress) {
    throw new Error("KYC contract address not configured");
  }

  return new ethers.Contract(
    KYC_CONFIG.contractAddress,
    KYC_REGISTRY_ABI,
    signerOrProvider
  );
}

/**
 * Submit KYC data hash to blockchain
 */
export async function submitKYCToBlockchain(
  kycDataHash: string,
  metadataURI: string = ""
): Promise<{ txHash: string; blockNumber?: number }> {
  try {
    const provider = await getWeb3Provider();
    if (!provider) {
      throw new Error("Web3 provider not available");
    }

    // Request wallet connection
    if ((window as any).ethereum) {
      await (window as any).ethereum.request({ method: "eth_requestAccounts" });
    }

    const signer = await provider.getSigner();
    const contract = await getKYCContract(signer);

    // Convert hash string to bytes32
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes(kycDataHash));

    // Submit transaction
    const tx = await contract.submitKYCHash(dataHash, metadataURI);
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();

    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error: any) {
    console.error("Failed to submit KYC to blockchain:", error);
    throw new Error(error.message || "Failed to submit KYC to blockchain");
  }
}

/**
 * Get KYC record from blockchain
 */
export async function getKYCFromBlockchain(userAddress: string): Promise<{
  dataHash: string;
  timestamp: number;
  isVerified: boolean;
  metadataURI: string;
} | null> {
  try {
    const provider = await getWeb3Provider();
    if (!provider) {
      return null;
    }

    const contract = await getKYCContract(provider);
    const result = await contract.getKYCRecord(userAddress);

    return {
      dataHash: result.dataHash,
      timestamp: Number(result.timestamp),
      isVerified: result.isVerified,
      metadataURI: result.metadataURI,
    };
  } catch (error) {
    console.error("Failed to get KYC from blockchain:", error);
    return null;
  }
}

/**
 * Calculate hash of KYC record for blockchain storage
 */
export function calculateKYCHash(kycRecord: any): string {
  // Create a string representation of the record (excluding sensitive data in production)
  const recordString = JSON.stringify({
    recordId: kycRecord.recordId,
    userId: kycRecord.userId,
    timestamp: kycRecord.timestamp,
    status: kycRecord.status,
  });

  return hashData(recordString);
}

/**
 * Verify data integrity using blockchain hash
 */
export function verifyDataIntegrity(localHash: string, blockchainHash: string): boolean {
  return localHash === blockchainHash;
}






