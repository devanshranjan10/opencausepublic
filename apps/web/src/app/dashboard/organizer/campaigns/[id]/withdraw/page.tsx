"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { apiRequest, getApiUrl } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion } from "framer-motion";
import { CryptoIcon } from "@/components/ui/crypto-icon";
import {
  CreateWithdrawalRequestSchema,
  type CreateWithdrawalRequestInput,
} from "@opencause/types";
import {
  validateFile,
  computeFileHash,
  formatFileSize,
} from "@/lib/utils/file-upload";
import { Upload, X, CheckCircle2, AlertCircle, Info, ArrowRight } from "lucide-react";

interface AssetBalance {
  assetSymbol: string;
  networkId?: string;
  assetId?: string;
  amountNative: string;
  amountRaw?: string;
  decimals?: number;
  inrValue?: string;
}

interface CampaignBalanceBreakdown {
  campaignId: string;
  totalInr: string;
  assets: AssetBalance[];
  networkFees: {
    ethereum?: string;
    bsc?: string;
    polygon?: string;
    solana?: string;
    [networkId: string]: string | undefined;
  };
}

export default function WithdrawPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;

  const [selectedAsset, setSelectedAsset] = useState<AssetBalance | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<Array<{ file: File; preview: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ url: string; hash: string; mimeType: string; originalName: string }>>([]);
  const [purposeCategory, setPurposeCategory] = useState<string>("");
  const [expenseType, setExpenseType] = useState<string>("");
  const [expenseDescription, setExpenseDescription] = useState<string>("");
  const [isAdvance, setIsAdvance] = useState<boolean>(false);
  const [isReimbursement, setIsReimbursement] = useState<boolean>(false);
  const [vendorGstRegistered, setVendorGstRegistered] = useState<boolean>(false);
  const [useInrForCrypto, setUseInrForCrypto] = useState<boolean>(false); // Toggle for INR input in crypto withdrawals
  const [selectedNetworkId, setSelectedNetworkId] = useState<string>("ethereum_mainnet"); // Selected network/chain

  // Categories that typically require GSTIN
  const categoriesRequiringGstin = ["MATERIALS", "SERVICES", "ADMINISTRATIVE", "MARKETING"];
  const shouldShowGstin = 
    !!purposeCategory && 
    categoriesRequiringGstin.includes(purposeCategory) && 
    vendorGstRegistered;

  // Fetch campaign balance breakdown
  const { data: balance, isLoading: balanceLoading } = useQuery<CampaignBalanceBreakdown>({
    queryKey: ["campaign-balance", campaignId],
    queryFn: async () => {
      return apiRequest<CampaignBalanceBreakdown>(`/campaigns/${campaignId}/balance`);
    },
    enabled: !!campaignId,
  });

  // Form setup - validate manually since union schemas don't work well with zodResolver
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<any>({
    mode: "onChange",
    defaultValues: {
      currency: "INR",
      payoutRail: "UPI",
      milestoneId: "",
      amount: "",
      invoiceNumber: "",
      invoiceDate: "",
      invoiceAmount: "",
      vendorName: "",
      vendorGstin: "",
      upiVpa: "",
      bankAccountNumber: "",
      bankIfsc: "",
      bankBeneficiaryName: "",
      cryptoAddress: "",
      chainId: 1,
      networkId: "ethereum_mainnet",
      amountInr: "",
      proofFileUrl: "",
      proofMimeType: "",
      proofSha256: "",
      purposeCategory: "",
      expenseType: "",
      expenseDescription: "",
      isAdvance: false,
      isReimbursement: false,
    },
  });

  const currency = watch("currency");
  const payoutRail = watch("payoutRail");
  const amount = watch("amount");
  const invoiceAmount = watch("invoiceAmount");

  // Get available networks for a crypto asset
  const getAvailableNetworks = (symbol: string): Array<{ id: string; name: string; chainId: number }> => {
    const networks: Record<string, Array<{ id: string; name: string; chainId: number }>> = {
      "USDC": [
        { id: "ethereum_mainnet", name: "Ethereum", chainId: 1 },
        { id: "polygon_mainnet", name: "Polygon", chainId: 137 },
        { id: "bsc_mainnet", name: "BSC", chainId: 56 },
        { id: "avalanche_mainnet", name: "Avalanche", chainId: 43114 },
        { id: "arbitrum_mainnet", name: "Arbitrum", chainId: 42161 },
        { id: "optimism_mainnet", name: "Optimism", chainId: 10 },
        { id: "base_mainnet", name: "Base", chainId: 8453 },
      ],
      "USDT": [
        { id: "ethereum_mainnet", name: "Ethereum", chainId: 1 },
        { id: "polygon_mainnet", name: "Polygon", chainId: 137 },
        { id: "bsc_mainnet", name: "BSC", chainId: 56 },
        { id: "avalanche_mainnet", name: "Avalanche", chainId: 43114 },
        { id: "arbitrum_mainnet", name: "Arbitrum", chainId: 42161 },
        { id: "optimism_mainnet", name: "Optimism", chainId: 10 },
        { id: "base_mainnet", name: "Base", chainId: 8453 },
      ],
      "ETH": [
        { id: "ethereum_mainnet", name: "Ethereum", chainId: 1 },
      ],
    };
    return networks[symbol] || [{ id: "ethereum_mainnet", name: "Ethereum", chainId: 1 }];
  };

  // Get address placeholder based on network
  const getAddressPlaceholder = (networkId: string): string => {
    if (networkId.includes("ethereum") || networkId.includes("polygon") || networkId.includes("bsc") || 
        networkId.includes("avalanche") || networkId.includes("arbitrum") || networkId.includes("optimism") || 
        networkId.includes("base")) {
      return "0x...";
    } else if (networkId.includes("bitcoin") || networkId.includes("litecoin")) {
      return "bc1... or 1... or 3...";
    } else if (networkId.includes("solana")) {
      return "...";
    }
    return "Enter address";
  };

  const handleAssetSelect = (asset: AssetBalance) => {
    setSelectedAsset(asset);
    const isInr = asset.assetSymbol === "INR";
    
    // Set currency
    setValue("currency", isInr ? "INR" : (asset.assetSymbol as any));
    setValue("payoutRail", isInr ? "UPI" : "CRYPTO");
    
    // Set amount
    setValue("amount", asset.amountNative);
    setUseInrForCrypto(false); // Reset INR input toggle
    
    // Set crypto-specific fields if not INR
    if (!isInr && asset.assetSymbol !== "INR") {
      // Use asset's networkId if available, otherwise default to Ethereum
      const defaultNetwork = asset.networkId || "ethereum_mainnet";
      setSelectedNetworkId(defaultNetwork);
      setValue("networkId", defaultNetwork);
      
      // Set chainId based on network
      const networks = getAvailableNetworks(asset.assetSymbol);
      const network = networks.find(n => n.id === defaultNetwork) || networks[0];
      setValue("chainId", network.chainId);
    }
  };

  const handleNetworkChange = (networkId: string) => {
    setSelectedNetworkId(networkId);
    setValue("networkId", networkId);
    
    // Update chainId based on selected network
    if (selectedAsset && selectedAsset.assetSymbol !== "INR") {
      const networks = getAvailableNetworks(selectedAsset.assetSymbol);
      const network = networks.find(n => n.id === networkId) || networks[0];
      setValue("chainId", network.chainId);
    }
  };

  // File upload handler - supports multiple files
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Validate all files
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    for (const file of files) {
      const validation = validateFile(file, 10 * 1024 * 1024, allowedTypes);
      if (!validation.valid) {
        alert(`File ${file.name}: ${validation.error}`);
        return;
      }
    }

    setUploading(true);

    try {
      // Create previews for images
      const newPreviews = files
        .filter(file => file.type.startsWith("image/"))
        .map(file => ({ file, preview: URL.createObjectURL(file) }));
      setFilePreviews([...filePreviews, ...newPreviews]);
      setSelectedFiles([...selectedFiles, ...files]);

      // Upload files
      const formData = new FormData();
      files.forEach(file => {
        formData.append("files", file);
      });

      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication required");
      }

      // Upload to new R2-based endpoint using campaignId (before withdrawal is created)
      // Upload files one by one (API supports single file per request)
      const apiUrl = getApiUrl();
      const uploadPromises = files.map(async (file) => {
        const singleFileFormData = new FormData();
        singleFileFormData.append("file", file);

        const result = await fetch(`${apiUrl}/campaigns/${campaignId}/proofs/upload`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: singleFileFormData,
        });

        if (!result.ok) {
          const error = await result.json().catch(() => ({ message: "Upload failed" }));
          throw new Error(error.message || `File ${file.name} upload failed`);
        }

        return await result.json();
      });

      const uploadResults = await Promise.all(uploadPromises);
      
      const newUploadedFiles = uploadResults.map((uploadResult, index) => ({
        proofId: uploadResult.proofId,
        url: uploadResult.url || null, // May be null if private, use signed URL endpoint
        hash: uploadResult.objectKey.split('/').pop()?.split('.')[0] || '', // Extract hash from key
        mimeType: files[index]?.type || '',
        originalName: files[index]?.name || "file",
      }));

      setUploadedFiles([...uploadedFiles, ...newUploadedFiles]);

      // Store proofIds instead of URLs (URLs will be fetched when needed)
      const allProofIds = [...uploadedFiles, ...newUploadedFiles].map(f => (f as any).proofId).filter(Boolean);
      setValue("proofFileUrl", JSON.stringify(allProofIds)); // Store proofIds
      setValue("proofSha256", JSON.stringify(allProofIds)); // Reuse field for proofIds

      // Clear input
      event.target.value = "";
    } catch (error: any) {
      alert(error.message || "File upload failed");
      // Revert previews on error
      setFilePreviews(prev => prev.slice(0, prev.length - files.filter(f => f.type.startsWith("image/")).length));
      setSelectedFiles(prev => prev.slice(0, prev.length - files.length));
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    const fileToRemove = selectedFiles[index];
    const previewToRemove = filePreviews.find(p => p.file === fileToRemove);
    
    if (previewToRemove) {
      URL.revokeObjectURL(previewToRemove.preview);
    }

    const newSelectedFiles = selectedFiles.filter((_, i) => i !== index);
    const newPreviews = filePreviews.filter((_, i) => {
      const previewIndex = filePreviews.findIndex(p => p.file === selectedFiles[index]);
      return i !== previewIndex;
    });
    const newUploadedFiles = uploadedFiles.filter((_, i) => i !== index);

    setSelectedFiles(newSelectedFiles);
    setFilePreviews(newPreviews);
    setUploadedFiles(newUploadedFiles);

    // Update form values
    const allUrls = newUploadedFiles.map(f => f.url);
    const allHashes = newUploadedFiles.map(f => f.hash);
    setValue("proofFileUrl", newUploadedFiles.length > 0 ? JSON.stringify(allUrls) : "");
    setValue("proofSha256", newUploadedFiles.length > 0 ? JSON.stringify(allHashes) : "");
    if (newUploadedFiles.length === 0) {
      setValue("proofMimeType", "");
    }
  };

  // Submit handler
  const { mutate: createWithdrawal, isPending: isSubmitting } = useMutation({
    mutationFn: async (payload: any) => {
      return apiRequest<{ id: string }>("/withdrawals", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      alert("Withdrawal request submitted successfully! It will be reviewed by an admin.");
      router.push(`/dashboard/organizer/campaigns/${campaignId}`);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to create withdrawal request";
      const errors = error?.response?.data?.errors;
      if (errors && Array.isArray(errors)) {
        alert(`Validation failed:\n${errors.map((e: any) => `${e.path.join(".")}: ${e.message}`).join("\n")}`);
      } else {
        alert(errorMessage);
      }
    },
  });

  const onSubmit = (data: any) => {
    if (!selectedAsset) {
      alert("Please select an asset to withdraw");
      return;
    }

    if (uploadedFiles.length === 0) {
      alert("Please upload at least one proof file");
      return;
    }
    
    // Prepare proofIds from uploaded files
    const proofIds = uploadedFiles.map(f => (f as any).proofId).filter(Boolean);
    
    // Build evidenceBundle with invoice metadata
    const evidenceBundle = {
      milestoneId: data.milestoneId || "",
      payee: selectedAsset.assetSymbol === "INR" 
        ? (data.payoutRail === "UPI" ? data.upiVpa : data.bankAccountNumber)
        : data.cryptoAddress,
      amount: useInrForCrypto && data.amountInr ? data.amountInr : data.amount,
      artifacts: proofIds.map((proofId: string) => ({
        type: "PROOF",
        hash: proofId, // Using proofId as hash identifier
        cid: proofId,
      })),
      metadata: {
        proofIds,
        vendorName: data.vendorName,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate,
        gstRegistered: vendorGstRegistered,
        gstin: data.vendorGstin || "",
        invoiceAmount: data.invoiceAmount,
        purposeCategory: data.purposeCategory,
        expenseType: data.expenseType,
        expenseDescription: data.expenseDescription,
      },
    };

    // Build submission data matching CreateWithdrawalDto
    const submissionData: any = {
      campaignId,
      milestoneId: data.milestoneId || undefined,
      payee: selectedAsset.assetSymbol === "INR"
        ? (data.payoutRail === "UPI" ? data.upiVpa : data.bankAccountNumber)
        : data.cryptoAddress,
      amount: useInrForCrypto && data.amountInr ? data.amountInr : data.amount,
      amountInr: useInrForCrypto && data.amountInr ? data.amountInr : undefined,
      tokenType: selectedAsset.assetSymbol === "INR" ? "INR" : "CRYPTO",
      evidenceBundle,
      // Bank details for INR
      ...(selectedAsset.assetSymbol === "INR" && data.payoutRail === "BANK" && {
        bankAccountNumber: data.bankAccountNumber,
        bankIfsc: data.bankIfsc,
        bankAccountHolderName: data.bankBeneficiaryName,
      }),
      // Crypto details
      ...(selectedAsset.assetSymbol !== "INR" && {
        networkId: selectedNetworkId || data.networkId,
        chainId: getAvailableNetworks(selectedAsset.assetSymbol).find(n => n.id === selectedNetworkId)?.chainId,
      }),
    };
    
    // Basic validation
    const amountToCheck = useInrForCrypto && data.amountInr ? parseFloat(data.amountInr) : parseFloat(data.amount);
    if (isNaN(amountToCheck) || amountToCheck <= 0) {
      alert("Please enter a valid withdrawal amount");
      return;
    }
    if (!data.invoiceAmount || parseFloat(data.invoiceAmount) <= 0) {
      alert("Please enter a valid invoice amount");
      return;
    }
    if (Math.abs(amountToCheck - parseFloat(data.invoiceAmount)) >= 0.01) {
      alert("Withdrawal amount must exactly match invoice amount");
      return;
    }
    if (!data.vendorName) {
      alert("Please enter vendor name");
      return;
    }
    if (!data.invoiceNumber) {
      alert("Please enter invoice number");
      return;
    }
    if (!data.invoiceDate) {
      alert("Please enter invoice date");
      return;
    }
    if (proofIds.length === 0) {
      alert("Please upload at least one proof file");
      return;
    }
    // GSTIN validation
    if (selectedAsset.assetSymbol === "INR" && vendorGstRegistered && !data.vendorGstin) {
      alert("GSTIN is required when vendor is GST registered");
      return;
    }
    // INR payee validation
    if (selectedAsset.assetSymbol === "INR") {
      if (data.payoutRail === "UPI" && !data.upiVpa) {
        alert("UPI VPA is required for UPI withdrawals");
        return;
      }
      if (data.payoutRail === "BANK") {
        if (!data.bankAccountNumber || !data.bankIfsc || !data.bankBeneficiaryName) {
          alert("Bank account details are required for bank transfer withdrawals");
          return;
        }
      }
    }
    // Crypto address validation
    if (selectedAsset.assetSymbol !== "INR" && !data.cryptoAddress) {
      alert("Crypto address is required for crypto withdrawals");
      return;
    }
    
    createWithdrawal(submissionData);
  };

  const getNetworkFee = (networkId?: string): string => {
    if (!networkId || !balance) return "0";
    const fee =
      balance.networkFees[networkId] ||
      balance.networkFees[networkId.replace("_mainnet", "")] ||
      balance.networkFees[networkId.replace("_testnet", "")] ||
      "0";
    return fee;
  };

  const amountMismatch =
    amount && invoiceAmount && Math.abs(parseFloat(amount) - parseFloat(invoiceAmount)) >= 0.01;

  return (
    <div className="min-h-screen bg-black">
      <Header />
      <div className="pt-32 pb-20 px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-5xl md:text-7xl font-bold mb-4">
              Request
              <br />
              <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                Withdrawal
              </span>
            </h1>
          </motion.div>

          {/* Balance Breakdown */}
          {balanceLoading ? (
            <Card className="glass mb-8">
              <CardContent className="p-8">
                <div className="animate-pulse space-y-4">
                  <div className="h-8 bg-white/10 rounded w-1/3" />
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 bg-white/5 rounded" />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : balance ? (
            <Card className="glass mb-8">
              <CardHeader>
                <CardTitle>Campaign Balance</CardTitle>
                <CardDescription>Available funds for withdrawal</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="text-3xl font-bold mb-2">
                    ₹{parseFloat(balance.totalInr).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-white/60 text-sm">Total Amount Received</div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">Breakdown by Asset</h3>
                    <span className="text-xs text-white/40">Click to select asset for withdrawal</span>
                  </div>
                  {balance.assets.length === 0 ? (
                    <div className="text-center py-8 text-white/40">
                      <p>No donations received yet.</p>
                    </div>
                  ) : (
                    balance.assets.map((asset, index) => {
                      const isSelected =
                        selectedAsset?.assetSymbol === asset.assetSymbol &&
                        selectedAsset?.networkId === asset.networkId;
                      const networkFee = getNetworkFee(asset.networkId);

                      return (
                        <motion.div
                          key={`${asset.assetSymbol}_${asset.networkId || ""}_${index}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + index * 0.05 }}
                          className={`p-5 rounded-xl border-2 cursor-pointer transition-all group ${
                            isSelected
                              ? "border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/20"
                              : "border-white/10 hover:border-white/30 hover:bg-white/10"
                          }`}
                          onClick={() => handleAssetSelect(asset)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                              {asset.assetSymbol === "INR" ? (
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white font-bold text-lg">₹</span>
                                </div>
                              ) : (
                                <div className="flex-shrink-0">
                                  <CryptoIcon symbol={asset.assetSymbol} size={48} />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {asset.assetSymbol === "INR" ? (
                                    <>
                                      <span className="font-bold text-xl">
                                        ₹{parseFloat(asset.amountNative).toLocaleString("en-IN", {
                                          maximumFractionDigits: 2,
                                        })}
                                      </span>
                                      <span className="text-white/70 text-sm">INR</span>
                                    </>
                                  ) : asset.inrValue ? (
                                    <>
                                      <span className="font-bold text-xl">
                                        ${(parseFloat(asset.inrValue) / 83).toFixed(2)} ({parseFloat(asset.amountNative).toLocaleString("en-US", {
                                          maximumFractionDigits: 8,
                                        })} {asset.assetSymbol})
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="font-bold text-xl">
                                        {parseFloat(asset.amountNative).toLocaleString("en-US", {
                                          maximumFractionDigits: 8,
                                        })}
                                      </span>
                                      <span className="text-white/70 text-sm">{asset.assetSymbol}</span>
                                    </>
                                  )}
                                </div>
                                {asset.networkId && (
                                  <div className="text-xs text-white/50 mt-1">
                                    Network: {asset.networkId.replace("_mainnet", "").replace("_testnet", "").toUpperCase()}
                                    {networkFee !== "0" && (
                                      <span className="ml-2">• Fee: ~{networkFee} {asset.networkId.includes("ethereum") ? "ETH" : asset.networkId.includes("bsc") ? "BNB" : asset.networkId.includes("polygon") ? "MATIC" : "SOL"}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              {isSelected ? (
                                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
                                  <CheckCircle2 className="w-4 h-4 text-white" />
                                </div>
                              ) : (
                                <div className="w-6 h-6 rounded-full border-2 border-white/30 flex items-center justify-center group-hover:border-white/50 transition-colors">
                                  <div className="w-2.5 h-2.5 rounded-full bg-white/30 group-hover:bg-white/50 transition-colors" />
                                </div>
                              )}
                              <span className={`text-sm font-medium ${isSelected ? "text-blue-400" : "text-white/40 group-hover:text-white/60"} transition-colors`}>
                                {isSelected ? "Selected" : "Select"}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Withdrawal Form */}
          {selectedAsset && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-blue-400">
                      Withdrawing {selectedAsset.assetSymbol}
                    </p>
                    <p className="text-sm text-white/60 mt-0.5">
                      Available: {parseFloat(selectedAsset.amountNative).toLocaleString("en-US", {
                        maximumFractionDigits: 8,
                      })}{" "}
                      {selectedAsset.assetSymbol}
                      {selectedAsset.inrValue && ` (≈ ₹${parseFloat(selectedAsset.inrValue).toLocaleString("en-IN", { maximumFractionDigits: 2 })})`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedAsset(null);
                      // Clear file previews and revoke URLs
                      filePreviews.forEach(p => URL.revokeObjectURL(p.preview));
                      setSelectedFiles([]);
                      setFilePreviews([]);
                      setUploadedFiles([]);
                      setValue("proofFileUrl", "");
                      setValue("proofMimeType", "");
                      setValue("proofSha256", "");
                    }}
                    className="text-white/60 hover:text-white"
                  >
                    Change Asset
                  </Button>
                </div>
              </div>
              
              <form onSubmit={handleSubmit(onSubmit)} style={{ position: "relative" }}>
                <div className="space-y-6" style={{ overflow: "visible" }}>
                {/* Purpose & Expense Details */}
                <Card className="glass" style={{ overflow: "visible" }}>
                  <CardHeader>
                    <CardTitle>Withdrawal Purpose</CardTitle>
                    <CardDescription>
                      What is this withdrawal for?
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4" style={{ overflow: "visible", position: "relative" }}>
                    <div style={{ position: "relative", zIndex: 50 }}>
                      <Label htmlFor="purposeCategory">
                        Purpose Category <span className="text-red-400">*</span>
                      </Label>
                      <div className="mt-2" style={{ position: "relative", zIndex: 100 }}>
                        <DropdownSelect
                          id="purposeCategory"
                          value={purposeCategory}
                          onChange={(val) => {
                            setPurposeCategory(val);
                            setValue("purposeCategory", val, { shouldValidate: true });
                          }}
                          placeholder="Select a category"
                          options={[
                            { value: "MATERIALS", label: "Materials & Supplies" },
                            { value: "SERVICES", label: "Services" },
                            { value: "EDUCATION", label: "Education" },
                            { value: "HEALTHCARE", label: "Healthcare" },
                            { value: "INFRASTRUCTURE", label: "Infrastructure" },
                            { value: "ADMINISTRATIVE", label: "Administrative" },
                            { value: "MARKETING", label: "Marketing" },
                            { value: "OTHER", label: "Other" },
                          ]}
                        />
                        <input
                          type="hidden"
                          {...register("purposeCategory", { required: true })}
                          value={purposeCategory}
                        />
                      </div>
                      {errors.purposeCategory && (
                        <p className="text-sm text-red-400 mt-1">Purpose category is required</p>
                      )}
                    </div>

                    {purposeCategory && (
                      <>
                        <div>
                          <Label htmlFor="expenseType">
                            Expense Type <span className="text-red-400">*</span>
                          </Label>
                          <Input
                            id="expenseType"
                            type="text"
                            {...register("expenseType", { required: true })}
                            value={expenseType}
                            onChange={(e) => {
                              setExpenseType(e.target.value);
                              setValue("expenseType", e.target.value);
                            }}
                            placeholder={
                              purposeCategory === "EDUCATION"
                                ? "e.g., Tuition, Textbooks, School Supplies"
                                : purposeCategory === "HEALTHCARE"
                                ? "e.g., Medicines, Medical Equipment, Consultation"
                                : purposeCategory === "MATERIALS"
                                ? "e.g., Building Materials, Office Supplies"
                                : "e.g., Specific expense type"
                            }
                            className="mt-2"
                          />
                          {errors.expenseType && (
                            <p className="text-sm text-red-400 mt-1">Expense type is required</p>
                          )}
                          <p className="text-xs text-white/40 mt-1">
                            Provide a specific description of the expense type
                          </p>
                        </div>

                        <div>
                          <Label htmlFor="expenseDescription">
                            Description <span className="text-red-400">*</span>
                          </Label>
                          <textarea
                            id="expenseDescription"
                            {...register("expenseDescription", { required: true })}
                            value={expenseDescription}
                            onChange={(e) => {
                              setExpenseDescription(e.target.value);
                              setValue("expenseDescription", e.target.value);
                            }}
                            placeholder="Describe what this withdrawal will be used for in detail..."
                            rows={4}
                            className="mt-2 flex w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/40 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                          {errors.expenseDescription && (
                            <p className="text-sm text-red-400 mt-1">Description is required</p>
                          )}
                        </div>

                        {/* Advance/Reimbursement Toggle */}
                        <div className="space-y-2">
                          <Label>Payment Type</Label>
                          <div className="flex gap-6">
                            <label className="flex items-center space-x-3 cursor-pointer group">
                              <div className="relative">
                                <input
                                  type="checkbox"
                                  checked={isAdvance}
                                  onChange={(e) => {
                                    setIsAdvance(e.target.checked);
                                    setIsReimbursement(false);
                                    setValue("isAdvance", e.target.checked);
                                    setValue("isReimbursement", false);
                                  }}
                                  className="sr-only peer"
                                />
                                <div className="w-5 h-5 rounded border-2 border-white/30 bg-white/5 peer-checked:bg-blue-500 peer-checked:border-blue-500 transition-all duration-200 flex items-center justify-center group-hover:border-white/50 peer-checked:group-hover:bg-blue-600">
                                  {isAdvance && (
                                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                              <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">Advance Payment</span>
                            </label>
                            <label className="flex items-center space-x-3 cursor-pointer group">
                              <div className="relative">
                                <input
                                  type="checkbox"
                                  checked={isReimbursement}
                                  onChange={(e) => {
                                    setIsReimbursement(e.target.checked);
                                    setIsAdvance(false);
                                    setValue("isReimbursement", e.target.checked);
                                    setValue("isAdvance", false);
                                  }}
                                  className="sr-only peer"
                                />
                                <div className="w-5 h-5 rounded border-2 border-white/30 bg-white/5 peer-checked:bg-blue-500 peer-checked:border-blue-500 transition-all duration-200 flex items-center justify-center group-hover:border-white/50 peer-checked:group-hover:bg-blue-600">
                                  {isReimbursement && (
                                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                              <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">Reimbursement</span>
                            </label>
                          </div>
                          {isAdvance && (
                            <Alert className="border-yellow-500/50 bg-yellow-500/10 mt-2">
                              <AlertCircle className="h-4 w-4 text-yellow-400" />
                              <AlertDescription className="text-yellow-400 text-sm">
                                Advance payments require a quotation. Please upload a quotation document.
                              </AlertDescription>
                            </Alert>
                          )}
                          {isReimbursement && (
                            <Alert className="border-blue-500/50 bg-blue-500/10 mt-2">
                              <Info className="h-4 w-4 text-blue-400" />
                              <AlertDescription className="text-blue-400 text-sm">
                                Reimbursements require payment proof. Please upload payment proof documents.
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>

                        {/* Category-specific requirements */}
                        {purposeCategory === "EDUCATION" && (
                          <Alert className="border-blue-500/50 bg-blue-500/10">
                            <Info className="h-4 w-4 text-blue-400" />
                            <AlertDescription className="text-blue-400 text-sm">
                              For education expenses, you may need to provide institution verification documents.
                            </AlertDescription>
                          </Alert>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Currency and Payout Rail */}
                <Card className="glass">
                  <CardHeader>
                    <CardTitle>Withdraw {selectedAsset.assetSymbol}</CardTitle>
                    <CardDescription>
                      Available: {parseFloat(selectedAsset.amountNative).toLocaleString("en-US", {
                        maximumFractionDigits: 8,
                      })}{" "}
                      {selectedAsset.assetSymbol}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedAsset.assetSymbol === "INR" && (
                      <div>
                        <Label>Payout Method</Label>
                        <div className="flex gap-4 mt-2">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              value="UPI"
                              {...register("payoutRail")}
                              className="w-4 h-4"
                            />
                            <span>UPI</span>
                          </label>
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              value="BANK"
                              {...register("payoutRail")}
                              className="w-4 h-4"
                            />
                            <span>Bank Transfer</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {selectedAsset.assetSymbol === "INR" && payoutRail === "UPI" && (
                      <div>
                        <Label htmlFor="upiVpa">UPI VPA</Label>
                        <Input
                          id="upiVpa"
                          type="text"
                          {...register("upiVpa")}
                          placeholder="yourname@paytm"
                          className="mt-2"
                        />
                        {errors.upiVpa && (
                          <p className="text-sm text-red-400 mt-1">{String(errors.upiVpa.message || 'Invalid UPI VPA')}</p>
                        )}
                      </div>
                    )}

                    {selectedAsset.assetSymbol === "INR" && payoutRail === "BANK" && (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="bankBeneficiaryName">Beneficiary Name</Label>
                          <Input
                            id="bankBeneficiaryName"
                            type="text"
                            {...register("bankBeneficiaryName")}
                            placeholder="Account holder name"
                            className="mt-2"
                          />
                          {errors.bankBeneficiaryName && (
                            <p className="text-sm text-red-400 mt-1">
                              {String(errors.bankBeneficiaryName.message || 'Invalid beneficiary name')}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="bankAccountNumber">Account Number</Label>
                          <Input
                            id="bankAccountNumber"
                            type="text"
                            {...register("bankAccountNumber")}
                            placeholder="8-18 digits"
                            className="mt-2"
                          />
                          {errors.bankAccountNumber && (
                            <p className="text-sm text-red-400 mt-1">
                              {String(errors.bankAccountNumber.message || 'Invalid account number')}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="bankIfsc">IFSC Code</Label>
                          <Input
                            id="bankIfsc"
                            type="text"
                            {...register("bankIfsc")}
                            placeholder="ABCD0123456"
                            className="mt-2 uppercase"
                            maxLength={11}
                          />
                          {errors.bankIfsc && (
                            <p className="text-sm text-red-400 mt-1">{String(errors.bankIfsc.message || 'Invalid IFSC')}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedAsset.assetSymbol !== "INR" && (
                      <>
                        {/* Network/Chain Selection for multi-chain cryptos */}
                        {getAvailableNetworks(selectedAsset.assetSymbol).length > 1 && (
                          <div>
                            <Label htmlFor="networkId">Network / Chain <span className="text-red-400">*</span></Label>
                            <DropdownSelect
                              id="networkId"
                              value={selectedNetworkId}
                              onChange={(val) => handleNetworkChange(val)}
                              placeholder="Select network"
                              options={getAvailableNetworks(selectedAsset.assetSymbol).map(network => ({
                                value: network.id,
                                label: network.name,
                              }))}
                            />
                          </div>
                        )}

                        <div>
                          <Label htmlFor="cryptoAddress">Recipient Address <span className="text-red-400">*</span></Label>
                          <Input
                            id="cryptoAddress"
                            type="text"
                            {...register("cryptoAddress")}
                            placeholder={getAddressPlaceholder(selectedNetworkId)}
                            className="mt-2 font-mono"
                          />
                          {errors.cryptoAddress && (
                            <p className="text-sm text-red-400 mt-1">{String(errors.cryptoAddress.message || 'Invalid crypto address')}</p>
                          )}
                          <p className="text-xs text-white/50 mt-1">
                            Address format for {getAvailableNetworks(selectedAsset.assetSymbol).find(n => n.id === selectedNetworkId)?.name || "selected network"}
                          </p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Amount Section - Only show after category selection */}
                {purposeCategory && (
                  <Card className="glass">
                    <CardHeader>
                      <CardTitle>Amount</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Toggle for INR input (only for crypto) */}
                      {selectedAsset.assetSymbol !== "INR" && (
                        <div className="flex items-center space-x-2 pb-2 border-b border-white/10">
                          <input
                            type="checkbox"
                            id="useInrForCrypto"
                            checked={useInrForCrypto}
                            onChange={(e) => {
                              setUseInrForCrypto(e.target.checked);
                              if (e.target.checked) {
                                setValue("amount", ""); // Clear native amount
                              } else {
                                setValue("amountInr", ""); // Clear INR amount
                              }
                            }}
                            className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 bg-white/10 border-white/20"
                          />
                          <Label htmlFor="useInrForCrypto" className="text-white/80 cursor-pointer">
                            Enter amount in INR (will be converted to {selectedAsset.assetSymbol})
                          </Label>
                        </div>
                      )}

                      {useInrForCrypto && selectedAsset.assetSymbol !== "INR" ? (
                        // INR input for crypto
                        <div>
                          <Label htmlFor="amountInr">Withdrawal Amount (INR) <span className="text-red-400">*</span></Label>
                          <Input
                            id="amountInr"
                            type="number"
                            step="0.01"
                            {...register("amountInr")}
                            placeholder="0.00"
                            className="mt-2"
                          />
                          <p className="text-xs text-white/50 mt-1">
                            Amount will be converted to {selectedAsset.assetSymbol} at current exchange rate
                          </p>
                          {errors.amountInr && (
                            <p className="text-sm text-red-400 mt-1">{String(errors.amountInr.message || 'Invalid INR amount')}</p>
                          )}
                        </div>
                      ) : (
                        // Native crypto amount input
                        <div>
                          <Label htmlFor="amount">Withdrawal Amount ({selectedAsset.assetSymbol}) <span className="text-red-400">*</span></Label>
                          <Input
                            id="amount"
                            type="number"
                            step="0.00000001"
                            {...register("amount")}
                            placeholder="0.00"
                            className="mt-2"
                            max={parseFloat(selectedAsset.amountNative)}
                          />
                          {errors.amount && (
                            <p className="text-sm text-red-400 mt-1">{String(errors.amount.message || 'Invalid amount')}</p>
                          )}
                        </div>
                      )}

                      <div>
                        <Label htmlFor="invoiceAmount">Invoice Amount ({selectedAsset.assetSymbol})</Label>
                        <Input
                          id="invoiceAmount"
                          type="number"
                          step="0.01"
                          {...register("invoiceAmount")}
                          placeholder="0.00"
                          className="mt-2"
                        />
                        {errors.invoiceAmount && (
                          <p className="text-sm text-red-400 mt-1">{String(errors.invoiceAmount.message || 'Invalid invoice amount')}</p>
                        )}
                        {amountMismatch && (
                          <Alert className="mt-2 border-yellow-500/50 bg-yellow-500/10">
                            <AlertCircle className="h-4 w-4 text-yellow-400" />
                            <AlertDescription className="text-yellow-400">
                              Withdrawal amount must exactly match invoice amount
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Invoice Proof & Details - Only show after category selection */}
                {purposeCategory && (
                  <>
                  <Card className="glass">
                    <CardHeader>
                      <CardTitle>Invoice Proof <span className="text-red-400">*</span></CardTitle>
                      <CardDescription>
                        Upload invoice images or PDFs (JPG, PNG, WebP, PDF). Max 10MB per file. You can upload multiple files.
                        {shouldShowGstin && (
                          <span className="text-yellow-400 block mt-1">
                            Invoice must clearly show GSTIN. Requests without GSTIN visible may be rejected.
                          </span>
                        )}
                      </CardDescription>
                    </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center">
                      <input
                        type="file"
                        id="proof-file"
                        accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={uploading}
                      />
                      <label htmlFor="proof-file" className={`cursor-pointer ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}>
                        <Upload className="w-12 h-12 mx-auto mb-4 text-white/40" />
                        <p className="text-white/60 mb-2">
                          Click to upload or drag and drop invoice files
                        </p>
                        <p className="text-sm text-white/40">JPG, PNG, WebP, PDF • Max 10MB per file • Multiple files allowed</p>
                      </label>
                    </div>

                    {filePreviews.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-white/80">Uploaded Files:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedFiles.map((file, index) => {
                            const preview = filePreviews.find(p => p.file === file);
                            const isImage = file.type.startsWith("image/");
                            const isPdf = file.type === "application/pdf";
                            
                            return (
                              <div key={index} className="relative border border-white/10 rounded-lg p-3 bg-white/5">
                                {isImage && preview ? (
                                  <div className="relative">
                                    <img
                                      src={preview.preview}
                                      alt={`Preview ${index + 1}`}
                                      className="w-full h-auto rounded-lg max-h-48 object-contain"
                                    />
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => removeFile(index)}
                                      className="absolute top-2 right-2"
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ) : isPdf ? (
                                  <div className="flex items-center gap-3 p-4">
                                    <div className="flex-shrink-0 w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center">
                                      <span className="text-red-400 font-bold text-lg">PDF</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-white truncate">{file.name}</p>
                                      <p className="text-xs text-white/60">{formatFileSize(file.size)}</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => removeFile(index)}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3 p-4">
                                    <div className="flex-shrink-0 w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
                                      <Upload className="w-6 h-6 text-white/60" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-white truncate">{file.name}</p>
                                      <p className="text-xs text-white/60">{formatFileSize(file.size)}</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => removeFile(index)}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {uploading && (
                      <div className="text-sm text-white/60 flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white/60"></div>
                        Uploading files...
                      </div>
                    )}
                  </CardContent>
                  </Card>

                  {/* Invoice Details */}
                  <Card className="glass">
                    <CardHeader>
                      <CardTitle>Invoice Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="vendorName">Vendor Name <span className="text-red-400">*</span></Label>
                        <Input
                          id="vendorName"
                          type="text"
                          {...register("vendorName", { required: true })}
                          placeholder="Vendor or supplier name"
                          className="mt-2"
                        />
                        {errors.vendorName && (
                          <p className="text-sm text-red-400 mt-1">{String(errors.vendorName.message || 'Invalid vendor name')}</p>
                        )}
                      </div>

                      {/* GST Registered Checkbox - Only show for categories that might require GSTIN */}
                      {categoriesRequiringGstin.includes(purposeCategory) && (
                        <div className="pb-2">
                          <label className="flex items-center space-x-3 cursor-pointer group">
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={vendorGstRegistered}
                                onChange={(e) => {
                                  setVendorGstRegistered(e.target.checked);
                                  if (!e.target.checked) {
                                    setValue("vendorGstin", "");
                                  }
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-5 h-5 rounded border-2 border-white/30 bg-white/5 peer-checked:bg-blue-500 peer-checked:border-blue-500 transition-all duration-200 flex items-center justify-center group-hover:border-white/50 peer-checked:group-hover:bg-blue-600">
                                {vendorGstRegistered && (
                                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </div>
                            <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">
                              Vendor is GST registered
                            </span>
                          </label>
                        </div>
                      )}

                      {/* GSTIN Field - Only show if vendor is GST registered and category requires it */}
                      {shouldShowGstin && (
                        <div>
                          <Label htmlFor="vendorGstin">GSTIN</Label>
                          <Input
                            id="vendorGstin"
                            type="text"
                            {...register("vendorGstin")}
                            placeholder="15-character GSTIN"
                            className="mt-2 uppercase"
                            maxLength={15}
                          />
                          {errors.vendorGstin && (
                            <p className="text-sm text-red-400 mt-1">{String(errors.vendorGstin.message || 'Invalid GSTIN')}</p>
                          )}
                          <p className="text-xs text-white/40 mt-1">
                            Must match the GSTIN shown on the invoice
                          </p>
                        </div>
                      )}

                      <div>
                        <Label htmlFor="invoiceNumber">Invoice Number <span className="text-red-400">*</span></Label>
                        <Input
                          id="invoiceNumber"
                          type="text"
                          {...register("invoiceNumber", { required: true })}
                          placeholder="Invoice number"
                          className="mt-2"
                        />
                        {errors.invoiceNumber && (
                          <p className="text-sm text-red-400 mt-1">{String(errors.invoiceNumber.message || 'Invalid invoice number')}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="invoiceDate">Invoice Date <span className="text-red-400">*</span></Label>
                        <input
                          id="invoiceDate"
                          type="date"
                          {...register("invoiceDate", { required: true })}
                          className="mt-2 flex h-12 w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/40 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:invert"
                        />
                        {errors.invoiceDate && (
                          <p className="text-sm text-red-400 mt-1">{String(errors.invoiceDate.message || 'Invalid invoice date')}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  </>
                )}

                {/* Processing Time Notice */}
                <Alert className="glass border-blue-500/50">
                  <Info className="h-4 w-4 text-blue-400" />
                  <AlertDescription className="text-blue-400">
                    {selectedAsset.assetSymbol === "INR"
                      ? "INR withdrawals can take up to 7 days due to bank + OpenCause due diligence."
                      : "Crypto will be sent instantly once proof is verified & approved."}
                  </AlertDescription>
                </Alert>

                {/* Submit Button */}
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={uploadedFiles.length === 0 || isSubmitting || amountMismatch}
                    className="flex-1"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Withdrawal Request"}
                  </Button>
                </div>
                </div>
              </form>
            </motion.div>
          )}

          {!selectedAsset && balance && balance.assets.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-2xl p-12 border-2 border-dashed border-white/20"
            >
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 mb-4">
                  <ArrowRight className="w-8 h-8 text-white/60" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Select an Asset to Withdraw</h3>
                <p className="text-white/60 mb-4">
                  Click on any asset in the breakdown above to start your withdrawal request
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {balance.assets.map((asset) => (
                    <span
                      key={`${asset.assetSymbol}_${asset.networkId || ""}`}
                      className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm text-white/70"
                    >
                      {asset.assetSymbol}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
