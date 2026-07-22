import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { PlayerSeasonDto } from "../api/types";
import type { Formation } from "../lib/formations";

export type Difficulty = "easy" | "normal" | "hard";
export type DraftMode = "squad-first" | "position-first";
export type PlayerRatingsMode = "season" | "prime";

export interface DraftConfig {
  eraId: string;
  leagueIds: string[];
  formation: Formation;
  difficulty: Difficulty;
  showRatings: boolean;
  draftMode: DraftMode;
  playerRatings: PlayerRatingsMode;
  // "| undefined" (not just "?:") on these four — exactOptionalPropertyTypes rejects explicitly
  // assigning `undefined` through setConfig's Partial<DraftConfig> patch otherwise, and both
  // ClubsDirectoryPage (clearing the era-year narrowing) and SetupPage's "draft a full league
  // instead" escape hatch (clearing the club lock) need to do exactly that.
  eraYearMin?: number | undefined;
  eraYearMax?: number | undefined;
  managers: boolean;
  europeanNights: boolean;
  januaryWindow: boolean;
  /** One-Club XI mode (Phase 7): set together by ClubsDirectoryPage when a club card is picked.
      When present, DraftPage's pool fetch draws from this club's entire real history (by clubId)
      instead of config.leagueIds, and playerRatings is force-set to "season" alongside it (a
      career-best "Prime" row could belong to a different club). Cleared by SetupPage's "draft a
      full league instead" escape hatch. */
  lockedClubId?: string | undefined;
  lockedClubName?: string | undefined;
  /** Phase 9a (async multiplayer Leagues): set together by the join-league flow when a member
      accepts an invite. When present, DraftPage's doConfirm rides it along in createWorld's
      settings so WorldsService can attach this world to the member's LeagueMembership. eraId/
      leagueIds/difficulty are always locked alongside it (SetupPage hides their pickers); formation
      is locked too unless the league's rules set formationFreedom. Cleared the same way lockedClubId
      is — an explicit "leave this league draft" escape hatch in SetupPage. */
  multiplayerLeagueId?: string | undefined;
  multiplayerLeagueName?: string | undefined;
  multiplayerFormationLocked?: boolean | undefined;
}

const DEFAULT_CONFIG: DraftConfig = {
  eraId: "",
  leagueIds: [],
  formation: "4-3-3",
  difficulty: "normal",
  showRatings: true,
  draftMode: "squad-first",
  playerRatings: "season",
  managers: true,
  europeanNights: true,
  januaryWindow: true,
};

const REROLLS_BY_DIFFICULTY: Record<Difficulty, number> = { easy: 3, normal: 1, hard: 0 };

interface DraftContextValue {
  config: DraftConfig;
  setConfig: (patch: Partial<DraftConfig>) => void;
  resetConfig: () => void;

  picks: Record<number, PlayerSeasonDto>;
  addPick: (slotIndex: number, player: PlayerSeasonDto) => void;
  removePick: (slotIndex: number) => void;
  resetDraft: () => void;

  rerollsUsed: number;
  rerollsRemaining: number;
  useReroll: () => void;

  squadName: string;
  setSquadName: (name: string) => void;

  worldId: string | null;
  setWorldId: (id: string | null) => void;
}

const DraftContext = createContext<DraftContextValue | undefined>(undefined);

const WORLD_ID_STORAGE_KEY = "futbol_world_id";

export function DraftProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<DraftConfig>(DEFAULT_CONFIG);
  const [picks, setPicks] = useState<Record<number, PlayerSeasonDto>>({});
  const [rerollsUsed, setRerollsUsed] = useState(0);
  // Empty by default rather than a generic "My Fantasy XI" placeholder — DraftPage falls back to
  // the signed-in user's own name for both display and submission whenever this is still untouched.
  const [squadName, setSquadName] = useState("");
  // Persisted (unlike the rest of this context) so a page reload — or just leaving /season and
  // coming back — doesn't strand the user on Setup with no way back to a world that already
  // exists server-side. A fresh draft naturally overwrites this with a new id, so an old run is
  // never resurrected once you've moved on to building a new team.
  const [worldId, setWorldIdState] = useState<string | null>(() => localStorage.getItem(WORLD_ID_STORAGE_KEY));

  const setWorldId = useCallback((id: string | null) => {
    if (id) localStorage.setItem(WORLD_ID_STORAGE_KEY, id);
    else localStorage.removeItem(WORLD_ID_STORAGE_KEY);
    setWorldIdState(id);
  }, []);

  const setConfig = useCallback((patch: Partial<DraftConfig>) => {
    setConfigState((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetConfig = useCallback(() => setConfigState(DEFAULT_CONFIG), []);

  const addPick = useCallback((slotIndex: number, player: PlayerSeasonDto) => {
    setPicks((prev) => ({ ...prev, [slotIndex]: player }));
  }, []);

  const removePick = useCallback((slotIndex: number) => {
    setPicks((prev) => {
      const next = { ...prev };
      delete next[slotIndex];
      return next;
    });
  }, []);

  const resetDraft = useCallback(() => {
    setPicks({});
    setRerollsUsed(0);
  }, []);

  const useReroll = useCallback(() => setRerollsUsed((n) => n + 1), []);

  const rerollsRemaining = Math.max(REROLLS_BY_DIFFICULTY[config.difficulty] - rerollsUsed, 0);

  const value = useMemo<DraftContextValue>(
    () => ({
      config,
      setConfig,
      resetConfig,
      picks,
      addPick,
      removePick,
      resetDraft,
      rerollsUsed,
      rerollsRemaining,
      useReroll,
      squadName,
      setSquadName,
      worldId,
      setWorldId,
    }),
    [config, setConfig, resetConfig, picks, addPick, removePick, resetDraft, rerollsUsed, rerollsRemaining, useReroll, squadName, worldId],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): DraftContextValue {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error("useDraft must be used within DraftProvider");
  return ctx;
}
