import "./load-env";
import { db } from "@/db";
import { backfillNutrition } from "@/lib/nutrition-store";

// Estimates nutrition for recipes that don't have it yet. The scheduler does
// this a few at a time; run this to do them all at once.
async function main() {
  let total = 0;
  for (;;) {
    const done = await backfillNutrition(db, 6);
    total += done;
    if (!done) break;
    console.log(`Estimated ${total} so far...`);
  }
  console.log(`Done. Estimated nutrition for ${total} recipes.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
