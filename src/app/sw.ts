/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { defaultCache } from "@serwist/turbopack/worker"
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist"
import { CacheFirst, ExpirationPlugin, Serwist } from "serwist"

import {
  BACKGROUND_SYNC_TAG,
  hydrateLibrary,
  PERIODIC_SYNC_TAG,
} from "../lib/offline/sync"

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const coverHost = (hostname: string) =>
  hostname === "covers.openlibrary.org" ||
  hostname === "books.google.com" ||
  hostname === "books.googleusercontent.com" ||
  hostname.endsWith(".airtableusercontent.com") ||
  hostname === "dl.airtable.com"

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => coverHost(url.hostname),
      handler: new CacheFirst({
        cacheName: "maktaba-covers",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 1000,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          }),
        ],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/",
        matcher({ request }) {
          return request.destination === "document"
        },
      },
    ],
  },
})

serwist.addEventListeners()

self.addEventListener("sync", (event) => {
  const syncEvent = event as ExtendableEvent & { tag: string }
  if (syncEvent.tag !== BACKGROUND_SYNC_TAG) return
  syncEvent.waitUntil(hydrateLibrary())
})

self.addEventListener("periodicsync", (event) => {
  const periodicEvent = event as ExtendableEvent & { tag: string }
  if (periodicEvent.tag !== PERIODIC_SYNC_TAG) return
  periodicEvent.waitUntil(hydrateLibrary())
})
