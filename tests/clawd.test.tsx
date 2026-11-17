import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const band = (surface: 'desktop' | 'terminal', isWorking: boolean) =>
  ({
    plugin: 'clawd-buddy',
    surface,
    component: 'AbovePrompt',
    props: {
      hasSurvey: false,
      isCollapsed: false,
      isWorking,
      maxRows: 12,
      bodyColumns: 80,
      scroll: { offset: 0, bodyRows: 12 },
      view: {},
    },
  }) as const

const engine = (on: On) => {
  const clock = mock.clock(on)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  return clock
}

test('Clawd lives in the band: dozing, then pacing once a turn starts', async ($, on) => {
  const clock = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const resting = await $.ui.mount(band('desktop', false))
  expect((await resting.find({ type: 'Svg' }))?.props.alt).toBe('Clawd dozes')
  await resting.unmount()

  await $.turn.start({ text: 'go', turnId: 't1' })
  // Clawd first gets up from its doze, then starts to pace.
  await clock.advance(1000)

  const working = await $.ui.mount(band('desktop', true))
  expect((await working.find({ type: 'Svg' }))?.props.alt).toBe('Clawd paces back and forth, thinking')
  await working.unmount()
})

test('the terminal band is left alone', async ($, on) => {
  engine(on)

  const ui = await $.ui.mount(band('terminal', false))

  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.unmount()
})

// Pinned at the band's left beside another plugin's row, Clawd still turns
// round as it paces: the turned frame must sit right where the unturned one did.
test('Clawd turns round in place', async ($, on) => {
  const clock = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'go', turnId: 't1' })

  const shared = {
    ...band('desktop', true),
    component: 'AbovePromptList',
    props: { ...band('desktop', true).props, rows: [{ plugin: 'other', key: 'row' }] },
  } as const
  const span = (source: string) => {
    const xs = [...source.matchAll(/<rect x="(\d+)" y="\d+" width="(\d+)"/g)].flatMap(([, x, w]) => [
      Number(x),
      Number(x) + Number(w),
    ])
    const mirror = source.match(/translate\((\d+(?:\.\d+)?) 0\) scale\(-1 1\)/)
    const [left, right] = [Math.min(...xs), Math.max(...xs)]

    return mirror === null ? [left, right] : [Number(mirror[1]) - right, Number(mirror[1]) - left]
  }

  const left = new Set<string>()
  const right = new Set<string>()
  for (let i = 0; i < 400; i += 1) {
    await clock.advance(100)
    const ui = await $.ui.mount(shared)
    const source = (await ui.find({ type: 'Svg' }))?.props.source as string
    await ui.unmount()

    ;(source.includes('scale(-1 1)') ? left : right).add(span(source).join(' '))
  }

  expect(left.size).toBeGreaterThan(0)
  expect([...left].filter(s => !right.has(s))).toEqual([])
})
