/**
 * React Native fails if ANDROID_HOME and ANDROID_SDK_ROOT point at different folders.
 * This wrapper forces them to match (preferring ANDROID_HOME) before spawning Expo/Gradle.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const env = { ...process.env };
if (env.ANDROID_HOME) {
  env.ANDROID_SDK_ROOT = env.ANDROID_HOME;
} else if (env.ANDROID_SDK_ROOT) {
  env.ANDROID_HOME = env.ANDROID_SDK_ROOT;
}

const cwd = path.join(__dirname, "..");
const rootAbs = path.resolve(cwd);
if (/OneDrive/i.test(rootAbs) || rootAbs.length > 88) {
  console.warn(
    "\n[maktaba] Android native builds often break here: long paths (CMake 250-char limit) and OneDrive " +
      "sync can cause Ninja \"build.ninja still dirty\".\n" +
      "Reliable fixes: copy the repo to a short folder (e.g. C:\\dev\\MAKTABA), pause OneDrive for that copy, " +
      "then run npm install and npm run run:android again.\n"
  );
}

const extra = process.argv.slice(2);
const result = spawnSync("npx", ["expo", "run:android", ...extra], {
  cwd,
  env,
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
