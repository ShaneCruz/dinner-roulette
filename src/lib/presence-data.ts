import { asc, gte } from "drizzle-orm";
import { db } from "@/db";
import { memberAvailability } from "@/db/schema";
import type { PresenceRange } from "./presence";

/** Availability ranges that haven't ended before `fromDate`. */
export async function loadPresenceRanges(fromDate: string): Promise<PresenceRange[]> {
  const rows = await db
    .select()
    .from(memberAvailability)
    .where(gte(memberAvailability.endDate, fromDate))
    .orderBy(asc(memberAvailability.startDate));
  return rows.map((r) => ({
    id: r.id,
    memberId: r.memberId,
    startDate: r.startDate,
    endDate: r.endDate,
    presence: r.presence,
    label: r.label,
    tentative: r.tentative,
  }));
}
