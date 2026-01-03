import { IsString, IsEmail, IsOptional, IsArray, IsObject, ValidateNested, IsEnum, IsNumber, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export enum DocumentType {
  PASSPORT = "PASSPORT",
  DRIVER_LICENSE = "DRIVER_LICENSE",
  NATIONAL_ID = "NATIONAL_ID",
}

export enum KYCStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  UNDER_REVIEW = "under_review",
}

export class PersonalInfoDto {
  @IsString()
  fullName!: string;
  
  @IsString()
  dateOfBirth!: string;
  
  @IsString()
  nationality!: string;
  
  @IsEmail()
  email!: string;
  
  @IsString()
  phoneNumber!: string;
  
  @IsString()
  phoneCountryCode!: string;
  
  @IsString()
  street!: string;
  
  @IsString()
  city!: string;
  
  @IsString()
  state!: string;
  
  @IsString()
  zipCode!: string;
  
  @IsString()
  country!: string;
  
  @IsEnum(DocumentType)
  documentType!: DocumentType;
  
  @IsString()
  governmentIdNumber!: string;
  
  @IsOptional()
  @IsString()
  additionalNotes?: string;
}

export class FaceImageDto {
  @IsString()
  image!: string; // base64
  
  @IsNumber()
  @Min(0)
  @Max(1)
  quality!: number;
  
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  embedding?: number[];
  
  @IsOptional()
  @IsObject()
  landmarks?: {
    leftEye: { x: number; y: number };
    rightEye: { x: number; y: number };
    nose: { x: number; y: number };
    mouth: { x: number; y: number };
  };
}

export class LivenessActionDto {
  @IsString()
  action!: string;
  
  @IsArray()
  @IsString({ each: true })
  images!: string[]; // base64 array
  
  @IsNumber()
  timestamp!: number;
}

export class KYCSubmitDto {
  @ValidateNested()
  @Type(() => PersonalInfoDto)
  personalInfo!: PersonalInfoDto;
  
  @IsOptional()
  @IsString()
  documentFront?: string; // base64
  
  @IsOptional()
  @IsString()
  documentBack?: string; // base64
  
  @IsOptional()
  @IsString()
  proofOfAddress?: string; // base64
  
  @IsOptional()
  @IsObject()
  documentFrontOcr?: {
    extractedText: string;
    matchedKeywords: string[];
  };
  
  @IsOptional()
  @IsObject()
  documentBackOcr?: {
    extractedText: string;
    matchedKeywords: string[];
  };
  
  @IsOptional()
  @IsObject()
  proofOfAddressOcr?: {
    extractedText: string;
    matchedKeywords: string[];
  };
  
  @ValidateNested()
  @Type(() => FaceImageDto)
  faceData!: FaceImageDto;
  
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LivenessActionDto)
  livenessData!: LivenessActionDto[];
  
  @IsOptional()
  @IsNumber()
  faceMatchScore?: number;
  
  @IsOptional()
  @IsNumber()
  overallScore?: number;
}

