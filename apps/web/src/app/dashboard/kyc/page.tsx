"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getKYCStatus, submitKYC, type KYCSubmitRequest } from "@/lib/kyc/api";
import { KYCFormData, FaceData, LivenessData } from "@/lib/kyc/types";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Clock, XCircle, CheckCircle2, X, ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { KYCForm } from "@/components/kyc/kyc-form";
import { FaceCapture } from "@/components/kyc/face-capture";
import { LivenessDetection } from "@/components/kyc/liveness-detection";
import { matchFaces } from "@/lib/kyc/face-matching";
import { compressImage, compressImages } from "@/lib/kyc/image-compression";

type KYCStep = "form" | "face" | "liveness" | "faceMatch" | "complete";

export default function KYCPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<KYCStep>("form");
  const [formData, setFormData] = useState<Partial<KYCFormData>>({});
  const [faceData, setFaceData] = useState<FaceData | null>(null);
  const [livenessData, setLivenessData] = useState<LivenessData[]>([]);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get KYC status
  const { data: kycStatus, isLoading: kycLoading } = useQuery({
    queryKey: ["kyc-status"],
    queryFn: async () => {
      try {
        return await getKYCStatus();
      } catch (error) {
        return { status: "NOT_STARTED" };
      }
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  // Check if user can submit KYC
  const canSubmitKYC = !kycStatus?.status || 
    kycStatus?.status === "NOT_STARTED" || 
    kycStatus?.status === "REJECTED";

  const isPendingOrInReview = kycStatus?.status === "PENDING" || 
    kycStatus?.status === "IN_REVIEW" || 
    kycStatus?.status === "UNDER_REVIEW";

  // Show modal if KYC is pending or in review
  useEffect(() => {
    if (!kycLoading && isPendingOrInReview) {
      setShowStatusModal(true);
    }
  }, [kycLoading, isPendingOrInReview]);

  // Get status message
  const getStatusMessage = () => {
    const status = kycStatus?.status || "NOT_STARTED";
    switch (status) {
      case "PENDING":
        return {
          title: "KYC Submission Pending",
          message: "Your KYC submission is currently pending review. Please wait for a response before submitting again.",
          icon: Clock,
          color: "yellow",
        };
      case "IN_REVIEW":
      case "UNDER_REVIEW":
        return {
          title: "KYC Under Review",
          message: "Your KYC is currently being reviewed by our team. You'll be notified once a decision is made. Please do not submit another KYC until you receive a response.",
          icon: Clock,
          color: "blue",
        };
      case "APPROVED":
      case "VERIFIED":
        return {
          title: "KYC Verified",
          message: "Your KYC has been approved. You can now create campaigns.",
          icon: CheckCircle2,
          color: "green",
        };
      case "REJECTED":
        return {
          title: "KYC Rejected",
          message: "Your KYC submission was rejected. You can review the feedback and resubmit.",
          icon: XCircle,
          color: "red",
        };
      default:
        return null;
    }
  };

  const statusMessage = getStatusMessage();

  // Handle form submission - move to face capture
  const handleFormSubmit = (data: KYCFormData) => {
    setFormData(data);
    setCurrentStep("face");
    setError(null);
  };

  // Handle face capture - move to liveness
  const handleFaceCapture = async (capturedFaceData: FaceData) => {
    setFaceData(capturedFaceData);
    setCurrentStep("liveness");
    setError(null);
  };

  // Handle liveness completion - move to face matching step
  const handleLivenessComplete = async (livenessResults: LivenessData[]) => {
    setLivenessData(livenessResults);
    setError(null);
    setCurrentStep("faceMatch");
  };

  // Handle face matching - Step 4
  const [faceMatchScore, setFaceMatchScore] = useState<number | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<{ matched: boolean; score: number } | null>(null);

  useEffect(() => {
    if (currentStep === "faceMatch" && faceData && formData.documentFront && !faceMatchScore) {
      performFaceMatching();
    }
  }, [currentStep, faceData, formData.documentFront]);

  const performFaceMatching = async () => {
    if (!faceData || !formData.documentFront) return;
    
    setIsMatching(true);
    setError(null);
    
    try {
      const documentFaceData: FaceData = {
        image: formData.documentFront,
        quality: 0.8,
      };
      
      const result = await matchFaces(documentFaceData, faceData);
      const score = result.score; // Already in percentage (0-100)
      
      setFaceMatchScore(score);
      setMatchResult({ matched: result.matched, score });
      
      // If match > 55%, auto-submit for verification
      if (result.matched && score >= 55) {
        // Auto-verify: submit with high confidence
        const livenessPassed = livenessData.every((l) => l.completed);
        const overallScore = livenessPassed ? 0.9 : 0.7;
        await submitKYCData(score / 100, overallScore, "VERIFIED");
      }
      // Otherwise, wait for user decision (retry or send for review)
    } catch (err: any) {
      setError(err.message || "Face matching failed. Please try again.");
      setIsMatching(false);
    } finally {
      setIsMatching(false);
    }
  };

  const handleRetryFaceCapture = () => {
    setFaceMatchScore(null);
    setMatchResult(null);
    setCurrentStep("face");
  };

  const handleSendForReview = async () => {
    // Submit with lower confidence, send for admin review
    const livenessPassed = livenessData.every((l) => l.completed);
    const overallScore = livenessPassed ? 0.6 : 0.4;
    await submitKYCData((faceMatchScore || 0) / 100, overallScore, "PENDING");
  };

  // Submit KYC to backend
  const submitKYCData = async (faceMatchScore: number, overallScore: number, initialStatus: string = "PENDING") => {
    setSubmitting(true);
    setError(null);

    try {
      if (!formData.fullName || !formData.dateOfBirth || !formData.nationality ||
          !formData.email || !formData.phoneNumber || !formData.street ||
          !formData.city || !formData.state || !formData.zipCode ||
          !formData.country || !formData.documentType || !formData.governmentIdNumber ||
          !formData.documentFront || !faceData) {
        throw new Error("Missing required KYC data");
      }

      // Compress images before submission to reduce payload size
      console.log("Compressing images before submission...");
      const [
        compressedDocumentFront,
        compressedDocumentBack,
        compressedProofOfAddress,
        compressedFaceImage,
        ...compressedLivenessImages
      ] = await Promise.all([
        compressImage(formData.documentFront, 1920, 1920, 0.85),
        formData.documentBack ? compressImage(formData.documentBack, 1920, 1920, 0.85) : Promise.resolve(""),
        formData.proofOfAddress ? compressImage(formData.proofOfAddress, 1920, 1920, 0.85) : Promise.resolve(""),
        compressImage(faceData.image, 1280, 1280, 0.9),
        ...livenessData.flatMap(l => l.images).map(img => compressImage(img, 1280, 1280, 0.85)),
      ]);

      // Reconstruct liveness data with compressed images
      let livenessImageIndex = 0;
      const compressedLivenessData = livenessData.map((l) => {
        const imageCount = l.images.length;
        const compressedImages = compressedLivenessImages.slice(livenessImageIndex, livenessImageIndex + imageCount);
        livenessImageIndex += imageCount;
        return {
          action: l.action,
          images: compressedImages,
          timestamp: l.timestamp,
        };
      });

      const submitData: KYCSubmitRequest & { initialStatus?: string } = {
        personalInfo: {
          fullName: formData.fullName,
          dateOfBirth: formData.dateOfBirth,
          nationality: formData.nationality,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          phoneCountryCode: formData.phoneCountryCode || "+1",
          street: formData.street,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          country: formData.country,
          documentType: formData.documentType,
          governmentIdNumber: formData.governmentIdNumber,
          additionalNotes: formData.additionalNotes,
        },
        documentFront: compressedDocumentFront,
        documentBack: compressedDocumentBack || undefined,
        proofOfAddress: compressedProofOfAddress || undefined,
        documentFrontOcr: formData.documentFrontOcr,
        documentBackOcr: formData.documentBackOcr,
        proofOfAddressOcr: formData.proofOfAddressOcr,
        faceData: {
          image: compressedFaceImage,
          quality: faceData.quality,
          embedding: faceData.embedding,
          landmarks: faceData.landmarks,
        },
        livenessData: compressedLivenessData,
        faceMatchScore,
        overallScore,
        initialStatus, // Pass the status to backend
      };

      const result = await submitKYC(submitData);
      
      // Update local status immediately
      if (initialStatus === "VERIFIED") {
        // Refetch status to update UI
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
      
      setCurrentStep("complete");
      setTimeout(() => {
        router.push("/dashboard/organizer/individual");
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Failed to submit KYC. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // If KYC is already verified, redirect
  useEffect(() => {
    if (kycStatus?.status === "VERIFIED" || kycStatus?.status === "APPROVED") {
      router.push("/dashboard/organizer/individual");
    }
  }, [kycStatus, router]);

  if (kycLoading) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="pt-32 pb-20 px-6 lg:px-8">
          <div className="container mx-auto max-w-3xl text-center">
            <p className="text-white/60">Loading...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Header />

      {/* Status Modal */}
      <AnimatePresence>
        {showStatusModal && statusMessage && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`glass rounded-2xl p-8 max-w-md w-full border ${
                statusMessage.color === "yellow"
                  ? "border-yellow-500/50"
                  : statusMessage.color === "blue"
                  ? "border-blue-500/50"
                  : statusMessage.color === "green"
                  ? "border-green-500/50"
                  : "border-red-500/50"
              }`}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <statusMessage.icon
                    className={`w-6 h-6 ${
                      statusMessage.color === "yellow"
                        ? "text-yellow-400"
                        : statusMessage.color === "blue"
                        ? "text-blue-400"
                        : statusMessage.color === "green"
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  />
                  <h2 className="text-2xl font-bold">{statusMessage.title}</h2>
                </div>
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-white/80 mb-6 leading-relaxed">
                {statusMessage.message}
              </p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => router.push("/dashboard/organizer/individual")}
                  className="flex-1"
                >
                  Go to Dashboard
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="pt-32 pb-20 px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-5xl md:text-7xl font-bold mb-4">
              KYC
              <br />
              <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                Verification
              </span>
            </h1>
            <p className="text-white/60 text-lg mt-4">
              Complete your identity verification to create campaigns
            </p>
          </motion.div>

          {/* Progress Steps */}
          <div className="mb-8 flex items-center justify-center gap-4">
            <div className={`flex items-center gap-2 ${currentStep === "form" ? "text-white" : currentStep !== "form" ? "text-green-400" : "text-white/40"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep === "form" ? "bg-white text-black" : 
                ["face", "liveness", "complete"].includes(currentStep) ? "bg-green-500 text-white" : 
                "bg-white/10 text-white/40"
              }`}>
                1
              </div>
              <span className="text-sm font-medium">Form</span>
            </div>
            <div className={`w-12 h-0.5 ${["face", "liveness", "complete"].includes(currentStep) ? "bg-green-500" : "bg-white/10"}`} />
            <div className={`flex items-center gap-2 ${currentStep === "face" ? "text-white" : ["liveness", "complete"].includes(currentStep) ? "text-green-400" : "text-white/40"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep === "face" ? "bg-white text-black" : 
                ["liveness", "complete"].includes(currentStep) ? "bg-green-500 text-white" : 
                "bg-white/10 text-white/40"
              }`}>
                2
              </div>
              <span className="text-sm font-medium">Face</span>
            </div>
            <div className={`w-12 h-0.5 ${["liveness", "faceMatch", "complete"].includes(currentStep) ? "bg-green-500" : "bg-white/10"}`} />
            <div className={`flex items-center gap-2 ${currentStep === "liveness" ? "text-white" : ["faceMatch", "complete"].includes(currentStep) ? "text-green-400" : "text-white/40"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep === "liveness" ? "bg-white text-black" : 
                ["faceMatch", "complete"].includes(currentStep) ? "bg-green-500 text-white" : 
                "bg-white/10 text-white/40"
              }`}>
                3
              </div>
              <span className="text-sm font-medium">Liveness</span>
            </div>
            <div className={`w-12 h-0.5 ${["faceMatch", "complete"].includes(currentStep) ? "bg-green-500" : "bg-white/10"}`} />
            <div className={`flex items-center gap-2 ${currentStep === "faceMatch" ? "text-white" : currentStep === "complete" ? "text-green-400" : "text-white/40"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep === "faceMatch" ? "bg-white text-black" : 
                currentStep === "complete" ? "bg-green-500 text-white" : 
                "bg-white/10 text-white/40"
              }`}>
                4
              </div>
              <span className="text-sm font-medium">Match</span>
            </div>
          </div>

          {/* Status Alert */}
          {!canSubmitKYC && statusMessage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <Alert
                className={
                  statusMessage.color === "yellow"
                    ? "border-yellow-500/50 bg-yellow-500/10"
                    : statusMessage.color === "blue"
                    ? "border-blue-500/50 bg-blue-500/10"
                    : statusMessage.color === "green"
                    ? "border-green-500/50 bg-green-500/10"
                    : "border-red-500/50 bg-red-500/10"
                }
              >
                <statusMessage.icon
                  className={
                    statusMessage.color === "yellow"
                      ? "h-4 w-4 text-yellow-400"
                      : statusMessage.color === "blue"
                      ? "h-4 w-4 text-blue-400"
                      : statusMessage.color === "green"
                      ? "h-4 w-4 text-green-400"
                      : "h-4 w-4 text-red-400"
                  }
                />
                <AlertDescription
                  className={
                    statusMessage.color === "yellow"
                      ? "text-yellow-400"
                      : statusMessage.color === "blue"
                      ? "text-blue-400"
                      : statusMessage.color === "green"
                      ? "text-green-400"
                      : "text-red-400"
                  }
                >
                  <strong>{statusMessage.title}:</strong> {statusMessage.message}
                </AlertDescription>
              </Alert>
            </motion.div>
          )}

          {/* Error Alert */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <Alert className="border-red-500/50 bg-red-500/10">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-400">{error}</AlertDescription>
              </Alert>
            </motion.div>
          )}

          {/* Step 1: KYC Form */}
          {canSubmitKYC && currentStep === "form" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-2xl p-8"
            >
              <KYCForm onSubmit={handleFormSubmit} initialData={formData} />
            </motion.div>
          )}

          {/* Step 2: Face Capture */}
          {canSubmitKYC && currentStep === "face" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-8"
            >
              <div className="mb-6">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep("form")}
                  className="mb-4"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Form
                </Button>
                <h2 className="text-2xl font-bold mb-2">Face Verification</h2>
                <p className="text-white/60">
                  Please position your face in the camera frame. Ensure good lighting and look directly at the camera.
                </p>
              </div>
              <FaceCapture
                onCapture={handleFaceCapture}
                onError={(err) => setError(err)}
              />
            </motion.div>
          )}

          {/* Step 3: Liveness Detection */}
          {canSubmitKYC && currentStep === "liveness" && faceData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-8"
            >
              <div className="mb-6">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep("face")}
                  className="mb-4"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Face Capture
                </Button>
                <h2 className="text-2xl font-bold mb-2">Liveness Detection</h2>
                <p className="text-white/60">
                  Complete the following challenges to prove you are a real person. Follow the on-screen instructions.
                </p>
              </div>
              <LivenessDetection
                faceImage={faceData.image}
                onComplete={handleLivenessComplete}
                onError={(err) => setError(err)}
              />
            </motion.div>
          )}

          {/* Step 4: Face Matching */}
          {canSubmitKYC && currentStep === "faceMatch" && faceData && formData.documentFront && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-8"
            >
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Face Verification</h2>
                <p className="text-white/60">
                  We're comparing your captured face with the photo on your ID document.
                </p>
              </div>

              {isMatching && (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                  <p className="text-white/60">Matching faces...</p>
                </div>
              )}

              {matchResult && !isMatching && (
                <div className="flex items-center justify-center min-h-[400px]">
                  {matchResult.matched && matchResult.score >= 55 ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center max-w-md"
                    >
                      <div className="mb-6">
                        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-500/20 border-2 border-green-500/50 mb-6">
                          <CheckCircle2 className="w-12 h-12 text-green-400" />
                        </div>
                        <h3 className="text-3xl font-bold text-green-400 mb-3">
                          Face Match Verified!
                        </h3>
                        <p className="text-white/60 text-lg mb-8">
                          Your face matches your ID document. Your KYC is being automatically verified.
                        </p>
                        {submitting && (
                          <div className="text-white/60">Submitting your KYC...</div>
                        )}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center max-w-md w-full space-y-8"
                    >
                      <div>
                        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-500/20 border-2 border-red-500/50 mb-6">
                          <XCircle className="w-12 h-12 text-red-400" />
                        </div>
                        <h3 className="text-3xl font-bold text-red-400 mb-3">
                          Face Match Rejected
                        </h3>
                        <p className="text-white/60 text-lg mb-8">
                          Your face doesn't match your ID document. Please try again or submit for manual review.
                        </p>
                      </div>
                      <div className="flex gap-4">
                        <Button
                          onClick={handleRetryFaceCapture}
                          variant="outline"
                          size="lg"
                          className="flex-1"
                        >
                          <ArrowLeft className="w-4 h-4 mr-2" />
                          Retry
                        </Button>
                        <Button
                          onClick={handleSendForReview}
                          size="lg"
                          className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 border-0 shadow-lg shadow-blue-500/30 hover:shadow-blue-600/40 transition-all duration-300 font-semibold"
                          disabled={submitting}
                        >
                          {submitting ? "Submitting..." : "Submit for Review"}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Step 4: Complete */}
          {currentStep === "complete" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass rounded-2xl p-8 text-center"
            >
              <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-4">KYC Submitted Successfully!</h2>
              <p className="text-white/60 mb-6">
                Your KYC submission is now pending review. You'll be notified once it's approved.
              </p>
              <p className="text-white/40 text-sm">Redirecting to dashboard...</p>
            </motion.div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
