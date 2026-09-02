import dns from "node:dns";
import path from "node:path";

import { config } from "dotenv";

dns.setDefaultResultOrder("ipv4first");

const repoRoot = path.resolve(__dirname, "../../..");

config({ path: path.join(repoRoot, ".env"), quiet: true });
config({ path: path.join(repoRoot, "src", ".env"), quiet: true });
config({
  path: path.join(repoRoot, "src", ".env.local"),
  override: true,
  quiet: true,
});
