import { Controller, Get, Query } from "@nestjs/common";
import { CatalogService } from "./catalog.service.js";
import { clubSeasonFilterSchema, playerSeasonFilterSchema } from "./catalog.schemas.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";

@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("eras")
  listEras() {
    return this.catalog.listEras();
  }

  @Get("leagues")
  listLeagues(@Query("eraId") eraId?: string) {
    return this.catalog.listLeagues(eraId);
  }

  @Get("club-seasons")
  listClubSeasons(@Query(new ZodValidationPipe(clubSeasonFilterSchema)) filter: ReturnType<typeof clubSeasonFilterSchema.parse>) {
    return this.catalog.listClubSeasons(filter);
  }

  @Get("player-seasons")
  listPlayerSeasons(
    @Query(new ZodValidationPipe(playerSeasonFilterSchema)) filter: ReturnType<typeof playerSeasonFilterSchema.parse>,
  ) {
    return this.catalog.listPlayerSeasons(filter);
  }

  @Get("roll")
  rollClubSeason(@Query(new ZodValidationPipe(clubSeasonFilterSchema)) filter: ReturnType<typeof clubSeasonFilterSchema.parse>) {
    return this.catalog.rollClubSeason(filter);
  }

  @Get("managers")
  listManagers() {
    return this.catalog.listManagers();
  }

  @Get("roll-manager")
  rollManager() {
    return this.catalog.rollManager();
  }
}
