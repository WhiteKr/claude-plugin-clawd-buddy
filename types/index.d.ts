export type Activity = 'idle' | 'thinking' | 'reading' | 'searching' | 'editing' | 'running' | 'waiting' | 'done' | 'interrupted'

// `at` is where Clawd stands when it has the band alone: the share of the
// room left of it, 0 to 1. Absent in a value an earlier version stored.
export type Picture = { source: string; alt: string; at?: number }

declare module 'claude-code' {
  interface PluginState {
    'clawd-buddy': { picture: Picture }
  }
}
