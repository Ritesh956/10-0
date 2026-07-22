import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { CatalogService } from "./catalog.service.js";
import {
  clubPositionCoverageQuerySchema,
  clubSeasonFilterSchema,
  playerSeasonFilterSchema,
  type ClubPositionCoverageQueryDto,
} from "./catalog.schemas.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";

@Controller("catalog")
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get("eras")
  listEras() {
    return this.catalog.listEras();
  }

  // Registered before "club-seasons"/"roll" etc. only matters for literal-vs-param collisions —
  // "clubs" and "clubs/:clubId/positions" don't collide with any existing static segment, so
  // ordering relative to the rest of this controller is unconstrained.
  @Get("clubs")
  listClubs() {
    return this.catalog.listClubs();
  }

  // Nations Trophy (Phase 10) directory analogue of "clubs" — registered alongside it for the
  // same reason ("nations" doesn't collide with any param segment, so ordering is unconstrained).
  @Get("nations")
  listNations() {
    return this.catalog.listNations();
  }

  @Get("clubs/:clubId/positions")
  getClubPositionCoverage(
    @Param("clubId") clubId: string,
    @Query(new ZodValidationPipe(clubPositionCoverageQuerySchema)) query: ClubPositionCoverageQueryDto,
  ) {
    return this.catalog.getClubPositionCoverage(clubId, query.eraId);
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
