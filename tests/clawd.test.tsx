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
  on('turn.complete', (_, e) => ({ text: e.answer }))
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
  // Clawd first gets up from its doze and stretches, then starts to pace.
  await clock.advance(8000)

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

test('alone in the band, Clawd roams it: walks, stops to look around, and turns wherever it likes', async ($, on) => {
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
    places.push(Number(spacers[2]?.props.flexGrow ?? 0))
    pictures.add(String(svg?.props.source))
    await ui.unmount()
  }

  expect(places.every(at => at >= 0 && at <= 1)).toBe(true)
  // It roams freely: it doubles back away from the ends, not only at them.
  const moves = places.slice(1).map((at, i) => at - places[i]!).filter(d => d !== 0)
  const middleTurns = moves.filter((d, i) => i > 0 && Math.sign(d) !== Math.sign(moves[i - 1]!)).length
  expect(middleTurns).toBeGreaterThan(3)
  expect(Math.max(...places) - Math.min(...places)).toBeGreaterThan(0.3)
  // Some seconds it stood still to look around.
  expect(places.some((at, i) => i > 0 && at === places[i - 1])).toBe(true)
  expect(pictures.size).toBeGreaterThan(10)
})

const shownAlt = async ($: Parameters<Parameters<typeof test>[1]>[0]) => {
  const ui = await $.ui.mount(alone)
  const alt = (await ui.find({ type: 'Svg' }))?.props.alt
  await ui.unmount()
  return alt
}

const ended = (reason: 'answer' | 'aborted') =>
  ({ answer: '', durationMs: 1, isAborted: reason === 'aborted', turnId: 't1', reason }) as const

test('an answered turn ends in the crab dance, a look around, then a doze', async ($, on) => {
  const clock = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await clock.advance(10000)
  await $.turn.complete(ended('answer'))

  await clock.advance(3000)
  expect(await shownAlt($)).toContain('crab dance')
  await clock.advance(12000)
  expect(await shownAlt($)).toBe('Clawd dozes')
})

test('a turn cut short skips the dance: Clawd stops, looks around, then dozes', async ($, on) => {
  const clock = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await clock.advance(10000)
  await $.turn.complete(ended('aborted'))

  await clock.advance(2000)
  expect(await shownAlt($)).toBe('Clawd stops and looks around')
  await clock.advance(6000)
  expect(await shownAlt($)).toBe('Clawd dozes')
})

test('while a command runs, Clawd scuttles the band in the crab walk, faster than its thinking stroll', async ($, on) => {
  const clock = engine(on)
  let finish = () => {}
  on('tool.call', () => new Promise(resolve => (finish = () => resolve({ result: { stdout: '' } } as never))))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'go', turnId: 't1' })
  const call = $.tool.call({ tool: 'Bash', command: 'npm test' } as never)
  await clock.advance(10000)

  const places: number[] = []
  for (let second = 0; second < 60; second++) {
    await clock.advance(500)
    const ui = await $.ui.mount(alone)
    places.push(Number((await ui.findAll({ type: 'Box' }))[2]?.props.flexGrow ?? 0))
    expect((await ui.find({ type: 'Svg' }))?.props.alt).toContain('scuttles')
    await ui.unmount()
  }
  // It keeps moving, faster than the stroll's 0.01 of the band each half
  // second, and doubles back now and then wherever it is.
  const steps = places.slice(1).map((at, i) => Math.abs(at - places[i]!))
  expect(steps.filter(d => d > 0).length).toBeGreaterThan(steps.length * 0.7)
  expect(Math.max(...steps)).toBeGreaterThan(0.02)
  expect(Math.max(...places) - Math.min(...places)).toBeGreaterThan(0.1)

  finish()
  await call
})

test('beside other rows, Clawd still walks: along its own lane on the left', async ($, on) => {
  const clock = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await clock.advance(20000)

  const ui = await $.ui.mount({ ...alone, props: { ...alone.props, rows: [{ plugin: 'other', key: 'r', text: 'other row' }] } } as never)
  const boxes = await ui.findAll({ type: 'Box' })
  expect(boxes[1]?.props.width).toBe('30%')
  expect(boxes[2]?.props.flexGrow).toBeGreaterThan(0)
  await ui.unmount()
})
