import { useEffect, useState } from "react";
import { renderShareImage, type ShareCardModel } from "../lib/shareImage";

interface Props {
  card: ShareCardModel;
  /** Text that goes with the image (and is all that's shared where images can't be). */
  caption: string;
  fileName: string;
}

/** Share / Save image / WhatsApp / Copy caption for a rendered share card (38-0's growth engine —
    the old "Copy result" only put text on the clipboard). The image is drawn once on mount and shown
    as a preview; where canvas isn't available the text actions still work. */
export function ShareActions({ card, caption, fileName }: Props) {
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    void renderShareImage(card).then((blob) => {
      if (cancelled || !blob) return;
      url = URL.createObjectURL(blob);
      setImage({ blob, url });
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // The card is derived from finished-season data; drawing once per mount is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const file = image ? new File([image.blob], fileName, { type: "image/png" }) : null;
  const canShareFile = Boolean(file && typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] }));
  const canShareText = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function share() {
    try {
      if (canShareFile && file) await navigator.share({ files: [file], text: caption });
      else await navigator.share({ text: caption });
    } catch {
      // dismissed or unsupported — nothing to do
    }
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked
    }
  }

  const btn = "notch-sm border px-3 py-2 text-sm font-semibold transition";
  return (
    <div className="mt-6 space-y-3">
      {image && showPreview && (
        <img src={image.url} alt="Share image preview" className="notch mx-auto w-full max-w-xs border border-ink-700" />
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {canShareText && (
          <button type="button" onClick={() => void share()} className={`${btn} border-mint-500 bg-mint-500 text-ink-950 hover:bg-mint-400`}>
            Share
          </button>
        )}
        {image && (
          <a href={image.url} download={fileName} className={`${btn} border-ink-600 text-paper hover:border-mint-500/60`}>
            Save image
          </a>
        )}
        <a
          href={`https://wa.me/?text=${encodeURIComponent(caption)}`}
          target="_blank"
          rel="noreferrer"
          className={`${btn} border-ink-600 text-paper hover:border-mint-500/60`}
        >
          WhatsApp
        </a>
        <button type="button" onClick={() => void copyCaption()} className={`${btn} border-ink-600 text-paper hover:border-mint-500/60`}>
          {copied ? "Copied!" : "Copy caption"}
        </button>
      </div>
      {image && (
        <button type="button" onClick={() => setShowPreview((v) => !v)} className="text-xs text-smoke-500 hover:text-paper">
          {showPreview ? "Hide image" : "Preview image"}
        </button>
      )}
    </div>
  );
}
