"""Draw every Clawd clip on one 50-unit pixel grid and write them as static
per-frame SVG data, for a mod that steps the frames itself.

The desktop strips CSS and SMIL animation from plugin SVG while it composites
in software, so each frame is drawn as still markup instead.

A clip is an intro (frames before loopFrom) that plays once, a loop (loopFrom
up to outroFrom), and an outro (outroFrom to the end) that plays on the way to
another clip, so every clip starts and ends in the same standing pose.

walk, laptop, snooze and stretch are pixel art in art/<clip>.txt: the clip's
loopFrom and outroFrom, the pose each frame shows, then the poses. read and
search are drawn below; they take a prop out with the laptop clip's pull-out
and put it away with its put-away, the laptop swapped for that prop.

usage: python3 -I draw_clips.py <out.ts> [--ascii <clip> <frame>]
"""
import json
import math
import os
import sys

COLS, ROWS = 37, 23
X0, Y0, CELL = 586, 701, 50
FPS = 12
COLOR = {'O': '#d97757', 'D': '#be694d', 'K': '#000000', 'G': '#8b8b8b', 'W': '#f3eee3'}


class Grid:
    def __init__(self):
        self.cells = {}

    def fill(self, x0, y0, x1, y1, c):
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                if 0 <= x < COLS and 0 <= y < ROWS:
                    self.cells[(x, y)] = c

    def clear(self, x0, y0, x1, y1):
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                self.cells.pop((x, y), None)

    def line(self, a, b, c, brush=2):
        (x0, y0), (x1, y1) = a, b
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(steps + 1):
            x = round(x0 + (x1 - x0) * i / steps)
            y = round(y0 + (y1 - y0) * i / steps)
            self.fill(x, y, x + brush - 1, y + brush - 1, c)

    def ascii(self):
        return '\n'.join(''.join(self.cells.get((x, y), '.') for x in range(COLS)) for y in range(ROWS))


ART = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'art')


def art(name):
    head, *blocks = open(os.path.join(ART, name + '.txt')).read().strip().split('\n\n')
    fields = dict(line.split(' ', 1) for line in head.split('\n'))
    poses = {}
    for block in blocks:
        title, *rows = block.split('\n')
        assert len(rows) == ROWS and all(len(r) == COLS for r in rows), (name, title)
        g = Grid()
        g.cells = {(x, y): c for y, row in enumerate(rows) for x, c in enumerate(row) if c != '.'}
        poses[title.split(' ')[1]] = g
    frames = [poses[p] for p in fields['frames'].split()]
    return frames, int(fields['loop']), int(fields['outro'])


def art_frames(name):
    frames = []
    for g in art(name)[0]:
        copy = Grid()
        copy.cells = dict(g.cells)
        frames.append(copy)
    return frames


def pull_out(prop, count=12):
    """The laptop clip's pull-out, with the gray laptop redrawn as another prop."""
    frames = []
    for g in art_frames('laptop')[:count]:
        gray = [cell for cell, c in g.cells.items() if c == 'G']
        for cell in gray:
            del g.cells[cell]
        if gray:
            prop(g, gray)
        frames.append(g)
    return frames


def held_book(g, gray):
    top = min(y for (x, y), c in g.cells.items() if c == 'O' and 23 <= x <= 26)
    g.fill(23, top - 5, 26, top - 1, 'D')
    g.fill(26, top - 4, 26, top - 2, 'W')


def magnifier(g, gray):
    claw = (24.5, 11)
    far = max(gray, key=lambda c: math.dist(c, claw))
    near = min(gray, key=lambda c: math.dist(c, claw))
    cx, cy = min(max(far[0], 2), COLS - 3), min(max(far[1], 2), ROWS - 3)
    dx, dy = near[0] - cx, near[1] - cy
    n = math.hypot(dx, dy) or 1
    g.line((round(cx + 2 * dx / n), round(cy + 2 * dy / n)), near, 'G')
    lens(g, cx, cy)


# Clawd's arms are rigid round claws: they move around the body whole, and
# turn dark where they cross in front of it, as in the original clips.
BODY = (7, 7, 22, 18)


def crab(g, right_claw=True):
    g.fill(7, 7, 22, 18, 'O')
    g.fill(3, 11, 6, 14, 'O')
    if right_claw:
        g.fill(23, 11, 26, 14, 'O')
    for x in (7, 11, 17, 21):
        g.fill(x, 19, x + 1, 22, 'O')


def eyes(g, look=0, shape='open'):
    for x in (9 + look, 19 + look):
        g.fill(x, 9 if shape == 'open' else 10, x + 1, 10, 'K')


def front_claw(g, x, y):
    cells = [(x + i, y + j) for i in range(4) for j in range(4)]
    x0, y0, x1, y1 = BODY
    over_body = any(g.cells.get((cx, cy)) == 'O' and x0 <= cx <= x1 and y0 <= cy <= y1 for cx, cy in cells)
    for cell in cells:
        g.cells[cell] = 'D' if over_body else 'O'


def standing():
    g = Grid()
    crab(g)
    eyes(g)
    return g


TEXT = {
    'a': [(15, [7, 8, 9, 10, 11, 12]), (16, [7, 8, 9, 10]), (17, [7, 8, 9, 10, 11]),
          (15, [17, 18, 19, 20, 21]), (16, [17, 18, 19, 20, 21, 22]), (17, [17, 18, 19])],
    'b': [(15, [7, 8, 9, 10, 11]), (16, [7, 8, 9, 10, 11, 12]), (17, [7, 8, 9]),
          (15, [17, 18, 19, 20, 21, 22]), (16, [17, 18, 19, 20]), (17, [17, 18, 19, 20, 21])],
}


def book(g, text, turning=None):
    g.fill(5, 14, 24, 18, 'D')
    g.fill(6, 14, 13, 17, 'W')
    g.fill(16, 14, 23, 17, 'W')
    g.fill(14, 14, 15, 18, 'G')
    for row, xs in TEXT[text]:
        for x in xs:
            if turning is None or x < 14 or turning == 'lift' and x >= 21:
                g.cells[(x, row)] = 'G'
    if turning == 'lift':
        g.clear(16, 14, 20, 17)
        g.fill(16, 14, 23, 17, 'W')
        g.fill(16, 12, 20, 16, 'W')
        g.fill(16, 17, 20, 17, 'D')
    elif turning == 'up':
        g.fill(16, 14, 23, 17, 'W')
        g.fill(14, 9, 15, 17, 'W')
    elif turning == 'over':
        g.fill(16, 14, 23, 17, 'W')
        g.fill(9, 12, 13, 16, 'W')
        g.fill(9, 17, 13, 17, 'D')


# Reading: a closed book comes out the way the laptop does, opens on its way
# into both claws, eyes run along the lines, and the right claw turns the page.

TURN_CLAW = {None: (23, 13), 'pinch': (21, 12), 'lift': (21, 11), 'up': (15, 8), 'over': (10, 10)}


def reading_frame(text, look, turning=None, eye='blink', claw=None, low=0):
    g = Grid()
    crab(g, right_claw=False)
    g.clear(3, 11, 6, 14)
    eyes(g, look, eye)
    page = Grid()
    book(page, text, turning)
    for (x, y), col in page.cells.items():
        if y + low < ROWS:
            g.cells[(x, y + low)] = col
    front_claw(g, 3, 13 + low)
    x, y = TURN_CLAW[claw or turning]
    front_claw(g, x, y + low)
    return g


def opening_book(stage):
    g = Grid()
    crab(g)
    eyes(g, 0, 'open')
    if stage == 0:
        g.fill(19, 11, 22, 15, 'D')
        g.fill(19, 12, 19, 14, 'W')
    else:
        g.fill(7, 12, 22, 15, 'D')
        g.fill(9, 12, 13, 14, 'W')
        g.fill(16, 12, 20, 14, 'W')
        g.fill(14, 12, 15, 15, 'G')
    return g


def put_away(prop, first):
    lifted = pull_out(prop)[9:12][::-1]
    return first + lifted + art_frames('laptop')[37:]


def reading():
    frames = pull_out(held_book)
    frames += [opening_book(0), opening_book(1), reading_frame('a', 0, eye='open', low=1)]
    loop_from = len(frames)
    for text, nxt in (('a', 'b'), ('b', 'a')):
        for look in (-1, -1, -1, -1, -1, -1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0):
            frames.append(reading_frame(text, look))
        if text == 'b':
            frames[-3] = reading_frame(text, 0, eye='open')
        frames += [reading_frame(text, 1, claw='pinch')]
        frames += [reading_frame(text, 1, 'lift')] * 2
        frames += [reading_frame(text, 0, 'up')] * 2
        frames += [reading_frame(nxt, -1, 'over')] * 2
        frames += [reading_frame(nxt, -1, claw='pinch')]
    outro_from = len(frames)
    frames += put_away(held_book, [opening_book(1), opening_book(0)])
    return frames, loop_from, outro_from


# Searching: a magnifying glass comes out the way the laptop does and goes up
# to one eye for a close, careful look.

def lens(g, cx, cy, magnified=False, blink=False, gaze=0):
    for x in range(cx - 2, cx + 3):
        for y in range(cy - 2, cy + 3):
            edge = abs(x - cx) == 2 or abs(y - cy) == 2
            corner = abs(x - cx) == 2 and abs(y - cy) == 2
            if edge and not corner:
                g.cells[(x, y)] = 'G'
    if magnified and blink:
        g.fill(cx - 1, cy - 1, cx + 1, cy + 1, 'O')
        g.fill(cx - 1, cy, cx + 1, cy, 'K')
    elif magnified:
        g.fill(cx - 1, cy - 1, cx + 1, cy + 1, 'K' if gaze == 0 else 'O')
        if gaze:
            g.fill(cx - 1 + max(gaze, 0), cy - 1, cx + max(gaze, 0), cy + 1, 'K')
    g.cells[(cx - 1, cy - 1)] = 'W'


def searching_frame(cx, cy, look, magnified=False, blink=False, claw=None):
    g = Grid()
    crab(g, right_claw=False)
    if magnified:
        eyes(g, look, 'blink' if blink else 'open')
        g.fill(19, 9, 20, 10, 'O')
    else:
        eyes(g, look, 'blink' if blink or cy >= 14 else 'open')
    hx, hy = claw or ((21, 13) if magnified else (23, max(9, min(12, cy + 3))))
    dx, dy = hx + 1 - cx, hy + 1 - cy
    n = math.hypot(dx, dy) or 1
    g.line((round(cx + 2 * dx / n), round(cy + 2 * dy / n)), (hx + 1, hy + 1), 'G')
    lens(g, cx, cy, magnified, blink, look if magnified else 0)
    front_claw(g, hx, hy)
    return g


# Peering: the glass held close to one eye, nudged side to side and in closer,
# the magnified eye looking where the glass goes.
PEER = [((20, 10, 0), 4, False), ((21, 10, 1), 3, False), ((20, 10, 0), 2, False), ((19, 10, -1), 3, False),
        ((20, 9, 0), 2, False), ((20, 9, 0), 1, True), ((20, 9, 0), 2, False), ((20, 10, 0), 3, False)]


def searching():
    frames = pull_out(magnifier)
    frames += [searching_frame(24, 7, 0)]
    loop_from = len(frames)
    for (cx, cy, look), hold, blink in PEER:
        frames += [searching_frame(cx, cy, look, magnified=True, blink=blink, claw=(cx + 1, cy + 3))] * hold
    outro_from = len(frames)
    frames += put_away(magnifier, [searching_frame(24, 7, 0)])
    return frames, loop_from, outro_from


# Each clip returns its frames, where its loop starts, and where its outro starts.
CLIPS = {name: (lambda name=name: art(name)) for name in ('walk', 'laptop', 'snooze', 'stretch')}
CLIPS.update({'read': reading, 'search': searching})


def runs(cells, color):
    out = []
    for y in range(ROWS):
        x = 0
        while x < COLS:
            if cells.get((x, y)) == color:
                start = x
                while x < COLS and cells.get((x, y)) == color:
                    x += 1
                out.append((start, y, x - start))
            else:
                x += 1
    return out


def compile_clip(frames):
    groups, index, out = [], {}, []
    for g in frames:
        used = []
        for color in 'ODGWK':
            rs = runs(g.cells, color)
            if not rs:
                continue
            rects = ''.join(
                f'<rect x="{X0 + x * CELL}" y="{Y0 + y * CELL}" width="{w * CELL}" height="{CELL}"/>' for x, y, w in rs)
            markup = f'<g fill="{COLOR[color]}">{rects}</g>'
            if markup not in index:
                index[markup] = len(groups)
                groups.append(markup)
            used.append(index[markup])
        out.append(used)
    return groups, out


if __name__ == '__main__':
    if '--ascii' in sys.argv:
        i = sys.argv.index('--ascii')
        print(CLIPS[sys.argv[i + 1]]()[0][int(sys.argv[i + 2])].ascii())
        sys.exit()
    entries, used = [], set()
    for name, make in CLIPS.items():
        made, loop_from, outro_from = make()
        groups, frames = compile_clip(made)
        used.update(cell for g in made for cell in g.cells)
        entries.append(f"  {name}: {{ loopFrom: {loop_from}, outroFrom: {outro_from}, frames: {json.dumps(frames, separators=(',', ':'))}, groups: {json.dumps(groups)} }},")
        print(name, len(frames), 'frames', len(groups), 'groups')
    left, top = min(x for x, _ in used), min(y for _, y in used)
    right, bottom = max(x for x, _ in used) + 1, max(y for _, y in used) + 1
    lines = [
        "// Generated by tools/draw_clips.py. Do not edit.",
        f"export type ClawdClip = {' | '.join(repr(n) for n in CLIPS)}",
        '',
        f'export const FPS = {FPS}',
        '',
        f'export const CLIP_BOX = {{ x: {X0 + left * CELL}, y: {Y0 + top * CELL}, width: {(right - left) * CELL}, height: {(bottom - top) * CELL} }} as const',
        '',
        'export const CLIPS: Record<ClawdClip, { loopFrom: number; outroFrom: number; groups: string[]; frames: number[][] }> = {',
        *entries,
        '}',
    ]
    open(sys.argv[1], 'w').write('\n'.join(lines) + '\n')
