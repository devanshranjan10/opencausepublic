import { Injectable, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { FirebaseService } from "../firebase/firebase.service";
import { SignupDto, LoginDto } from "@opencause/types";
import { UsersService } from "../users/users.service";
import { DIDService } from "../did/did.service";

@Injectable()
export class AuthService {
  constructor(
    private firebase: FirebaseService,
    private jwtService: JwtService,
    private usersService: UsersService,
    private didService: DIDService
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.firebase.getUserByEmail(dto.email);

    if (existing) {
      throw new BadRequestException("User already exists");
    }

    // Generate DID
    const did = await this.didService.generateDID();

    // Hash password if provided
    const hashedPassword = (dto as any).password ? await bcrypt.hash((dto as any).password, 10) : null;

    const user = await this.firebase.createUser({
      email: dto.email,
      name: dto.name,
      role: dto.role,
      password: hashedPassword,
      did,
      kycStatus: "PENDING",
    }) as any;

    const token = this.jwtService.sign({ sub: user.id, email: user.email, role: user.role });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        did: user.did,
        kycStatus: user.kycStatus || "PENDING",
      },
      token,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.firebase.getUserByEmail(dto.email) as any;

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // For MVP: if password provided, check it; otherwise assume OTP verified
    if (dto.password) {
      if (user.password) {
        const valid = await bcrypt.compare(dto.password, user.password);
        if (!valid) {
          throw new UnauthorizedException("Invalid credentials");
        }
      }
    }

    const token = this.jwtService.sign({ sub: user.id, email: user.email, role: user.role });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        did: user.did,
        kycStatus: user.kycStatus || "PENDING",
      },
      token,
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.firebase.getUserByEmail(email) as any;

    if (user && user.password && (await bcrypt.compare(password, user.password))) {
      const { password: _, ...result } = user;
      return result;
    }

    return null;
  }
}


