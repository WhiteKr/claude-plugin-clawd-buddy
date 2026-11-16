import { expect, test } from 'claude-code/testing'

import { bashActivity } from '../hooks/register'

test('shell commands map to what Clawd acts out', async () => {
  expect(bashActivity('rg -n "Spinner" src')).toBe('searching')
  expect(bashActivity('cd /repo && git grep foo')).toBe('searching')
  expect(bashActivity('cat a.ts | head -20')).toBe('reading')
  expect(bashActivity("sed -n '1,40p' a.ts")).toBe('reading')
  expect(bashActivity("sed -i 's/a/b/' a.ts")).toBe('running')
  expect(bashActivity('LANG=C /usr/bin/grep -r x .')).toBe('searching')
  expect(bashActivity('npm test')).toBe('running')
  expect(bashActivity('tsc -p . && echo ok')).toBe('running')
})
