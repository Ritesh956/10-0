import { Controller, Get, Inject } from "@nestjs/common";
import { EventsService } from "./events.service.js";

/** Public and unguarded — the Events page is browsable before signing in; joining goes through the
    normal (authenticated) league invite flow. */
@Controller("events")
export class EventsController {
  constructor(@Inject(EventsService) private readonly events: EventsService) {}

  @Get("current")
  current() {
    return this.events.current();
  }
}
