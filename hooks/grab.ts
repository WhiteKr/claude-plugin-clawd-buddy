import type { ClientModule } from 'claude-code'

// Two regions catch the pointer for Clawd. `grab` lies over Clawd and hears
// the press that picks it up. The desktop tells a region about the pointer
// only while the pointer is over it, so while Clawd is held, `track` lies
// over the whole band and hears where the pointer goes and where it lets go.
//
// `offset` is how far into Clawd it was grabbed and `clawd` how wide Clawd
// is, both in cells, so the grabbed spot stays under the pointer. `movable`
// is false where other rows pin Clawd to the left: it is held, not carried.
type Grab = { mode: 'grab' } | { mode: 'track'; offset: number; clawd: number; movable: boolean }

// Each instance's latest props, for the listener it set on its first call.
const latest = new WeakMap<object, { props: Grab; at?: number }>()

const grab: ClientModule<Grab, true> = (props, surface) => {
  const seen = latest.get(surface)

  if (seen === undefined) {
    const mine: { props: Grab; at?: number } = { props }
    latest.set(surface, mine)

    surface.onPointer(event => {
      const now = mine.props

      if (now.mode === 'grab') {
        if (event.type === 'down' && event.button === 'left') {
          surface.post({ held: true, offset: event.x, clawd: surface.columns })
        } else if (event.type === 'up') {
          surface.post({ held: false })
        }
        return
      }

      const span = surface.columns - now.clawd

      if (now.movable && span > 0 && event.type !== 'leave') {
        mine.at = Math.min(1, Math.max(0, (event.x - now.offset) / span))
      }

      // A move carries Clawd. A release, a press or the pointer leaving the
      // band sets it down, since a release outside the band never arrives.
      if (event.type === 'move') {
        surface.post({ held: true, at: mine.at ?? null })
      } else if (event.type !== 'enter') {
        surface.post({ held: false, at: mine.at ?? null })
      }
    })
    surface.setState(true)
  } else {
    seen.props = props
  }

  return surface.elements.Box({ width: '100%', height: '100%' })
}

export default grab
