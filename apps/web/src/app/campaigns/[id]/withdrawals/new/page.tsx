"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, getApiUrl } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import {
  CreateWithdrawalRequestSchema,
  type CreateWithdrawalRequestInput,
} from "@opencause/types";
import {
  validateFile,
  computeFileHash,
  formatFileSize,
} from "@/lib/utils/file-upload";
import { Upload, X, CheckCircle2, AlertCircle, Info } from "lucide-react";

interface Campaign {
  id: string;
  title: string;
  raisedInr?: string;
  raisedCrypto?: string;
}

interface Milestone {
  id: string;
  title: string;
  amount: string;
}

export default function NewWithdrawalPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);

  // Fetch campaign details
  const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
    queryKey: ["campaign", campaignId],
    queryFn: async () => {
      return apiRequest<Campaign>(`/campaigns/${campaignId}`);
    },
    enabled: !!campaignId,
  });

  // Fetch milestones
  const { data: milestones } = useQuery<Milestone[]>({
    queryKey: ["campaign-milestones", campaignId],
    queryFn: async () => {
      // TODO: Fetch milestones from API
      return [];
    },
    enabled: !!campaignId,
  });

  // Form setup
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isValid },
  } = useForm<CreateWithdrawalRequestInput>({
    resolver: zodResolver(CreateWithdrawalRequestSchema),
    mode: "onChange",
    defaultValues: {
      currency: "INR",
      payoutRail: "UPI",
    },
  });

  const currency = watch("currency");
  const payoutRail = watch("payoutRail");
  const amount = watch("amount");
  const invoiceAmount = watch("invoiceAmount");

  // File upload handler
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    setSelectedFile(file);
    setUploading(true);

    try {
      // Create preview
      const preview = URL.createObjectURL(file);
      setFilePreview(preview);

      // Compute hash first
      const hash = await computeFileHash(file);
      setFileHash(hash);

      // Upload file using FormData
      const formData = new FormData();
      formData.append("file", file);

      const token = localStorage.getItem("token");
      const apiUrl = getApiUrl();
      const result = await fetch(`${apiUrl}/uploads/proof`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!result.ok) {
        const error = await result.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(error.message || "File upload failed");
      }

      const uploadResult = await result.json();
      setFileUrl(uploadResult.url);

      // Set form values
      setValue("proofFileUrl", uploadResult.url);
      setValue("proofMimeType", uploadResult.mimeType || file.type);
      setValue("proofSha256", uploadResult.sha256 || hash);
    } catch (error: any) {
      alert(error.message || "File upload failed");
      setSelectedFile(null);
      setFilePreview(null);
      setFileHash(null);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setFileUrl(null);
    setFileHash(null);
    setValue("proofFileUrl", "");
    setValue("proofMimeType", "");
    setValue("proofSha256", "");
  };

  // Submit handler
  const { mutate: createWithdrawal, isPending: isSubmitting } = useMutation({
    mutationFn: async (data: CreateWithdrawalRequestInput) => {
      // Clean up data before sending (remove empty optional fields)
      const payload: any = {
        ...data,
        campaignId,
      };
      
      // Remove optional fields based on currency
      if (data.currency === "INR") {
        if (data.payoutRail === "UPI") {
          delete payload.bankAccountNumber;
          delete payload.bankIfsc;
          delete payload.bankBeneficiaryName;
        } else {
          delete payload.upiVpa;
        }
        delete payload.cryptoAddress;
        delete payload.chainId;
      } else {
        delete payload.upiVpa;
        delete payload.bankAccountNumber;
        delete payload.bankIfsc;
        delete payload.bankBeneficiaryName;
        delete payload.vendorGstin; // Optional for crypto
      }
      
      return apiRequest<{ id: string }>("/withdrawals", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      router.push(`/campaigns/${campaignId}/withdrawals/${data.id}`);
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

  const onSubmit = (data: CreateWithdrawalRequestInput) => {
    if (!fileUrl || !fileHash) {
      alert("Please upload a proof file");
      return;
    }
    createWithdrawal(data);
  };

  // Calculate available balance
  // raisedInr is stored in paise (smallest unit), convert to rupees by dividing by 100
  const availableBalance =
    currency === "INR"
      ? parseFloat(campaign?.raisedInr || "0") / 100
      : parseFloat(campaign?.raisedCrypto || "0");

  // Amount mismatch check
  const amountMismatch = Boolean(
    amount && invoiceAmount && Math.abs(parseFloat(amount) - parseFloat(invoiceAmount)) >= 0.01
  );

  if (campaignLoading) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="pt-32 pb-20 px-6 lg:px-8">
          <div className="container mx-auto max-w-4xl">
            <div className="text-center text-white/60">Loading...</div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

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
            <p className="text-white/60">{campaign?.title}</p>
          </motion.div>

          {/* Header Card: Campaign Balance */}
          <Card className="glass mb-8">
            <CardHeader>
              <CardTitle>Campaign Balance</CardTitle>
              <CardDescription>Available funds for withdrawal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-3xl font-bold mb-2">
                    {currency === "INR" ? "₹" : "$"}
                    {availableBalance.toLocaleString("en-IN", {
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-sm text-white/60">
                    Available {currency === "INR" ? "INR" : "Crypto"}
                  </div>
                </div>

                {/* Milestone Selector (if milestones exist) */}
                {milestones && milestones.length > 0 && (
                  <div>
                    <Label htmlFor="milestoneId">Milestone (Optional)</Label>
                    <select
                      id="milestoneId"
                      {...register("milestoneId")}
                      className="w-full mt-2 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                    >
                      <option value="">Direct withdrawal (no milestone)</option>
                      {milestones.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title} - ₹{parseFloat(m.amount).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Main Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Currency Selector */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Currency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      value="INR"
                      {...register("currency")}
                      className="w-4 h-4"
                    />
                    <span>INR</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      value="USDT"
                      {...register("currency")}
                      className="w-4 h-4"
                    />
                    <span>USDT</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      value="USDC"
                      {...register("currency")}
                      className="w-4 h-4"
                    />
                    <span>USDC</span>
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Amount Section */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Amount</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="amount">Withdrawal Amount ({currency})</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    {...register("amount")}
                    placeholder="0.00"
                    className="mt-2"
                  />
                  {errors.amount && (
                    <p className="text-sm text-red-400 mt-1">{errors.amount.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="invoiceAmount">Invoice Amount ({currency})</Label>
                  <Input
                    id="invoiceAmount"
                    type="number"
                    step="0.01"
                    {...register("invoiceAmount")}
                    placeholder="0.00"
                    className="mt-2"
                  />
                  {errors.invoiceAmount && (
                    <p className="text-sm text-red-400 mt-1">{errors.invoiceAmount.message}</p>
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

            {/* Payout Rail (INR only) */}
            {currency === "INR" && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Payout Method</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-4">
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

                  {payoutRail === "UPI" && (
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
                        <p className="text-sm text-red-400 mt-1">{errors.upiVpa.message}</p>
                      )}
                    </div>
                  )}

                  {payoutRail === "BANK" && (
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
                            {errors.bankBeneficiaryName.message}
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
                            {errors.bankAccountNumber.message}
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
                          <p className="text-sm text-red-400 mt-1">{errors.bankIfsc.message}</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Crypto Address (Crypto only) */}
            {currency !== "INR" && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle>Wallet Address</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="cryptoAddress">Recipient Address</Label>
                    <Input
                      id="cryptoAddress"
                      type="text"
                      {...register("cryptoAddress")}
                      placeholder="0x..."
                      className="mt-2 font-mono"
                    />
                    {errors.cryptoAddress && (
                      <p className="text-sm text-red-400 mt-1">{errors.cryptoAddress.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="chainId">Chain ID</Label>
                    <Input
                      id="chainId"
                      type="number"
                      {...register("chainId", { valueAsNumber: true })}
                      placeholder="1 (Ethereum), 137 (Polygon)"
                      className="mt-2"
                    />
                    {errors.chainId && (
                      <p className="text-sm text-red-400 mt-1">{errors.chainId.message}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Proof Section */}
            <Card className="glass">
              <CardHeader>
                <CardTitle>Invoice Proof</CardTitle>
                <CardDescription>
                  Upload invoice image (JPG, PNG, WebP). Max 10MB.{" "}
                  {currency === "INR" && (
                    <span className="text-yellow-400">
                      Invoice must clearly show GSTIN. Requests without GSTIN visible will be
                      rejected.
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!filePreview ? (
                  <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center">
                    <input
                      type="file"
                      id="proof-file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <label htmlFor="proof-file" className="cursor-pointer">
                      <Upload className="w-12 h-12 mx-auto mb-4 text-white/40" />
                      <p className="text-white/60 mb-2">
                        Click to upload or drag and drop invoice image
                      </p>
                      <p className="text-sm text-white/40">Max 10MB</p>
                    </label>
                  </div>
                ) : (
                  <div className="relative">
                    <img
                      src={filePreview}
                      alt="Proof preview"
                      className="w-full h-auto rounded-lg max-h-96 object-contain"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={removeFile}
                      className="absolute top-2 right-2"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    {selectedFile && (
                      <div className="mt-2 text-sm text-white/60">
                        {selectedFile.name} ({formatFileSize(selectedFile.size)})
                      </div>
                    )}
                  </div>
                )}

                {uploading && (
                  <div className="text-sm text-white/60">Uploading proof...</div>
                )}

                {fileHash && (
                  <div className="flex items-center gap-2 text-sm text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Proof uploaded and verified
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
                  <Label htmlFor="vendorName">Vendor Name</Label>
                  <Input
                    id="vendorName"
                    type="text"
                    {...register("vendorName")}
                    placeholder="Vendor or supplier name"
                    className="mt-2"
                  />
                  {errors.vendorName && (
                    <p className="text-sm text-red-400 mt-1">{errors.vendorName.message}</p>
                  )}
                </div>

                {currency === "INR" && (
                  <div>
                    <Label htmlFor="vendorGstin">
                      GSTIN <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      id="vendorGstin"
                      type="text"
                      {...register("vendorGstin")}
                      placeholder="15-character GSTIN"
                      className="mt-2 uppercase"
                      maxLength={15}
                    />
                    {errors.vendorGstin && (
                      <p className="text-sm text-red-400 mt-1">{errors.vendorGstin.message}</p>
                    )}
                    <p className="text-xs text-white/40 mt-1">
                      Must match the GSTIN shown on the invoice
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="invoiceNumber">Invoice Number</Label>
                  <Input
                    id="invoiceNumber"
                    type="text"
                    {...register("invoiceNumber")}
                    placeholder="Invoice number"
                    className="mt-2"
                  />
                  {errors.invoiceNumber && (
                    <p className="text-sm text-red-400 mt-1">{errors.invoiceNumber.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="invoiceDate">Invoice Date</Label>
                  <Input
                    id="invoiceDate"
                    type="date"
                    {...register("invoiceDate")}
                    className="mt-2"
                  />
                  {errors.invoiceDate && (
                    <p className="text-sm text-red-400 mt-1">{errors.invoiceDate.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Processing Time Notice */}
            <Alert className="glass border-blue-500/50">
              <Info className="h-4 w-4 text-blue-400" />
              <AlertDescription className="text-blue-400">
                {currency === "INR"
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
                disabled={!isValid || !fileUrl || isSubmitting || Boolean(amountMismatch)}
                className="flex-1"
              >
                {isSubmitting ? "Submitting..." : "Submit Withdrawal Request"}
              </Button>
            </div>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
}

