import { FirebaseService } from "../firebase/firebase.service";
import * as bcrypt from "bcrypt";
import * as admin from "firebase-admin";

// Note: This needs to be run after Firebase is initialized
// You can call this manually or create a script

export async function seedDatabase(firebase: FirebaseService) {
  const hashedPassword = await bcrypt.hash("admin123", 10);

  // Check if users already exist
  const existingAdmin = await firebase.getUserByEmail("admin@opencause.in");
  const existingReviewer = await firebase.getUserByEmail("reviewer@opencause.in");
  const existingOrganizer = await firebase.getUserByEmail("organizer@opencause.in");
  const existingDonor = await firebase.getUserByEmail("donor@opencause.in");
  const existingNGO = await firebase.getUserByEmail("ngo@opencause.in");
  const existingVendor = await firebase.getUserByEmail("vendor@opencause.in");
  const existingCSR = await firebase.getUserByEmail("csr@opencause.in");

  // Create or update admin user
  let admin;
  if (existingAdmin) {
    admin = await firebase.updateUser(existingAdmin.id, {
      password: hashedPassword,
      kycStatus: "VERIFIED",
    });
    console.log("✅ Updated admin user");
  } else {
    admin = await firebase.createUser({
      email: "admin@opencause.in",
      name: "Admin User",
      role: "ADMIN",
      password: hashedPassword,
      kycStatus: "VERIFIED",
      did: "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
    });
    console.log("✅ Created admin user");
  }

  // Create or update reviewer
  let reviewer;
  if (existingReviewer) {
    reviewer = await firebase.updateUser(existingReviewer.id, {
      password: hashedPassword,
      kycStatus: "VERIFIED",
    });
    console.log("✅ Updated reviewer user");
  } else {
    reviewer = await firebase.createUser({
      email: "reviewer@opencause.in",
      name: "Reviewer User",
      role: "REVIEWER",
      password: hashedPassword,
      kycStatus: "VERIFIED",
      did: "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doL",
    });
    console.log("✅ Created reviewer user");
  }

  // Create or update organizer
  let organizer;
  if (existingOrganizer) {
    organizer = await firebase.updateUser(existingOrganizer.id, {
      password: hashedPassword,
      kycStatus: "VERIFIED",
    });
    console.log("✅ Updated organizer user");
  } else {
    organizer = await firebase.createUser({
      email: "organizer@opencause.in",
      name: "Organizer User",
      role: "INDIVIDUAL_ORGANIZER",
      password: hashedPassword,
      kycStatus: "VERIFIED",
      did: "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doM",
      walletAddress: "0x1234567890123456789012345678901234567890",
    });
    console.log("✅ Created organizer user");
  }
  
  // Create KYC profile for organizer (required for campaign creation check)
  const organizerKycRef = firebase.firestore.collection("kyc_profiles").doc(organizer.id);
  await organizerKycRef.set({
    uid: organizer.id,
    status: "VERIFIED",
    type: "INDIVIDUAL",
    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log("✅ Created/updated KYC profile for organizer");

  // Create or update donor
  let donor;
  if (existingDonor) {
    donor = await firebase.updateUser(existingDonor.id, {
      password: hashedPassword,
      kycStatus: "VERIFIED",
    });
    console.log("✅ Updated donor user");
  } else {
    donor = await firebase.createUser({
      email: "donor@opencause.in",
      name: "Donor User",
      role: "DONOR",
      password: hashedPassword,
      kycStatus: "VERIFIED",
      did: "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doN",
    });
    console.log("✅ Created donor user");
  }

  // Create or update NGO organizer
  let ngoOrganizer;
  if (existingNGO) {
    ngoOrganizer = await firebase.updateUser(existingNGO.id, {
      password: hashedPassword,
      kycStatus: "VERIFIED",
    });
    console.log("✅ Updated NGO organizer user");
  } else {
    ngoOrganizer = await firebase.createUser({
      email: "ngo@opencause.in",
      name: "NGO Organizer User",
      role: "NGO_ORGANIZER",
      password: hashedPassword,
      kycStatus: "VERIFIED",
      did: "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doO",
      walletAddress: "0x2345678901234567890123456789012345678901",
    });
    console.log("✅ Created NGO organizer user");
  }

  // Create or update vendor
  let vendor;
  if (existingVendor) {
    vendor = await firebase.updateUser(existingVendor.id, {
      password: hashedPassword,
      kycStatus: "VERIFIED",
    });
    console.log("✅ Updated vendor user");
  } else {
    vendor = await firebase.createUser({
      email: "vendor@opencause.in",
      name: "Vendor User",
      role: "VENDOR",
      password: hashedPassword,
      kycStatus: "VERIFIED",
      did: "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doP",
    });
    console.log("✅ Created vendor user");
  }

  // Create or update CSR team
  let csrTeam;
  if (existingCSR) {
    csrTeam = await firebase.updateUser(existingCSR.id, {
      password: hashedPassword,
      kycStatus: "VERIFIED",
    });
    console.log("✅ Updated CSR team user");
  } else {
    csrTeam = await firebase.createUser({
      email: "csr@opencause.in",
      name: "CSR Team User",
      role: "CSR_TEAM",
      password: hashedPassword,
      kycStatus: "VERIFIED",
      did: "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doQ",
    });
    console.log("✅ Created CSR team user");
  }

  console.log("✅ Seeded users:", { admin, reviewer, organizer, donor, ngoOrganizer, vendor, csrTeam });
  return { admin, reviewer, organizer, donor, ngoOrganizer, vendor, csrTeam };
}

