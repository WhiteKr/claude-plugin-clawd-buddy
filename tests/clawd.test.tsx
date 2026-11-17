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

const alone = {
  plugin: 'clawd-buddy',
  surface: 'desktop',
  component: 'AbovePromptList',
  props: { hasSurvey: false, isCollapsed: false, isWorking: true, maxRows: 12, bodyColumns: 80, rows: [] },
} as const

test('alone in the band, Clawd patrols it: walks, stops to look around, and turns at the ends', async ($, on) => {
  const clock = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'go', turnId: 't1' })

  const places: number[] = []
  const pictures = new Set<string>()
  for (let second = 0; second < 240; second++) {
    await clock.advance(1000)
    const ui = await $.ui.mount(alone)
    const spacers = await ui.findAll({ type: 'Box' })
    const svg = await ui.find({ type: 'Svg' })
    places.push(Number(spacers[1]?.props.flexGrow ?? 0))
    pictures.add(String(svg?.props.source))
    await ui.unmount()
  }

  expect(places.every(at => at >= 0 && at <= 1)).toBe(true)
  // It got all the way across and back, so it turned at an end.
  expect(Math.max(...places)).toBe(1)
  expect(places.at(-1)).toBeLessThan(1)
  // Some seconds it stood still to look around.
  expect(places.some((at, i) => i > 0 && at === places[i - 1])).toBe(true)
  expect(pictures.size).toBeGreaterThan(10)
})
