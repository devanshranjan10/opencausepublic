"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { motion } from "framer-motion";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  getAllKYCRecords,
  getKYCRecord,
  updateKYCStatus,
  getDocumentUrl,
  getFaceImageUrl,
  getLivenessImageUrl,
  getKYCStats,
  deleteKYCRecord,
  type KYCRecord,
} from "@/lib/kyc/api";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Download,
  AlertCircle,
  Search,
  Filter,
  Image as ImageIcon,
  FileText,
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  Trash2,
} from "lucide-react";
import Link from "next/link";

export default function KYCAdminPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Get current user and check admin role
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return null;
        return await apiRequest<any>("/users/me");
      } catch (error) {
        return null;
      }
    },
    retry: 1,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Redirect non-admin users
  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      router.push("/dashboard");
    }
  }, [user, router]);

  const [records, setRecords] = useState<KYCRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<KYCRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<KYCRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    underReview: 0,
  });
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [faceImageUrl, setFaceImageUrl] = useState<string | null>(null);
  const [livenessImageUrls, setLivenessImageUrls] = useState<Record<string, string[][]>>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // Only load data if user is admin
    if (user && user.role === "ADMIN") {
      loadRecords();
      loadStats();
    }
  }, [user]);

  useEffect(() => {
    filterRecords();
  }, [records, filterStatus, searchQuery]);

  useEffect(() => {
    if (selectedRecord) {
      loadRecordUrls(selectedRecord);
    }
  }, [selectedRecord]);

  // Debug: Log when livenessImageUrls changes
  useEffect(() => {
    if (selectedRecord) {
      const recordId = String(selectedRecord.id);
      const stateObj: Record<string, string[][]> = Array.isArray(livenessImageUrls) ? {} : (livenessImageUrls || {});
      console.log(`[KYC Admin] livenessImageUrls changed for record "${recordId}":`, stateObj[recordId]);
      console.log(`[KYC Admin] Full state object:`, stateObj);
      console.log(`[KYC Admin] State keys:`, Object.keys(stateObj));
    }
  }, [livenessImageUrls, selectedRecord]);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const result = await getAllKYCRecords({ limit: 100 });
      setRecords(result.records);
    } catch (error) {
      console.error("Failed to load records:", error);
      toast({
        title: "Error",
        description: "Failed to load KYC records",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await getKYCStats();
      setStats(statsData);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const loadRecordUrls = async (record: KYCRecord) => {
    if (!record || !record.id) {
      console.warn("Invalid record provided to loadRecordUrls");
      return;
    }

    try {
      // Load document URLs
      const docUrls: Record<string, string> = {};
      if (record.documents?.idFront) {
        try {
          const result = await getDocumentUrl(record.id, "idFront");
          if (result?.url) {
            docUrls.idFront = result.url;
          }
        } catch (e) {
          console.error("Failed to load idFront:", e);
        }
      }
      if (record.documents?.idBack) {
        try {
          const result = await getDocumentUrl(record.id, "idBack");
          if (result?.url) {
            docUrls.idBack = result.url;
          }
        } catch (e) {
          console.error("Failed to load idBack:", e);
        }
      }
      if (record.documents?.proofOfAddress) {
        try {
          const result = await getDocumentUrl(record.id, "proofOfAddress");
          if (result?.url) {
            docUrls.proofOfAddress = result.url;
          }
        } catch (e) {
          console.error("Failed to load proofOfAddress:", e);
        }
      }
      setDocumentUrls(docUrls);

      // Load face image URL from R2 (stored as imageKey, not images array)
      if (record.faceData?.imageKey) {
        try {
          const result = await getFaceImageUrl(record.id, 0);
          if (result?.url) {
            setFaceImageUrl(result.url);
          } else {
            setFaceImageUrl(null);
          }
        } catch (e) {
          console.error("Failed to load face image:", e);
          setFaceImageUrl(null);
        }
      } else if (record.faceData?.images && record.faceData.images.length > 0) {
        // Fallback for old records that might still have base64 images
        try {
          const result = await getFaceImageUrl(record.id, 0);
          if (result?.url) {
            setFaceImageUrl(result.url);
          } else {
            setFaceImageUrl(null);
          }
        } catch (e) {
          console.error("Failed to load face image:", e);
          setFaceImageUrl(null);
        }
      } else {
        setFaceImageUrl(null);
      }

      // Load liveness image URLs from R2 (stored as imageKeys array, with metadata in results)
      let livenessChallenges: any[] = [];
      
      if (record.livenessData) {
        if (record.livenessData.results) {
          // Parse the results JSON which contains challenge metadata (with imageKeys per challenge)
          try {
            livenessChallenges = typeof record.livenessData.results === 'string' 
              ? JSON.parse(record.livenessData.results) 
              : record.livenessData.results;
            console.log("[KYC Admin] Parsed liveness challenges:", livenessChallenges);
          } catch (e) {
            console.error("Failed to parse liveness results:", e);
            livenessChallenges = [];
          }
        } else if (Array.isArray(record.livenessData)) {
          // Fallback for old format
          livenessChallenges = record.livenessData;
        }
      }
      
      if (livenessChallenges.length > 0) {
        const livenessUrlsByChallenge: string[][] = [];
        for (let challengeIdx = 0; challengeIdx < livenessChallenges.length; challengeIdx++) {
          // Add delay between challenges to avoid rate limiting
          if (challengeIdx > 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          
          const challenge = livenessChallenges[challengeIdx];
          if (!challenge) {
            livenessUrlsByChallenge.push([]);
            continue;
          }
          
          console.log(`[KYC Admin] Processing challenge ${challengeIdx}:`, challenge);
          const challengeUrls: string[] = [];
          
          // Check if challenge has imageKeys (new R2 format)
          if (challenge.imageKeys && Array.isArray(challenge.imageKeys) && challenge.imageKeys.length > 0) {
            // New format: challenge has imageKeys array, fetch each one via API with delay to avoid rate limiting
            console.log(`[KYC Admin] Challenge ${challengeIdx} has ${challenge.imageKeys.length} imageKeys`);
            for (let imgIdx = 0; imgIdx < challenge.imageKeys.length; imgIdx++) {
              try {
                // Add small delay between requests to avoid rate limiting (100ms between requests)
                if (imgIdx > 0) {
                  await new Promise(resolve => setTimeout(resolve, 100));
                }
                const result = await getLivenessImageUrl(record.id, challengeIdx, imgIdx);
                if (result?.url) {
                  challengeUrls.push(result.url);
                  console.log(`[KYC Admin] Loaded liveness image ${challengeIdx}/${imgIdx}`);
                }
              } catch (e: any) {
                // If rate limited, wait longer and retry once
                if (e?.message?.includes('429') || e?.message?.includes('Too Many Requests')) {
                  console.warn(`Rate limited, waiting 1 second before retry...`);
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  try {
                    const result = await getLivenessImageUrl(record.id, challengeIdx, imgIdx);
                    if (result?.url) {
                      challengeUrls.push(result.url);
                      console.log(`[KYC Admin] Loaded liveness image ${challengeIdx}/${imgIdx} after retry`);
                    }
                  } catch (retryError) {
                    console.error(`Failed to load liveness image ${challengeIdx}/${imgIdx} after retry:`, retryError);
                  }
                } else {
                  console.error(`Failed to load liveness image ${challengeIdx}/${imgIdx}:`, e);
                }
              }
            }
          } else if (challenge.images && Array.isArray(challenge.images) && challenge.images.length > 0) {
            // Old format: images are base64 or URLs, use directly
            if (typeof challenge.images[0] === 'string' && challenge.images[0].startsWith('data:')) {
              // Base64 images
              challengeUrls.push(...challenge.images);
            } else {
              // Try to fetch from API for each image with delay to avoid rate limiting
              for (let imgIdx = 0; imgIdx < challenge.images.length; imgIdx++) {
                try {
                  // Add delay between requests
                  if (imgIdx > 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                  }
                  const result = await getLivenessImageUrl(record.id, challengeIdx, imgIdx);
                  if (result?.url) {
                    challengeUrls.push(result.url);
                  }
                } catch (e: any) {
                  // If rate limited, wait and retry
                  if (e?.message?.includes('429') || e?.message?.includes('Too Many Requests')) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    try {
                      const result = await getLivenessImageUrl(record.id, challengeIdx, imgIdx);
                      if (result?.url) {
                        challengeUrls.push(result.url);
                      }
                    } catch (retryError) {
                      console.warn(`Failed to load liveness image ${challengeIdx}/${imgIdx} after retry:`, retryError);
                    }
                  } else {
                    console.warn(`Failed to load liveness image ${challengeIdx}/${imgIdx}:`, e);
                  }
                }
              }
            }
          } else {
            // Challenge metadata exists but no imageKeys/images - try to fetch from flat imageKeys array
            const flatImageKeys = record.livenessData?.imageKeys || [];
            if (flatImageKeys.length > 0) {
              // Calculate offset: sum of images in previous challenges
              let imageOffset = 0;
              for (let i = 0; i < challengeIdx; i++) {
                const prevChallenge = livenessChallenges[i];
                if (prevChallenge?.imageKeys) {
                  imageOffset += prevChallenge.imageKeys.length;
                } else if (prevChallenge?.images) {
                  imageOffset += prevChallenge.images.length;
                } else {
                  // Estimate 3 images per challenge if unknown
                  imageOffset += 3;
                }
              }
              
              // Try to fetch images for this challenge
              // Assume at least 1 image per challenge, try up to 5
              for (let imgIdx = 0; imgIdx < 5; imgIdx++) {
                try {
                  const result = await getLivenessImageUrl(record.id, challengeIdx, imgIdx);
                  if (result?.url) {
                    challengeUrls.push(result.url);
                  } else {
                    // No more images for this challenge
                    break;
                  }
                } catch (e) {
                  // Stop if we hit an error (likely no more images for this challenge)
                  break;
                }
              }
            }
          }
          
          console.log(`[KYC Admin] Challenge ${challengeIdx} loaded ${challengeUrls.length} images`);
          livenessUrlsByChallenge.push(challengeUrls);
        }
        const stateKey = String(record.id);
        console.log(`[KYC Admin] Setting liveness URLs in state with key: "${stateKey}"`, livenessUrlsByChallenge);
        console.log(`[KYC Admin] Current state before update:`, livenessImageUrls);
        console.log(`[KYC Admin] Type of current state:`, typeof livenessImageUrls, Array.isArray(livenessImageUrls));
        
        setLivenessImageUrls((prev) => {
          // Ensure prev is an object, not an array
          const prevObj = Array.isArray(prev) ? {} : (prev || {});
          const updated = { ...prevObj, [stateKey]: livenessUrlsByChallenge };
          console.log(`[KYC Admin] Updated livenessImageUrls state:`, updated);
          console.log(`[KYC Admin] Type of updated state:`, typeof updated, Array.isArray(updated));
          console.log(`[KYC Admin] Keys in updated state:`, Object.keys(updated));
          return updated;
        });
      } else {
        // No liveness data, set empty array
        console.log("[KYC Admin] No liveness challenges found");
        const stateKey = String(record.id);
        setLivenessImageUrls((prev) => {
          const prevObj = Array.isArray(prev) ? {} : (prev || {});
          return { ...prevObj, [stateKey]: [] };
        });
      }
    } catch (error) {
      console.error("Failed to load record URLs:", error);
      // Set defaults on error
      setDocumentUrls({});
      setFaceImageUrl(null);
      const stateKey = String(record.id);
      setLivenessImageUrls((prev) => {
        const prevObj = Array.isArray(prev) ? {} : (prev || {});
        return { ...prevObj, [stateKey]: [] };
      });
    }
  };

  const filterRecords = () => {
    let filtered = [...records];

    if (filterStatus !== "ALL") {
      filtered = filtered.filter((r) => r.status === filterStatus);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.personalInfo?.fullName?.toLowerCase().includes(query) ||
          r.personalInfo?.email?.toLowerCase().includes(query) ||
          r.id?.toLowerCase().includes(query) ||
          r.userId?.toLowerCase().includes(query)
      );
    }

    setFilteredRecords(filtered);
  };

  const handleViewRecord = async (id: string) => {
    try {
      const record = await getKYCRecord(id);
      setSelectedRecord(record);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load KYC record",
      });
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await updateKYCStatus(id, "approved");
      toast({
        title: "Success",
        description: "KYC record approved",
      });
      loadRecords();
      loadStats();
      setSelectedRecord(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve record",
      });
    }
  };

  const handleReject = async (id: string, comments?: string) => {
    try {
      await updateKYCStatus(id, "rejected", comments);
      toast({
        title: "Success",
        description: "KYC record rejected",
      });
      loadRecords();
      loadStats();
      setSelectedRecord(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject record",
      });
    }
  };

  const handleDeleteClick = (id: string) => {
    setRecordToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!recordToDelete) return;

    setIsDeleting(true);
    try {
      await deleteKYCRecord(recordToDelete);
      toast({
        title: "Success",
        description: "KYC record deleted successfully",
      });
      loadRecords();
      loadStats();
      setSelectedRecord(null);
      setDeleteConfirmOpen(false);
      setRecordToDelete(null);
    } catch (error: any) {
      console.error("Failed to delete KYC record:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete record. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/50">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "under_review":
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">
            <Clock className="w-3 h-3 mr-1" />
            Under Review
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">
            Unknown
          </Badge>
        );
    }
  };

  // Show loading while checking user
  if (userLoading) {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="pt-32 text-center">
          <p className="text-white/60">Loading...</p>
        </div>
        <Footer />
      </div>
    );
  }

  // Block non-admin users
  if (!user || user.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-black">
        <Header />
        <div className="pt-32 pb-20 px-6 lg:px-8">
          <div className="container mx-auto max-w-3xl text-center">
            <Alert className="border-red-500/50 bg-red-500/10">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-400">
                <strong>Access Denied:</strong> You do not have permission to access this page. Only administrators can view the KYC admin dashboard.
              </AlertDescription>
            </Alert>
            <div className="mt-6">
              <Link href="/dashboard">
                <Button>Go to Dashboard</Button>
              </Link>
            </div>
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
        <div className="container mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-4 mb-2">
              <Link href="/dashboard/admin">
                <Button variant="outline" className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Admin Dashboard
                </Button>
              </Link>
            </div>
            <h1 className="text-4xl font-bold mb-2">KYC Admin Dashboard</h1>
            <p className="text-white/60">Review and manage KYC submissions</p>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-xl p-6"
            >
              <div className="text-white/60 text-sm mb-2">Total</div>
              <div className="text-3xl font-bold">{stats.total}</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-xl p-6"
            >
              <div className="text-yellow-400 text-sm mb-2">Pending</div>
              <div className="text-3xl font-bold">{stats.pending}</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-xl p-6"
            >
              <div className="text-green-400 text-sm mb-2">Approved</div>
              <div className="text-3xl font-bold">{stats.approved}</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass rounded-xl p-6"
            >
              <div className="text-red-400 text-sm mb-2">Rejected</div>
              <div className="text-3xl font-bold">{stats.rejected}</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="glass rounded-xl p-6"
            >
              <div className="text-blue-400 text-sm mb-2">Under Review</div>
              <div className="text-3xl font-bold">{stats.underReview}</div>
            </motion.div>
          </div>

          {/* Filters */}
          <div className="glass rounded-xl p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  placeholder="Search by name, email, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filterStatus === "ALL" ? "default" : "outline"}
                  onClick={() => setFilterStatus("ALL")}
                  size="sm"
                >
                  All
                </Button>
                <Button
                  variant={filterStatus === "pending" ? "default" : "outline"}
                  onClick={() => setFilterStatus("pending")}
                  size="sm"
                >
                  Pending
                </Button>
                <Button
                  variant={filterStatus === "approved" ? "default" : "outline"}
                  onClick={() => setFilterStatus("approved")}
                  size="sm"
                >
                  Approved
                </Button>
                <Button
                  variant={filterStatus === "rejected" ? "default" : "outline"}
                  onClick={() => setFilterStatus("rejected")}
                  size="sm"
                >
                  Rejected
                </Button>
                <Button
                  variant={filterStatus === "under_review" ? "default" : "outline"}
                  onClick={() => setFilterStatus("under_review")}
                  size="sm"
                >
                  Under Review
                </Button>
              </div>
            </div>
          </div>

          {/* Records List */}
          {loading ? (
            <div className="text-center py-20">
              <p className="text-white/60">Loading records...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-20 glass rounded-xl">
              <p className="text-white/60">No records found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRecords.map((record, index) => (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="glass rounded-xl p-6 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <h3 className="text-lg font-semibold">
                          {record.personalInfo?.fullName || "Unknown"}
                        </h3>
                        {getStatusBadge(record.status)}
                      </div>
                      <div className="text-sm text-white/60 space-y-1">
                        <p>Email: {record.personalInfo?.email}</p>
                        <p>
                          Submitted:{" "}
                          {record.timestamps?.submittedAt
                            ? new Date(
                                record.timestamps.submittedAt.toDate?.() ||
                                  record.timestamps.submittedAt
                              ).toLocaleString()
                            : "N/A"}
                        </p>
                        {record.verification?.overallScore && (
                          <p>
                            Score: {Math.round(record.verification.overallScore * 100)}%
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewRecord(record.id)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Detailed Record Modal */}
          {selectedRecord && (
            <RecordDetailModal
              record={selectedRecord}
              documentUrls={documentUrls}
              faceImageUrl={faceImageUrl}
              livenessImageUrls={livenessImageUrls[selectedRecord.id] || []}
              onClose={() => {
                setSelectedRecord(null);
                setFaceImageUrl(null);
                setLivenessImageUrls({});
              }}
              onApprove={handleApprove}
              onReject={handleReject}
              onDelete={handleDeleteClick}
            />
          )}
        </div>
      </div>
      <Footer />

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="glass border-red-500/50 bg-black/95">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/50">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <DialogTitle className="text-2xl font-bold text-white">
                Delete KYC Record
              </DialogTitle>
            </div>
            <DialogDescription className="text-white/80 text-base leading-relaxed">
              Are you sure you want to delete this KYC record? This action will permanently delete:
              <ul className="list-disc list-inside mt-3 space-y-2 text-white/70">
                <li>All personal information and documents</li>
                <li>Face verification images</li>
                <li>Liveness detection images</li>
                <li>All associated data from Firebase and R2 storage</li>
              </ul>
              <p className="mt-4 text-red-400 font-semibold">
                This action cannot be undone.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setRecordToDelete(null);
              }}
              disabled={isDeleting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="flex-1 bg-red-600 hover:bg-red-700 border-red-600"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Permanently
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecordDetailModal({
  record,
  documentUrls,
  faceImageUrl,
  livenessImageUrls,
  onClose,
  onApprove,
  onReject,
  onDelete,
}: {
  record: KYCRecord;
  documentUrls: Record<string, string>;
  faceImageUrl: string | null;
  livenessImageUrls: string[][];
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string, comments?: string) => void;
  onDelete: (id: string) => void;
}) {
  const [rejectComments, setRejectComments] = useState("");
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass rounded-2xl p-8 max-w-6xl w-full max-h-[95vh] overflow-y-auto my-8"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold">KYC Record - Complete Details</h2>
          <Button variant="ghost" onClick={onClose} size="sm">
            ×
          </Button>
        </div>

        <div className="space-y-8">
          {/* Personal Information */}
          <section>
            <h3 className="text-2xl font-semibold mb-4">Personal Information</h3>
            <div className="glass rounded-lg p-6 grid grid-cols-2 gap-4">
              <div>
                <p className="text-white/60 text-sm mb-1">Full Name</p>
                <p className="font-semibold text-lg">{record.personalInfo?.fullName}</p>
              </div>
              <div>
                <p className="text-white/60 text-sm mb-1">Date of Birth</p>
                <p className="font-semibold">
                  {record.personalInfo?.dateOfBirth
                    ? new Date(record.personalInfo.dateOfBirth).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-white/60 text-sm mb-1">Nationality</p>
                <p className="font-semibold">{record.personalInfo?.nationality}</p>
              </div>
              <div>
                <p className="text-white/60 text-sm mb-1">Email</p>
                <p className="font-semibold">{record.personalInfo?.email}</p>
              </div>
              <div>
                <p className="text-white/60 text-sm mb-1">Phone</p>
                <p className="font-semibold">
                  {record.personalInfo?.phoneCountryCode} {record.personalInfo?.phoneNumber}
                </p>
              </div>
              <div>
                <p className="text-white/60 text-sm mb-1">Document Type</p>
                <p className="font-semibold">{record.personalInfo?.documentType}</p>
              </div>
              <div className="col-span-2">
                <p className="text-white/60 text-sm mb-1">Address</p>
                <p className="font-semibold">
                  {record.personalInfo?.street}, {record.personalInfo?.city},{" "}
                  {record.personalInfo?.state} {record.personalInfo?.zipCode},{" "}
                  {record.personalInfo?.country}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-white/60 text-sm mb-1">Government ID Number</p>
                <p className="font-semibold font-mono">
                  {record.personalInfo?.governmentIdNumber}
                </p>
              </div>
              {record.personalInfo?.additionalNotes && (
                <div className="col-span-2">
                  <p className="text-white/60 text-sm mb-1">Additional Notes</p>
                  <p className="font-semibold">{record.personalInfo.additionalNotes}</p>
                </div>
              )}
            </div>
          </section>

          {/* Documents Section */}
          <section>
            <h3 className="text-2xl font-semibold mb-4">Documents</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {documentUrls.idFront && (
                <DocumentViewer
                  title="ID Document Front"
                  url={documentUrls.idFront}
                  onZoom={(url) => setZoomedImage(url)}
                />
              )}
              {documentUrls.idBack && (
                <DocumentViewer
                  title="ID Document Back"
                  url={documentUrls.idBack}
                  onZoom={(url) => setZoomedImage(url)}
                />
              )}
              {documentUrls.proofOfAddress && (
                <DocumentViewer
                  title="Proof of Address"
                  url={documentUrls.proofOfAddress}
                  onZoom={(url) => setZoomedImage(url)}
                />
              )}
            </div>
          </section>

          {/* Face Images */}
          <section>
            <h3 className="text-2xl font-semibold mb-4">Face Verification Images</h3>
            {faceImageUrl ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass rounded-lg p-4">
                  <p className="text-sm text-white/60 mb-2">Face Capture</p>
                  <img
                    src={faceImageUrl}
                    alt="Face Capture"
                    className="w-full rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setZoomedImage(faceImageUrl)}
                  />
                  {record.faceData?.qualityScore && (
                    <p className="text-xs text-white/40 mt-2">
                      Quality: {Math.round(record.faceData.qualityScore * 100)}%
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="glass rounded-lg p-8 text-center">
                <p className="text-white/60">No face image available</p>
              </div>
            )}
            {record.verification?.faceMatchScore !== undefined && record.verification.faceMatchScore !== null && (
              <div className="mt-4 glass rounded-lg p-4">
                <p className="text-sm text-white/60 mb-1">Face Match Score</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-white/10 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all"
                      style={{
                        width: `${record.verification.faceMatchScore * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-lg font-bold">
                    {Math.round(record.verification.faceMatchScore * 100)}%
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* Liveness Images */}
          <section>
            <h3 className="text-2xl font-semibold mb-4">Liveness Detection Images</h3>
            {(() => {
              // Parse liveness data structure
              let livenessChallenges: any[] = [];
              if (record.livenessData) {
                if (Array.isArray(record.livenessData)) {
                  livenessChallenges = record.livenessData;
                } else if (record.livenessData.results) {
                  try {
                    livenessChallenges = typeof record.livenessData.results === 'string' 
                      ? JSON.parse(record.livenessData.results) 
                      : record.livenessData.results;
                  } catch (e) {
                    livenessChallenges = [];
                  }
                }
              }
              
              const recordId: string = typeof record.id === 'string' ? record.id : String(record.id || '');
              const getLivenessUrls = (id: string): string[][] => {
                // Ensure livenessImageUrls is an object, not an array
                const stateObj: Record<string, string[][]> = Array.isArray(livenessImageUrls) ? {} : (livenessImageUrls || {});
                
                if (id && typeof id === 'string') {
                  // Try exact match first
                  if (id in stateObj) {
                    const urls = stateObj[id];
                    return Array.isArray(urls) && urls.every(arr => Array.isArray(arr)) ? urls as string[][] : [];
                  }
                  // Try converting to string and matching
                  const stringId = String(id);
                  if (stringId in stateObj) {
                    const urls = stateObj[stringId];
                    return Array.isArray(urls) && urls.every(arr => Array.isArray(arr)) ? urls as string[][] : [];
                  }
                }
                return [];
              };
              const recordLivenessUrls: string[][] = getLivenessUrls(recordId);
              console.log(`[KYC Admin] Rendering - recordId: "${recordId}", recordLivenessUrls:`, recordLivenessUrls);
              console.log(`[KYC Admin] Rendering - livenessChallenges.length:`, livenessChallenges.length);
              
              if (livenessChallenges.length > 0 || recordLivenessUrls.length > 0) {
                return (
                  <div className="space-y-6">
                    {(livenessChallenges.length > 0 ? livenessChallenges : recordLivenessUrls.map((_: string[], i: number) => ({ action: `Challenge ${i + 1}` }))).map((challenge: any, challengeIdx: number) => {
                      const challengeUrls: string[] = recordLivenessUrls[challengeIdx] || [];
                      console.log(`[KYC Admin] Rendering challenge ${challengeIdx}, challengeUrls:`, challengeUrls);
                      return (
                        <div key={challengeIdx} className="glass rounded-lg p-4">
                          <p className="text-sm text-white/80 font-semibold mb-3">
                            Challenge {challengeIdx + 1}: {challenge.action || "Unknown"}
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {challengeUrls.length > 0 ? (
                              challengeUrls.map((url: string, imgIdx: number) => (
                                <div key={imgIdx} className="glass rounded-lg p-2">
                                  <p className="text-xs text-white/60 mb-2">Image {imgIdx + 1}</p>
                                  <img
                                    src={url}
                                    alt={`Liveness ${challengeIdx + 1} - ${imgIdx + 1}`}
                                    className="w-full rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => setZoomedImage(url)}
                                    onError={(e) => {
                                      console.error(`Failed to load liveness image ${challengeIdx}/${imgIdx}`);
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                </div>
                              ))
                            ) : (
                              <p className="text-white/60 text-sm col-span-full">Loading images...</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              } else {
                return (
                  <div className="glass rounded-lg p-8 text-center">
                    <p className="text-white/60">No liveness detection images available</p>
                  </div>
                );
              }
            })()}
          </section>

          {/* Verification Summary */}
          <section>
            <h3 className="text-2xl font-semibold mb-4">Verification Summary</h3>
            <div className="glass rounded-lg p-6 space-y-3">
              <div className="flex justify-between">
                <span className="text-white/60">Face Match Score:</span>
                <span className="font-semibold">
                  {record.verification?.faceMatchScore
                    ? Math.round(record.verification.faceMatchScore * 100) + "%"
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Liveness Passed:</span>
                <span className="font-semibold">
                  {record.verification?.livenessPassed ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Overall Score:</span>
                <span className="font-semibold text-lg">
                  {record.verification?.overallScore
                    ? Math.round(record.verification.overallScore * 100) + "%"
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Status:</span>
                <Badge
                  className={
                    record.status === "approved"
                      ? "bg-green-500/20 text-green-400"
                      : record.status === "rejected"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-yellow-500/20 text-yellow-400"
                  }
                >
                  {record.status}
                </Badge>
              </div>
            </div>
          </section>

          {/* Review Actions */}
          <section className="border-t border-white/10 pt-6">
            <h3 className="text-xl font-semibold mb-4">Review Actions</h3>
            <div className="flex gap-4">
              <Button
                onClick={() => onApprove(record.id)}
                className="flex-1 bg-green-500 hover:bg-green-600"
                disabled={record.status === "approved"}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Approve
              </Button>
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Rejection reason (optional)"
                  value={rejectComments}
                  onChange={(e) => setRejectComments(e.target.value)}
                  className="w-full mb-2 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
                <Button
                  onClick={() => onReject(record.id, rejectComments)}
                  variant="destructive"
                  className="w-full"
                  disabled={record.status === "rejected"}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10">
              <Button
                onClick={() => onDelete(record.id)}
                variant="destructive"
                className="w-full bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete KYC Record
              </Button>
              <p className="text-xs text-white/40 mt-2 text-center">
                This will permanently delete all data including images from Firebase and R2 storage
              </p>
            </div>
          </section>
        </div>
      </motion.div>

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
          onClick={() => setZoomedImage(null)}
        >
          <img
            src={zoomedImage}
            alt="Zoomed"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function DocumentViewer({
  title,
  url,
  onZoom,
}: {
  title: string;
  url: string;
  onZoom: (url: string) => void;
}) {
  return (
    <div className="glass rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold">{title}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onZoom(url)}
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
      </div>
      {url.endsWith(".pdf") ? (
        <div className="aspect-video bg-white/10 rounded flex items-center justify-center">
          <FileText className="w-12 h-12 text-white/40" />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 text-sm text-blue-400 hover:underline"
          >
            View PDF
          </a>
        </div>
      ) : (
        <img
          src={url}
          alt={title}
          className="w-full rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => onZoom(url)}
        />
      )}
    </div>
  );
}
