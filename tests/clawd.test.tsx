import type { On, RenderElement } from 'claude-code'
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

const list = (rows: { plugin: string; tree: RenderElement }[] = []) =>
  ({
    ...band('desktop', false),
    component: 'AbovePromptList',
    props: { ...band('desktop', false).props, rows },
  }) as const

test('the person can pick Clawd up and carry it along the band', async ($, on) => {
  const clock = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount(list())
  await ui.resize({ columns: 8, rows: 3, in: 'grab' })
  const svg = async () => (await ui.find({ type: 'Svg' }))?.props
  // The spacer left of Clawd grows by the share of the room it stands at.
  const at = async () => (await ui.findAll({ type: 'Box' })).find(b => typeof b.props.flexGrow === 'number')?.props.flexGrow

  expect(await ui.find({ type: 'Client', key: 'track' })).toBeUndefined()
  await ui.pointer({ type: 'down', x: 4, y: 1, button: 'left', in: 'grab' })
  expect((await svg())?.alt).toBe('Clawd is held up, kicking and struggling')

  // Held, a region over the whole band follows the pointer, wherever it goes.
  await ui.resize({ columns: 80, rows: 3, in: 'track' })
  // The band is 80 cells and Clawd 8, so 36 cells to the right is half the room.
  await ui.pointer({ type: 'move', x: 40, y: 1, button: 'left', in: 'track' })
  await clock.advance(500)
  expect((await svg())?.alt).toBe('Clawd is held up, kicking and struggling')
  expect(await at()).toBe(0.5)

  await ui.pointer({ type: 'up', x: 40, y: 1, button: 'left', in: 'track' })
  expect((await svg())?.alt).toBe('Clawd dozes')
  expect(await at()).toBe(0.5)
  expect(await ui.find({ type: 'Client', key: 'track' })).toBeUndefined()

  // It never leaves the band, however far the pointer goes.
  await ui.pointer({ type: 'down', x: 4, y: 1, button: 'left', in: 'grab' })
  await ui.resize({ columns: 80, rows: 3, in: 'track' })
  await ui.pointer({ type: 'move', x: 500, y: 1, button: 'left', in: 'track' })
  await ui.pointer({ type: 'up', x: 500, y: 1, button: 'left', in: 'track' })
  expect(await at()).toBe(1)
  await ui.unmount()
})

test('the pointer leaving the band sets Clawd down', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount(list())
  await ui.resize({ columns: 8, rows: 3, in: 'grab' })
  await ui.pointer({ type: 'down', x: 4, y: 1, button: 'left', in: 'grab' })
  await ui.resize({ columns: 80, rows: 3, in: 'track' })
  await ui.pointer({ type: 'move', x: 22, y: 1, button: 'left', in: 'track' })
  await ui.pointer({ type: 'leave', x: 22, y: 1, in: 'track' })
  expect((await ui.find({ type: 'Svg' }))?.props.alt).toBe('Clawd dozes')
  expect((await ui.findAll({ type: 'Box' })).find(b => typeof b.props.flexGrow === 'number')?.props.flexGrow).toBe(0.25)
  await ui.unmount()
})

test('beside other rows Clawd only struggles where it stands', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount(list([{ plugin: 'other', tree: { type: 'Text', props: {}, children: ['hi'] } }]))
  await ui.resize({ columns: 8, rows: 3, in: 'grab' })

  await ui.pointer({ type: 'down', x: 4, y: 1, button: 'left', in: 'grab' })
  await ui.resize({ columns: 80, rows: 3, in: 'track' })
  await ui.pointer({ type: 'move', x: 40, y: 1, button: 'left', in: 'track' })
  expect((await ui.find({ type: 'Svg' }))?.props.alt).toBe('Clawd is held up, kicking and struggling')
  await ui.pointer({ type: 'up', x: 40, y: 1, button: 'left', in: 'track' })
  expect((await ui.find({ type: 'Svg' }))?.props.alt).toBe('Clawd dozes')
  await ui.unmount()
})
