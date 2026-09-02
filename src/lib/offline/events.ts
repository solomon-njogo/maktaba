type Listener = () => void

const CHANNEL_NAME = "maktaba-library"
const listeners = new Set<Listener>()

let channel: BroadcastChannel | null | undefined

function getChannel() {
  if (channel !== undefined) return channel
  if (typeof BroadcastChannel === "undefined") {
    channel = null
    return channel
  }
  channel = new BroadcastChannel(CHANNEL_NAME)
  channel.onmessage = () => {
    for (const listener of listeners) listener()
  }
  return channel
}

export function subscribeLibrary(listener: Listener): () => void {
  getChannel()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyLibrary() {
  for (const listener of listeners) {
    listener()
  }
  try {
    getChannel()?.postMessage("refresh")
  } catch {
    // Channel may be closed in a dying worker.
  }
}
