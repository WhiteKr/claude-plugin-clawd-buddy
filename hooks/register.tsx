import type { Register } from 'claude-code'

import type { Activity, Picture } from '../types'
import { CLIP_BOX, CLIPS, FPS } from './clawd-clips'
import type { ClawdClip } from './clawd-clips'

const PICTURE = { plugin: 'clawd-buddy', key: 'picture' } as const
// The engine redraws a site at most ten times a second.
const TICK_MS = 100

// The new-session page fits the 2750-unit-wide clip canvas into 80px, so a
// 50-unit pixel of Clawd comes out the same size here as there.
const APP_SCALE = 80 / 2750

const TOOL_ACTIVITY: Record<string, Activity> = {
  Read: 'reading',
  NotebookRead: 'reading',
  WebSearch: 'searching',
  WebFetch: 'searching',
  ToolSearch: 'searching',
  Edit: 'editing',
  MultiEdit: 'editing',
  Write: 'editing',
  NotebookEdit: 'editing',
  Bash: 'running',
  Monitor: 'running',
  AskUserQuestion: 'waiting',
}

const BASH_READERS = new Set(['cat', 'head', 'tail', 'less', 'more', 'bat', 'nl', 'wc', 'jq', 'file', 'stat', 'diff'])
const BASH_SEARCHERS = new Set(['rg', 'grep', 'egrep', 'ugrep', 'ag', 'find', 'fd', 'ls', 'tree', 'locate', 'which'])

export const bashActivity = (command: string): Activity => {
  const programs = command
    .split(/&&|\|\||[|;\n]/)
    .map(segment => {
      const words = segment.trim().split(/\s+/).filter(w => !/^\w+=/.test(w))
      const [first = '', second = ''] = words
      const program = first.split('/').at(-1) ?? ''

      if (program === 'git' && second === 'grep') return 'rg'
      if (program === 'sed') return words.some(w => /^-\w*i/.test(w)) ? 'sed -i' : 'cat'
      return program
    })

  if (programs.some(p => BASH_SEARCHERS.has(p))) return 'searching'
  if (programs.length > 0 && programs.every(p => BASH_READERS.has(p) || p === 'cd' || p === '')) return 'reading'
  return 'running'
}

type Performance = { intro?: ClawdClip; loop: ClawdClip; alt: string }

const PERFORMANCE: Record<Activity, Performance> = {
  idle: { loop: 'snooze', alt: 'Clawd dozes' },
  thinking: { loop: 'walk', alt: 'Clawd paces back and forth, thinking' },
  reading: { loop: 'read', alt: 'Clawd reads a book, turning the pages' },
  searching: { loop: 'search', alt: 'Clawd searches with a magnifying glass' },
  editing: { loop: 'laptop', alt: 'Clawd types on a laptop' },
  running: { loop: 'laptop', alt: 'Clawd runs a command on a laptop' },
  waiting: { loop: 'stretch', alt: 'Clawd stretches while waiting for you' },
  done: { intro: 'dance', loop: 'snooze', alt: 'Clawd does a little crab dance, done, then dozes off' },
}

// Alone in the band, Clawd strolls across it while thinking: each tick moves
// it this share of the room beside it, about 48px a second on a 700px band.
const STROLL_STEP = 0.007
// Walk frames from here on are the outro's standing pose: Clawd stops there.
const STRIDES = 16

const WIDTH = CLIP_BOX.width * APP_SCALE
const HEIGHT = CLIP_BOX.height * APP_SCALE

type Frame = { name: ClawdClip; index: number }

// A clip's intro plays once, then its loop repeats; its outro is only played
// on the way out, so every clip is left in the standing pose it started from.
const playing = ({ intro, loop }: Performance, frame: number): Frame => {
  const introLength = intro === undefined ? 0 : CLIPS[intro].outroFrom

  if (intro !== undefined && frame < introLength) {
    return { name: intro, index: frame }
  }

  const { loopFrom, outroFrom } = CLIPS[loop]
  const f = frame - introLength

  return { name: loop, index: f < outroFrom ? f : loopFrom + ((f - loopFrom) % (outroFrom - loopFrom)) }
}

// Leaving mid-intro plays the intro back; leaving mid-loop plays the outro.
const leaving = (performance: Performance, frame: number): Frame[] => {
  const { name, index } = playing(performance, frame)
  const { loopFrom, outroFrom, frames } = CLIPS[name]
  const indexes =
    index < loopFrom
      ? Array.from({ length: index }, (_, i) => index - 1 - i)
      : Array.from({ length: frames.length - outroFrom }, (_, i) => outroFrom + i)

  return indexes.map(i => ({ name, index: i }))
}

// When the next performance plays the clip already on screen, it picks up
// from the same frame instead of leaving and starting that clip over.
const carryOn = ({ intro, loop }: Performance, { name, index }: Frame): number | undefined => {
  if (name === intro && index < CLIPS[intro].outroFrom) {
    return index
  }
  if (name === loop) {
    return (intro === undefined ? 0 : CLIPS[intro].outroFrom) + index
  }

  return undefined
}

// The desktop strips CSS animation from plugin SVG while it composites in
// software, so each frame is drawn still and the tick steps them.
// A stroll to the left mirrors the walk, so Clawd faces the way it goes.
const picture = ({ name, index }: Frame, alt: string, at = 0, mirrored = false): Picture => {
  const { groups, frames } = CLIPS[name]
  const drawn = (frames[index] ?? []).map(g => groups[g]).join('')
  const markup = mirrored
    ? `<g transform="translate(${2 * CLIP_BOX.x + CLIP_BOX.width} 0) scale(-1 1)">${drawn}</g>`
    : drawn

  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="${CLIP_BOX.x} ${CLIP_BOX.y} ${CLIP_BOX.width} ${CLIP_BOX.height}" shape-rendering="crispEdges">${markup}</svg>`,
    alt,
    at,
  }
}

const strolling = ({ name, index }: Frame) => name === 'walk' && index < STRIDES

// Steps along the band, turning at either end. `at` is the share of the room
// left of Clawd, from 0 at the left end to 1 at the right.
const stroll = (at: number, heading: 1 | -1): { at: number; heading: 1 | -1 } => {
  const next = at + heading * STROLL_STEP

  if (next >= 1) return { at: 1, heading: -1 }
  if (next <= 0) return { at: 0, heading: 1 }
  return { at: next, heading }
}

const running: Activity[] = []
let activity: Activity = 'idle'
let tick = 0
let scene: { activity: Activity; since: number } = { activity, since: 0 }
let exit: { frames: Frame[]; since: number } | undefined
let place: { at: number; heading: 1 | -1 } = { at: 0, heading: 1 }
let shown = picture(playing(PERFORMANCE[activity], 0), PERFORMANCE[activity].alt)

const act = (next: Activity) => {
  activity = next
}

const framesSince = (since: number) => Math.floor(((tick - since) * TICK_MS * FPS) / 1000)

const advance = (): Picture => {
  if (exit !== undefined && framesSince(exit.since) >= exit.frames.length) {
    exit = undefined
    scene = { activity, since: tick }
  }
  if (exit === undefined && scene.activity !== activity) {
    const carried = carryOn(PERFORMANCE[activity], playing(PERFORMANCE[scene.activity], framesSince(scene.since)))

    if (carried !== undefined) {
      scene = { activity, since: tick - ((carried + 0.5) * 1000) / (TICK_MS * FPS) }
    }
  }
  if (exit === undefined && scene.activity !== activity) {
    const frames = leaving(PERFORMANCE[scene.activity], framesSince(scene.since))
    exit = frames.length > 0 ? { frames, since: tick } : undefined
    scene = exit === undefined ? { activity, since: tick } : scene
  }

  const { alt } = PERFORMANCE[scene.activity]
  const frame = exit?.frames[framesSince(exit.since)] ?? playing(PERFORMANCE[scene.activity], framesSince(scene.since))

  const walking = strolling(frame)

  if (walking) {
    place = stroll(place.at, place.heading)
  }

  return picture(frame, alt, place.at, walking && place.heading < 0)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    act('idle')
    $.clock.every(TICK_MS, () => {
      tick += 1
      const now = advance()

      if (now.source !== shown.source || now.alt !== shown.alt || now.at !== shown.at) {
        shown = now
        void $.state.set(PICTURE, shown)
      }
    })

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      running.length = 0
      act('thinking')
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      running.length = 0
      act('done')
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const doing = e.tool === 'Bash' ? bashActivity(e.command) : (TOOL_ACTIVITY[e.tool] ?? 'running')
    running.push(doing)
    act(doing)
    const ran = await next(e)
    running.splice(running.indexOf(doing), 1)

    if (activity !== 'idle' && activity !== 'done') {
      act(running.at(-1) ?? 'thinking')
    }

    return ran
  }).catch(($, e, next) => next(e))

  // This row reads no state: a redraw here would change the rows the list hook below
  // is asked with, and the desktop shows the unwrapped band until it answers.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'desktop' || e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Svg } = $.ui.resolve(e)

    return (
      <Box>
        <Svg {...picture(playing(PERFORMANCE[activity], 0), PERFORMANCE[activity].alt)} width={WIDTH} height={HEIGHT} />
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePromptList' }, async ($, e, next) => {
    if (e.surface !== 'desktop' || e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Svg } = $.ui.resolve(e)
    const now = (await $.state.get(PICTURE)).value ?? shown
    const otherRows = e.props.rows.filter(row => row.plugin !== $.plugin.name)
    const clawd = <Svg source={now.source} alt={now.alt} width={WIDTH} height={HEIGHT} />

    // With no other rows the band is Clawd's alone: the two spacers split the
    // room around it, so `at` places it anywhere from the left end to the right.
    if (otherRows.length === 0) {
      const at = now.at ?? 0

      return (
        <Box flexDirection="row" alignItems="center">
          <Box flexGrow={at} />
          {clawd}
          <Box flexGrow={1 - at} />
        </Box>
      )
    }

    return (
      <Box flexDirection="row" alignItems="center" gap={1}>
        {clawd}
        <Box flexDirection="column" flexGrow={1}>
          {await next({ ...e, props: { ...e.props, rows: otherRows } })}
        </Box>
      </Box>
    )
  })
}
