import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";

/** Catch-all route — unknown URLs used to render an empty page under the header. */
export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
      <p className="font-display text-6xl font-bold text-mint-400">404</p>
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-paper">Off the pitch</h1>
      <p className="text-sm text-smoke-500">That page doesn&apos;t exist — the link may be old or mistyped.</p>
      <div className="flex gap-3">
        <Button onClick={() => navigate("/")}>Home</Button>
        <Button variant="outline" onClick={() => navigate("/setup")}>
          Start a draft
        </Button>
      </div>
    </div>
  );
}
