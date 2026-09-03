import { spawnSync } from "node:child_process"

import { createSerwistRoute } from "@serwist/turbopack"

const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID()

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    additionalPrecacheEntries: [
      { url: "/", revision },
      { url: "/tbr", revision },
      { url: "/reading", revision },
      { url: "/done", revision },
      { url: "/to-buy", revision },
      { url: "/borrowed", revision },
      { url: "/pending", revision },
      { url: "/design-system", revision },
    ],
    swSrc: "app/sw.ts",
    useNativeEsbuild: true,
  })
