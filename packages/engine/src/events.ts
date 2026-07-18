import type { MatchEvent } from "@futbol/domain";

/** Omit that distributes over a union so each discriminated member keeps its own shape. */
export type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

export type EmitFn = (event: DistributiveOmit<MatchEvent, "seq">) => void;

export function createEmitter(events: MatchEvent[]): EmitFn {
  let seq = 0;
  return (event) => {
    events.push({ ...event, seq: seq++ } as MatchEvent);
  };
}
