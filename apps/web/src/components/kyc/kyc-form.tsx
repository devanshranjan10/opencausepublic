"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { KYCFormData, DocumentType } from "@/lib/kyc/types";
import { COUNTRIES } from "@/lib/kyc/config";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DocumentUpload } from "./document-upload";

const phoneCountryCodes = [
  { code: "+1", country: "US/CA" },
  { code: "+44", country: "UK" },
  { code: "+91", country: "India" },
  { code: "+86", country: "China" },
  { code: "+81", country: "Japan" },
  { code: "+49", country: "Germany" },
  { code: "+33", country: "France" },
  { code: "+39", country: "Italy" },
  { code: "+34", country: "Spain" },
  { code: "+61", country: "Australia" },
  // Add more as needed
];

const kycFormSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  dateOfBirth: z.string().refine((date) => {
    const birthDate = new Date(date);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age;
    return actualAge >= 18;
  }, "You must be at least 18 years old"),
  nationality: z.string().min(1, "Please select your nationality"),
  email: z.string().email("Invalid email address"),
  phoneCountryCode: z.string().min(1, "Please select country code"),
  phoneNumber: z.string().min(8, "Phone number must be at least 8 digits").regex(/^\d+$/, "Phone number must contain only digits"),
  street: z.string().min(5, "Street address must be at least 5 characters"),
  city: z.string().min(2, "City must be at least 2 characters"),
  state: z.string().min(2, "State must be at least 2 characters"),
  zipCode: z.string().min(4, "Zip code must be at least 4 characters"),
  country: z.string().min(1, "Please select your country"),
  documentType: z.enum(["PASSPORT", "DRIVER_LICENSE", "NATIONAL_ID"]),
  governmentIdNumber: z.string().min(5, "ID number must be at least 5 characters"),
  documentFront: z.string().min(1, "Please upload the front of your ID document"),
  documentBack: z.string().optional(),
  proofOfAddress: z.string().optional(),
  additionalNotes: z.string().optional(),
});

type KYCFormValues = z.infer<typeof kycFormSchema>;

interface KYCFormProps {
  onSubmit: (data: KYCFormData) => void;
  initialData?: Partial<KYCFormData>;
}

export function KYCForm({ onSubmit, initialData }: KYCFormProps) {
  const [documentFrontOcr, setDocumentFrontOcr] = useState<{ extractedText: string; matchedKeywords: string[] } | undefined>(initialData?.documentFrontOcr);
  const [documentBackOcr, setDocumentBackOcr] = useState<{ extractedText: string; matchedKeywords: string[] } | undefined>(initialData?.documentBackOcr);
  const [proofOfAddressOcr, setProofOfAddressOcr] = useState<{ extractedText: string; matchedKeywords: string[] } | undefined>(initialData?.proofOfAddressOcr);
  
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    setValue,
    reset,
    trigger,
  } = useForm<KYCFormValues>({
    resolver: zodResolver(kycFormSchema),
    defaultValues: {
      fullName: initialData?.fullName || "",
      dateOfBirth: initialData?.dateOfBirth || "",
      nationality: initialData?.nationality || "",
      email: initialData?.email || "",
      phoneCountryCode: initialData?.phoneCountryCode || "+1",
      phoneNumber: initialData?.phoneNumber || "",
      street: initialData?.street || "",
      city: initialData?.city || "",
      state: initialData?.state || "",
      zipCode: initialData?.zipCode || "",
      country: initialData?.country || "",
      documentType: (initialData?.documentType || "PASSPORT") as DocumentType,
      governmentIdNumber: initialData?.governmentIdNumber || "",
      documentFront: initialData?.documentFront || "",
      documentBack: initialData?.documentBack || "",
      proofOfAddress: initialData?.proofOfAddress || "",
      additionalNotes: initialData?.additionalNotes || "",
    },
    mode: "onChange",
  });

  // Update form when initialData changes (for when user goes back)
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      reset({
        fullName: initialData.fullName || "",
        dateOfBirth: initialData.dateOfBirth || "",
        nationality: initialData.nationality || "",
        email: initialData.email || "",
        phoneCountryCode: initialData.phoneCountryCode || "+1",
        phoneNumber: initialData.phoneNumber || "",
        street: initialData.street || "",
        city: initialData.city || "",
        state: initialData.state || "",
        zipCode: initialData.zipCode || "",
        country: initialData.country || "",
        documentType: (initialData.documentType || "PASSPORT") as DocumentType,
        governmentIdNumber: initialData.governmentIdNumber || "",
        documentFront: initialData.documentFront || "",
        documentBack: initialData.documentBack || "",
        proofOfAddress: initialData.proofOfAddress || "",
        additionalNotes: initialData.additionalNotes || "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  const documentType = watch("documentType");

  const handleFormSubmit = async (data: KYCFormValues) => {
    // Validate all fields before submission
    const isValid = await trigger();
    if (!isValid) {
      return;
    }

    const formData: KYCFormData = {
      fullName: data.fullName,
      dateOfBirth: data.dateOfBirth,
      nationality: data.nationality,
      email: data.email,
      phoneNumber: data.phoneNumber,
      phoneCountryCode: data.phoneCountryCode,
      street: data.street,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,
      country: data.country,
      documentType: data.documentType,
      governmentIdNumber: data.governmentIdNumber,
      documentFront: data.documentFront,
      documentBack: data.documentBack,
      proofOfAddress: data.proofOfAddress,
      additionalNotes: data.additionalNotes || "",
      documentFrontOcr,
      documentBackOcr,
      proofOfAddressOcr,
    };
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8">
      {/* Personal Information */}
      <div className="space-y-5">
        <h3 className="text-xl font-semibold text-white mb-5">Personal Information</h3>
        
        <div>
          <Label htmlFor="fullName">Full Name *</Label>
          <Input
            id="fullName"
            {...register("fullName")}
            placeholder="John Doe"
            className={errors.fullName ? "border-red-500" : ""}
          />
          {errors.fullName && (
            <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.fullName.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="dateOfBirth">Date of Birth *</Label>
          <Input
            id="dateOfBirth"
            type="date"
            {...register("dateOfBirth")}
            className={errors.dateOfBirth ? "border-red-500" : ""}
            max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split("T")[0]}
          />
          {errors.dateOfBirth && (
            <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.dateOfBirth.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="nationality">Nationality *</Label>
          <select
            id="nationality"
            {...register("nationality")}
            className="flex h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Select nationality</option>
            {COUNTRIES.map((country) => (
              <option key={country} value={country} className="bg-gray-900">
                {country}
              </option>
            ))}
          </select>
          {errors.nationality && (
            <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.nationality.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="email">Email Address *</Label>
          <Input
            id="email"
            type="email"
            {...register("email")}
            placeholder="john.doe@example.com"
            className={errors.email ? "border-red-500" : ""}
          />
          {errors.email && (
            <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="phoneCountryCode">Country Code *</Label>
            <select
              id="phoneCountryCode"
              {...register("phoneCountryCode")}
              className="flex h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              {phoneCountryCodes.map(({ code, country }) => (
                <option key={code} value={code} className="bg-gray-900">
                  {code} ({country})
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <Label htmlFor="phoneNumber">Phone Number *</Label>
            <Input
              id="phoneNumber"
              type="tel"
              {...register("phoneNumber")}
              placeholder="1234567890"
              className={errors.phoneNumber ? "border-red-500" : ""}
            />
            {errors.phoneNumber && (
              <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.phoneNumber.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-5">
        <h3 className="text-xl font-semibold text-white mb-5">Residential Address</h3>
        
        <div>
          <Label htmlFor="street">Street Address *</Label>
          <Input
            id="street"
            {...register("street")}
            placeholder="123 Main Street"
            className={errors.street ? "border-red-500" : ""}
          />
          {errors.street && (
            <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.street.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="city">City *</Label>
            <Input
              id="city"
              {...register("city")}
              placeholder="New York"
              className={errors.city ? "border-red-500" : ""}
            />
            {errors.city && (
              <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.city.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="state">State/Province *</Label>
            <Input
              id="state"
              {...register("state")}
              placeholder="NY"
              className={errors.state ? "border-red-500" : ""}
            />
            {errors.state && (
              <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.state.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="zipCode">Zip/Postal Code *</Label>
            <Input
              id="zipCode"
              {...register("zipCode")}
              placeholder="10001"
              className={errors.zipCode ? "border-red-500" : ""}
            />
            {errors.zipCode && (
              <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.zipCode.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="country">Country *</Label>
            <select
              id="country"
              {...register("country")}
              className="flex h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c} className="bg-gray-900">
                  {c}
                </option>
              ))}
            </select>
            {errors.country && (
              <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.country.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ID Information */}
      <div className="space-y-5">
        <h3 className="text-xl font-semibold text-white mb-5">Identity Document</h3>
        
        <div>
          <Label htmlFor="documentType">Document Type *</Label>
          <select
            id="documentType"
            {...register("documentType")}
            className="flex h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            <option value="PASSPORT">Passport</option>
            <option value="DRIVER_LICENSE">Driver's License</option>
            <option value="NATIONAL_ID">National ID</option>
          </select>
        </div>

        <div>
          <Label htmlFor="governmentIdNumber">
            {documentType === "PASSPORT" ? "Passport" : documentType === "DRIVER_LICENSE" ? "Driver's License" : "National ID"} Number *
          </Label>
          <Input
            id="governmentIdNumber"
            {...register("governmentIdNumber")}
            placeholder="Enter your ID number"
            className={errors.governmentIdNumber ? "border-red-500" : ""}
          />
          {errors.governmentIdNumber && (
            <p className="text-red-400 text-sm mt-1 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.governmentIdNumber.message}
            </p>
          )}
        </div>
      </div>

      {/* Document Upload */}
      <div className="space-y-5">
        <h3 className="text-xl font-semibold text-white mb-5">Document Upload</h3>
        
        <DocumentUpload
          label="ID Document Front"
          accept="image/*"
          maxSizeMB={10}
          value={watch("documentFront")}
          onChange={(base64) => setValue("documentFront", base64 || "")}
          onOcrDataChange={(ocrData) => setDocumentFrontOcr(ocrData)}
          required={true}
        />

        <DocumentUpload
          label="ID Document Back (if applicable)"
          accept="image/*"
          maxSizeMB={10}
          value={watch("documentBack")}
          onChange={(base64) => setValue("documentBack", base64 || "")}
          onOcrDataChange={(ocrData) => setDocumentBackOcr(ocrData)}
          required={false}
        />

        <DocumentUpload
          label="Proof of Address"
          accept="image/*,application/pdf"
          maxSizeMB={10}
          value={watch("proofOfAddress")}
          onChange={(base64) => setValue("proofOfAddress", base64 || "")}
          onOcrDataChange={(ocrData) => setProofOfAddressOcr(ocrData)}
          required={false}
        />
      </div>

      <div className="pt-4">
        <Button 
          type="submit" 
          size="lg" 
          className="w-full" 
          disabled={!isValid}
        >
          Continue to Face Verification
        </Button>
      </div>
    </form>
  );
}

