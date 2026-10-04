/** "3d 4h left", "5h 12m left", "9m left" — what remains until a weekly event closes. */
export function timeLeft(endsAtIso: string, nowMs: number): string {
  const ms = new Date(endsAtIso).getTime() - nowMs;
  if (!Number.isFinite(ms) || ms <= 0) return "Ended";
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes % 60}m left`;
  return `${Math.max(1, minutes)}m left`;
}
