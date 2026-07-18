import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthTokenPayload } from "./auth.service.js";

interface RequestWithUser {
  user: AuthTokenPayload;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthTokenPayload => {
  const request = ctx.switchToHttp().getRequest<RequestWithUser>();
  return request.user;
});
