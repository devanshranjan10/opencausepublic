import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get()
  root() {
    return { ok: true, service: "opencause-api", version: "1.0.0" };
  }
}




