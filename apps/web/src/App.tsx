import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth-context";
import { DraftProvider } from "./state/DraftContext";
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

  return (
    <div className="min-h-screen bg-ink-950">
      <SiteHeader onRequestSaveProgress={isAuthenticated ? () => setShowSaveModal(true) : undefined} />
      <main>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/signin" element={<AuthPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/draft" element={<DraftPage />} />
          <Route path="/season" element={<SeasonPage />} />
          <Route path="/multiplayer" element={<MultiplayerPage />} />
        </Routes>
      </main>
      {showSaveModal && <SaveProgressModal onClose={() => setShowSaveModal(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DraftProvider>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </DraftProvider>
    </AuthProvider>
  );
}
