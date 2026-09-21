import { config } from "dotenv";

// Next.js loads these automatically; standalone scripts need a nudge.
config({ path: [".env.local", ".env"], quiet: true });
