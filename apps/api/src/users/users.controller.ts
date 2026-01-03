import { Controller, Get, UseGuards, Put, Body, Request } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get("me")
  async getMe(@Request() req) {
    return this.usersService.findById(req.user.id);
  }

  @Put("me/wallet")
  async updateWallet(@Request() req, @Body() body: { walletAddress: string }) {
    return this.usersService.updateWalletAddress(req.user.id, body.walletAddress);
  }
}


