import { Injectable } from "@nestjs/common";
import { FirebaseService } from "../firebase/firebase.service";

@Injectable()
export class UsersService {
  constructor(private firebase: FirebaseService) {}

  async findById(id: string) {
    const user = await this.firebase.getUserById(id) as any;
    if (!user) return null;
    
    // Return only selected fields
    const { password, ...result } = user;
    return {
      id: result.id,
      email: result.email,
      name: result.name,
      role: result.role,
      did: result.did,
      kycStatus: result.kycStatus,
      walletAddress: result.walletAddress,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  async findByEmail(email: string) {
    return this.firebase.getUserByEmail(email);
  }

  async updateWalletAddress(userId: string, walletAddress: string) {
    return this.firebase.updateUser(userId, { walletAddress });
  }

  async updateProfile(userId: string, data: any) {
    const { password, ...updateData } = data;
    return this.firebase.updateUser(userId, updateData);
  }
}


