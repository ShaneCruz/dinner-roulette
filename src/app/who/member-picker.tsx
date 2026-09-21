"use client";

import { useState, useTransition } from "react";
import { Avatar, Button } from "@/components/ui";
import { say } from "@/lib/copy";
import { chooseMember } from "./actions";

type PickerMember = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  chefTitle: string | null;
  hasPin: boolean;
  humorDial: "goofball" | "dry";
};

export function MemberPicker({ members }: { members: PickerMember[] }) {
  const [pinFor, setPinFor] = useState<PickerMember | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pick(m: PickerMember, enteredPin: string | null = null) {
    setError(null);
    startTransition(async () => {
      const result = await chooseMember(m.id, enteredPin);
      if (result?.error === "pin_required") {
        setPinFor(m);
      } else if (result?.error === "wrong_pin") {
        setPin("");
        setError(say("wrongPin", m.humorDial));
      } else if (result?.error) {
        setError("That profile is gone. Refresh and try again.");
      }
    });
  }

  function press(digit: string) {
    if (!pinFor || pending) return;
    const next = (pin + digit).slice(0, 4);
    setPin(next);
    if (next.length === 4) pick(pinFor, next);
  }

  if (pinFor) {
    return (
      <div className="mx-auto w-full max-w-xs text-center">
        <Avatar emoji={pinFor.emoji} color={pinFor.color} size="xl" className="mx-auto" />
        <p className="mt-3 text-xl font-bold">Hi {pinFor.name}! Enter your PIN.</p>
        <div className="my-5 flex justify-center gap-3" aria-label={`${pin.length} of 4 digits entered`}>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-4 w-4 rounded-full ${i < pin.length ? "bg-tomato" : "bg-border"}`}
            />
          ))}
        </div>
        {error ? (
          <p role="alert" className="mb-4 text-sm text-tomato-strong">
            {error}
          </p>
        ) : null}
        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <PinKey key={d} onClick={() => press(d)}>
              {d}
            </PinKey>
          ))}
          <PinKey
            onClick={() => {
              setPinFor(null);
              setPin("");
              setError(null);
            }}
            label="Back"
          >
            ←
          </PinKey>
          <PinKey onClick={() => press("0")}>0</PinKey>
          <PinKey onClick={() => setPin(pin.slice(0, -1))} label="Delete">
            ⌫
          </PinKey>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {members.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              disabled={pending}
              onClick={() => pick(m)}
              className="group flex w-full flex-col items-center rounded-3xl p-4 transition hover:bg-surface focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
            >
              <Avatar
                emoji={m.emoji}
                color={m.color}
                size="xl"
                className="transition group-hover:-rotate-6 group-hover:scale-110 group-active:scale-95"
              />
              <span className="mt-3 text-xl font-bold">{m.name}</span>
              {m.chefTitle ? <span className="text-sm text-muted">{m.chefTitle}</span> : null}
              {m.hasPin ? <span className="text-xs text-muted">🔒 PIN</span> : null}
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="mt-4 text-center text-sm text-tomato-strong">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PinKey({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label?: string;
}) {
  return (
    <Button type="button" variant="secondary" size="lg" onClick={onClick} aria-label={label} className="text-2xl">
      {children}
    </Button>
  );
}
