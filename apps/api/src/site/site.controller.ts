import { Controller, Get, Inject } from "@nestjs/common";
import { SiteService } from "./site.service.js";

/** Unguarded, like the catalog and leaderboard listings — the landing page shows these to everyone. */
@Controller("stats")
export class SiteController {
  constructor(@Inject(SiteService) private readonly site: SiteService) {}

  @Get()
  stats() {
    return this.site.getStats();
  }
}
