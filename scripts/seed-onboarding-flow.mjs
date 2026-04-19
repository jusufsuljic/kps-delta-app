import "dotenv/config";

process.env.SEED_SHOOTER_PASSWORD_MODE = "setup-pending";

await import("./seed.mjs");
