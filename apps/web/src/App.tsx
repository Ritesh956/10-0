import { useState } from "react";
import { AuthProvider, useAuth } from "./lib/auth-context";
import { AuthPage } from "./pages/AuthPage";
import { PlayPage } from "./pages/PlayPage";
import { SaveProgressModal } from "./components/SaveProgressModal";

function Shell() {
  const { isAuthenticated, user, logout } = useAuth();
  const [showSaveModal, setShowSaveModal] = useState(false);

  if (!isAuthenticated) return <AuthPage />;

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black tracking-tight text-emerald-400">FUTBOL</span>
            <span className="text-xs uppercase tracking-widest text-slate-500">Draft &middot; Simulate &middot; Go Unbeaten</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            {user?.isGuest && (
              <button
                onClick={() => setShowSaveModal(true)}
                className="rounded-md bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400 transition hover:bg-amber-500/20"
              >
                Save your progress
              </button>
            )}
            <span>{user?.displayName}</span>
            <button
              onClick={logout}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <PlayPage />
      </main>
      {showSaveModal && <SaveProgressModal onClose={() => setShowSaveModal(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
