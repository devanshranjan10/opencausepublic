import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { FirebaseService } from "../../firebase/firebase.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private firebase: FirebaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || "opencause-secret-key-change-in-production",
    });
  }

  async validate(payload: any) {
    const user = await this.firebase.getUserById(payload.sub) as any;

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      did: user.did,
      kycStatus: user.kycStatus,
      walletAddress: user.walletAddress,
    };
  }
}

