import { Suspense, lazy, useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth-context";
import { I18nProvider } from "./lib/i18n/context";
import { DraftProvider, useDraft } from "./state/DraftContext";
import { applyLeagueTheme, storedLeagueTheme } from "./lib/leagueTheme";
import { playLeagueIdOf } from "./lib/leagues";
import { fadeSlide } from "./lib/motion";
import { routeTitle } from "./lib/routeTitles";
import { useOnline } from "./lib/install";
import { LandingPage } from "./pages/LandingPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SiteHeader } from "./components/SiteHeader";
import { SaveProgressModal } from "./components/SaveProgressModal";

// Every page except the landing page and the 404 is its own chunk, so first load only ships what the
// entry route needs (the Draft/Season pages and their charting/share code are the heavy ones).
const AuthPage = lazy(() => import("./pages/AuthPage").then((m) => ({ default: m.AuthPage })));
const MagicLinkPage = lazy(() => import("./pages/MagicLinkPage").then((m) => ({ default: m.MagicLinkPage })));
const SetupPage = lazy(() => import("./pages/SetupPage").then((m) => ({ default: m.SetupPage })));
const DraftPage = lazy(() => import("./pages/DraftPage").then((m) => ({ default: m.DraftPage })));
const SeasonPage = lazy(() => import("./pages/SeasonPage").then((m) => ({ default: m.SeasonPage })));
const MultiplayerPage = lazy(() => import("./pages/MultiplayerPage").then((m) => ({ default: m.MultiplayerPage })));
const EventsPage = lazy(() => import("./pages/EventsPage").then((m) => ({ default: m.EventsPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage").then((m) => ({ default: m.LeaderboardPage })));
const ClubsDirectoryPage = lazy(() => import("./pages/ClubsDirectoryPage").then((m) => ({ default: m.ClubsDirectoryPage })));
const NationsDirectoryPage = lazy(() => import("./pages/NationsDirectoryPage").then((m) => ({ default: m.NationsDirectoryPage })));
const DailyChallengePage = lazy(() => import("./pages/DailyChallengePage").then((m) => ({ default: m.DailyChallengePage })));
const DailyArchivePage = lazy(() => import("./pages/DailyArchivePage").then((m) => ({ default: m.DailyArchivePage })));
const HowItWorksPage = lazy(() => import("./pages/HowItWorksPage").then((m) => ({ default: m.HowItWorksPage })));
const HowToPlayPage = lazy(() => import("./pages/HowToPlayPage").then((m) => ({ default: m.HowToPlayPage })));
const BestXiPage = lazy(() => import("./pages/BestXiPage").then((m) => ({ default: m.BestXiPage })));
const LeagueBestXiPage = lazy(() => import("./pages/LeagueBestXiPage").then((m) => ({ default: m.LeagueBestXiPage })));
const StoryPage = lazy(() => import("./pages/StoryPage").then((m) => ({ default: m.StoryPage })));
const LeagueJoinPage = lazy(() => import("./pages/LeagueJoinPage").then((m) => ({ default: m.LeagueJoinPage })));
const LeagueDetailPage = lazy(() => import("./pages/LeagueDetailPage").then((m) => ({ default: m.LeagueDetailPage })));
const LiveDraftJoinPage = lazy(() => import("./pages/LiveDraftJoinPage").then((m) => ({ default: m.LiveDraftJoinPage })));
const LiveDraftPage = lazy(() => import("./pages/LiveDraftPage").then((m) => ({ default: m.LiveDraftPage })));

/** Keeps the accent colour on the league being played (else the last one chosen, else the default). */
function LeagueThemeSync() {
  const { config } = useDraft();
  const leagueId = playLeagueIdOf(config);
  useEffect(() => {
    applyLeagueTheme(leagueId ?? storedLeagueTheme());
  }, [leagueId]);
  return null;
}

function PageLoading() {
  return (
    <p role="status" className="px-4 py-24 text-center text-sm text-paper/60">
      Loading…
    </p>
  );
}

function Shell() {
  const { isAuthenticated } = useAuth();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const location = useLocation();
  const online = useOnline();

  // A new page always starts at the top — without this, Setup -> Draft landed mid-page at Setup's
  // old scroll offset.
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = routeTitle(location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen bg-ink-950">
      {/* Stadium-floodlight atmosphere: flat ink-950 everywhere read as dull, so every page gets a
          faint layered glow (mint top, teal bottom-right, grass bottom-left) instead of solid black.
          Fixed + behind everything + very low opacity, so it never competes with content contrast. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_70%_45%_at_50%_-8%,rgb(var(--c-mint-500)/0.10),transparent),radial-gradient(ellipse_55%_40%_at_105%_15%,rgba(61,143,130,0.08),transparent),radial-gradient(ellipse_60%_45%_at_-5%_100%,rgba(22,101,52,0.10),transparent)]"
      />
      <LeagueThemeSync />
      <SiteHeader onRequestSaveProgress={isAuthenticated ? () => setShowSaveModal(true) : undefined} />
      {!online && (
        <p role="status" className="bg-amber-500/15 px-4 py-2 text-center text-xs font-semibold text-amber-300">
          You&apos;re offline — drafts and seasons need a connection, they&apos;ll pick up when you&apos;re back.
        </p>
      )}
      <main>
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname} variants={fadeSlide} initial="initial" animate="animate" exit="exit">
            <Suspense fallback={<PageLoading />}>
              <Routes location={location}>
                <Route path="/" element={<LandingPage />} />
                <Route path="/signin" element={<AuthPage />} />
                <Route path="/auth/magic" element={<MagicLinkPage />} />
                <Route path="/setup" element={<SetupPage />} />
                <Route path="/draft" element={<DraftPage />} />
                <Route path="/season" element={<SeasonPage />} />
                <Route path="/multiplayer" element={<MultiplayerPage />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/multiplayer/join/:code" element={<LeagueJoinPage />} />
                <Route path="/multiplayer/league/:leagueId" element={<LeagueDetailPage />} />
                <Route path="/multiplayer/live/join/:code" element={<LiveDraftJoinPage />} />
                <Route path="/multiplayer/live/:roomId" element={<LiveDraftPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/history" element={<Navigate to="/profile" replace />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/clubs" element={<ClubsDirectoryPage />} />
                <Route path="/nations" element={<NationsDirectoryPage />} />
                <Route path="/daily" element={<DailyChallengePage />} />
                <Route path="/daily/archive" element={<DailyArchivePage />} />
                <Route path="/daily/:date" element={<DailyChallengePage />} />
                <Route path="/how-it-works" element={<HowItWorksPage />} />
                <Route path="/how-to-play" element={<HowToPlayPage />} />
                <Route path="/best-xi" element={<BestXiPage />} />
                <Route path="/best-xi/:league" element={<LeagueBestXiPage />} />
                <Route path="/story" element={<StoryPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      {showSaveModal && <SaveProgressModal onClose={() => setShowSaveModal(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <I18nProvider>
        <AuthProvider>
          <DraftProvider>
            <BrowserRouter>
              <Shell />
            </BrowserRouter>
          </DraftProvider>
        </AuthProvider>
      </I18nProvider>
    </MotionConfig>
  );
}
