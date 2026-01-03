import { Controller, Get } from "@nestjs/common";
import { StatsService } from "./stats.service";

@Controller("stats")
export class StatsController {
  constructor(private statsService: StatsService) {}

  @Get()
  async getStats() {
    return this.statsService.getPlatformStats();
  }
}

