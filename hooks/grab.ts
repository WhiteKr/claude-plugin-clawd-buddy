import type { ClientModule } from 'claude-code'

// What the band hands the region laid over Clawd: where Clawd stands (`at`,
// the share of the room left of it) and the cells it may move across (`room`,
// the band's width, or 0 where other rows pin it to the left).
type Grab = { at: number; room: number }

// The band draws one Clawd, so one region at a time reads these.
let latest: Grab = { at: 0, room: 0 }
let grabbedAt: number | undefined

// The person picks Clawd up with a press and carries it along the band. The
// spot they grabbed stays under the pointer: each move puts Clawd where the
// pointer is now, less how far into Clawd they grabbed, clamped to the band.
const grab: ClientModule<Grab, true> = (props, surface) => {
  latest = props

  if (surface.state === undefined) {
    surface.onPointer(event => {
      const { at, room } = latest
      const span = room - surface.columns
      const following = (x: number) =>
        grabbedAt === undefined || span <= 0 ? at : Math.min(1, Math.max(0, at + (x - grabbedAt) / span))

      if (event.type === 'down' && event.button === 'left') {
        grabbedAt = event.x
        surface.post({ held: true, at })
      } else if (event.type === 'move' && grabbedAt !== undefined) {
        surface.post({ held: true, at: following(event.x) })
      } else if (event.type === 'up' && grabbedAt !== undefined) {
        surface.post({ held: false, at: following(event.x) })
        grabbedAt = undefined
      }
    })
    surface.setState(true)
  }

  return surface.elements.Box({ width: '100%', height: '100%' })
}

export default grab
