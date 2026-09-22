"use client";

import { useState, useSyncExternalStore } from "react";
import { Button, Card } from "@/components/ui";

const noop = () => () => {};

/** The bookmarklet: finds the page's schema.org Recipe and sends it to the app. */
function bookmarklet(origin: string): string {
  const code = `(()=>{const f=n=>{if(!n)return null;if(Array.isArray(n)){for(const x of n){const r=f(x);if(r)return r}return null}if(typeof n!=="object")return null;const t=n["@type"];if(t==="Recipe"||(Array.isArray(t)&&t.includes("Recipe")))return n;return n["@graph"]?f(n["@graph"]):null};let r=null;document.querySelectorAll('script[type="application/ld+json"]').forEach(s=>{if(!r){try{r=f(JSON.parse(s.textContent))}catch(e){}}});if(!r){alert("Couldn't find a recipe on this page. Try taking screenshots instead.");return}const{review,video,image,...rest}=r;location.href="${origin}/recipes/import#send="+encodeURIComponent(JSON.stringify({url:location.href,recipe:rest}))})()`;
  return `javascript:${code}`;
}

export function SendButtonSetup() {
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const [copied, setCopied] = useState(false);
  const code = origin ? bookmarklet(origin) : "";

  return (
    <>
      <Card className="space-y-3">
        <p className="font-bold">📱 iPhone (Safari)</p>
        <ol className="ml-5 list-decimal space-y-1 text-sm">
          <li>
            Tap <strong>Copy the button code</strong> below.
          </li>
          <li>
            Bookmark any page: tap <strong>Share</strong> → <strong>Add Bookmark</strong>, name it <strong>Send to Dinner Roulette</strong>, Save.
          </li>
          <li>
            Open Bookmarks, tap <strong>Edit</strong>, tap the new bookmark, clear its address and paste the code. Tap Done.
          </li>
        </ol>
        <Button
          type="button"
          disabled={!code}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
            } catch {
              window.prompt("Copy this:", code);
            }
          }}
        >
          {copied ? "✓ Copied" : "📋 Copy the button code"}
        </Button>
      </Card>
      <Card className="space-y-2">
        <p className="font-bold">💻 Computer</p>
        <p className="text-sm">Drag this to your bookmarks bar:</p>
        {code ? (
          <a
            href={code}
            onClick={(e) => e.preventDefault()}
            className="inline-block rounded-full bg-tomato px-4 py-2 font-semibold text-white"
          >
            🍽️ Send to Dinner Roulette
          </a>
        ) : null}
      </Card>
    </>
  );
}
