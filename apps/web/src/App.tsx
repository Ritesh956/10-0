import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth-context";
import { DraftProvider } from "./state/DraftContext";
import { fadeSlide } from "./lib/motion";
import { routeTitle } from "./lib/routeTitles";
import { AuthPage } from "./pages/AuthPage";
import { LandingPage } from "./pages/LandingPage";
import { SetupPage } from "./pages/SetupPage";
import { DraftPage } from "./pages/DraftPage";
import { SeasonPage } from "./pages/SeasonPage";
import { MultiplayerPage } from "./pages/MultiplayerPage";
import { ProfilePage } from "./pages/ProfilePage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { ClubsDirectoryPage } from "./pages/ClubsDirectoryPage";
import { NationsDirectoryPage } from "./pages/NationsDirectoryPage";
import { DailyChallengePage } from "./pages/DailyChallengePage";
import { DailyArchivePage } from "./pages/DailyArchivePage";
import { HowItWorksPage } from "./pages/HowItWorksPage";
import { HowToPlayPage } from "./pages/HowToPlayPage";
import { BestXiPage } from "./pages/BestXiPage";
import { LeagueBestXiPage } from "./pages/LeagueBestXiPage";
import { StoryPage } from "./pages/StoryPage";
import { LeagueJoinPage } from "./pages/LeagueJoinPage";
import { LeagueDetailPage } from "./pages/LeagueDetailPage";
import { LiveDraftJoinPage } from "./pages/LiveDraftJoinPage";
import { LiveDraftPage } from "./pages/LiveDraftPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SiteHeader } from "./components/SiteHeader";
import { SaveProgressModal } from "./components/SaveProgressModal";

function Shell() {
  const { isAuthenticated } = useAuth();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const location = useLocation();

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
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_70%_45%_at_50%_-8%,rgba(31,191,117,0.10),transparent),radial-gradient(ellipse_55%_40%_at_105%_15%,rgba(61,143,130,0.08),transparent),radial-gradient(ellipse_60%_45%_at_-5%_100%,rgba(22,101,52,0.10),transparent)]"
      />
      <SiteHeader onRequestSaveProgress={isAuthenticated ? () => setShowSaveModal(true) : undefined} />
      <main>
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname} variants={fadeSlide} initial="initial" animate="animate" exit="exit">
            <Routes location={location}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/signin" element={<AuthPage />} />
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/draft" element={<DraftPage />} />
              <Route path="/season" element={<SeasonPage />} />
              <Route path="/multiplayer" element={<MultiplayerPage />} />
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
      <AuthProvider>
        <DraftProvider>
          <BrowserRouter>
            <Shell />
          </BrowserRouter>
        </DraftProvider>
      </AuthProvider>
    </MotionConfig>
  );
}
