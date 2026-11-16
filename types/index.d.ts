export type Activity = 'idle' | 'thinking' | 'reading' | 'searching' | 'editing' | 'running' | 'waiting' | 'done'

export type Picture = { source: string; alt: string }

declare module 'claude-code' {
  interface PluginState {
    'clawd-buddy': { picture: Picture }
  }
}
