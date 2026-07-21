import { useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth-context";
import { DraftProvider } from "./state/DraftContext";
import { fadeSlide } from "./lib/motion";
import { AuthPage } from "./pages/AuthPage";
import { LandingPage } from "./pages/LandingPage";
import { SetupPage } from "./pages/SetupPage";
import { DraftPage } from "./pages/DraftPage";
import { SeasonPage } from "./pages/SeasonPage";
import { MultiplayerPage } from "./pages/MultiplayerPage";
import { SiteHeader } from "./components/SiteHeader";
import { SaveProgressModal } from "./components/SaveProgressModal";

function Shell() {
  const { isAuthenticated } = useAuth();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-ink-950">
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
