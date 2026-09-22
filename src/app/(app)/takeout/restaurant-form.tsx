"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { saveRestaurant } from "./actions";

type Values = { name: string; cuisine: string; area: string; website: string; phone: string; notes: string };

export function RestaurantForm({
  id = null,
  initial,
  aiOn,
  onSaved,
}: {
  id?: string | null;
  initial?: Partial<Values>;
  aiOn: boolean;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>({
    name: "",
    cuisine: "",
    area: "",
    website: "",
    phone: "",
    notes: "",
    ...initial,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [key]: e.target.value });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            const result = await saveRestaurant(id, values);
            if ("error" in result) return setError(result.error);
            if (onSaved) onSaved();
            else router.push(`/takeout/${result.id}${aiOn && !id ? "?research=1" : ""}`);
          } catch {
            setError("That didn't save. Reload and try again.");
          }
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Restaurant">
          <input className={inputClass} value={values.name} onChange={set("name")} placeholder="Chipotle" required />
        </Field>
        <Field label="Type of food">
          <input className={inputClass} value={values.cuisine} onChange={set("cuisine")} placeholder="Mexican" required />
        </Field>
        <Field label="Town or neighborhood" hint="Helps find the right location">
          <input className={inputClass} value={values.area} onChange={set("area")} placeholder="Lake Forest" />
        </Field>
        <Field label="Website" hint="Optional, but helps find the menu">
          <input className={inputClass} value={values.website} onChange={set("website")} placeholder="chipotle.com" inputMode="url" />
        </Field>
        <Field label="Phone">
          <input className={inputClass} value={values.phone} onChange={set("phone")} inputMode="tel" />
        </Field>
        <Field label="Notes" hint="“Order ahead on the app”, “Brayden loves the queso”">
          <input className={inputClass} value={values.notes} onChange={set("notes")} />
        </Field>
      </div>
      {error ? (
        <p role="alert" className="rounded-2xl bg-tomato-soft px-4 py-2 text-sm text-tomato-strong">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !values.name.trim() || !values.cuisine.trim()}>
          {pending ? "Saving…" : id ? "Save" : aiOn ? "Add and find the menu" : "Add restaurant"}
        </Button>
      </div>
    </form>
  );
}
