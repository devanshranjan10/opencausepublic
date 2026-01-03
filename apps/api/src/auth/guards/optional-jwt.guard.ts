import { Injectable, ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  // Override handleRequest to not throw error if no token
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Return user if authenticated, or null if not (don't throw error)
    return user || null;
  }
}

