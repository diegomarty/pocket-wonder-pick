/**
 * Reading a Wonder Pick from a screenshot: where the five cards are, and a small
 * fingerprint of each card's artwork to compare against the pack's cards.
 *
 * Framework-free and DOM-free: it works on raw RGBA pixels, so the tests can feed it
 * decoded screenshots and the page feeds it a canvas.
 *
 * Finding the cards: the game draws them on a pale, nearly grey background. Pixels
 * that are pale and unsaturated are background; the rest form blobs, and a card is a
 * blob shaped like a card (63 × 88). The five of a Wonder Pick sit three over two, the
 * two below centred between the three above, so a row of three and a row of two of the
 * same size, one under the other, make a board. A screenshot of the list of picks can
 * hold several boards; they come back top to bottom.
 */

export interface Pixels {
  width: number;
  height: number;
  /** RGBA, row by row, as `ImageData.data`. */
  data: Uint8ClampedArray | Uint8Array;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Card width over height. */
const CARD_RATIO = 63 / 88;

/** Width the screenshot is scaled to for finding the cards. */
const WORK_W = 360;

interface Gray {
  w: number;
  h: number;
  scale: number;
  fg: Uint8Array;
}

/** Scales down by averaging whole blocks and marks what is not background. */
function foreground(px: Pixels): Gray {
  const scale = WORK_W / px.width;
  const w = WORK_W;
  const h = Math.max(1, Math.round(px.height * scale));
  const fg = new Uint8Array(w * h);
  const step = px.width / w;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * step);
    const y1 = Math.max(y0 + 1, Math.min(px.height, Math.floor((y + 1) * step)));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * step);
      const x1 = Math.max(x0 + 1, Math.min(px.width, Math.floor((x + 1) * step)));
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let yy = y0; yy < y1; yy++) {
        let i = (yy * px.width + x0) * 4;
        for (let xx = x0; xx < x1; xx++, i += 4) {
          r += px.data[i]!;
          g += px.data[i + 1]!;
          b += px.data[i + 2]!;
          n++;
        }
      }
      r /= n;
      g /= n;
      b /= n;
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      const lum = (r + g + b) / 3;
      const pale = (mx - mn < 30 && lum > 165) || (mx - mn < 60 && lum > 190);
      fg[y * w + x] = pale ? 0 : 1;
    }
  }
  return { w, h, scale, fg: open(fg, w, h) };
}

/** Erode then dilate by one pixel: cuts the thin bridges between neighbouring blobs. */
function open(m: Uint8Array, w: number, h: number): Uint8Array {
  const pass = (src: Uint8Array, keep: (all: boolean, any: boolean) => boolean) => {
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let all = true,
          any = false;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx,
              yy = y + dy;
            const v = xx >= 0 && yy >= 0 && xx < w && yy < h ? src[yy * w + xx]! : 0;
            if (v) any = true;
            else all = false;
          }
        out[y * w + x] = keep(all, any) ? 1 : 0;
      }
    return out;
  };
  return pass(
    pass(m, (all) => all),
    (_, any) => any,
  );
}

/** Bounding boxes of the 4-connected blobs, with how full each box is. */
function blobs(g: Gray): (Box & { fill: number })[] {
  const { w, h, fg } = g;
  const seen = new Uint8Array(w * h);
  const out: (Box & { fill: number })[] = [];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!fg[start] || seen[start]) continue;
    let x0 = w,
      y0 = h,
      x1 = 0,
      y1 = 0,
      n = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w,
        y = (i - x) / w;
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && fg[j] && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    const bw = x1 - x0 + 1,
      bh = y1 - y0 + 1;
    out.push({ x: x0, y: y0, w: bw, h: bh, fill: n / (bw * bh) });
  }
  return out;
}

/** Every card-shaped blob, in screenshot pixels. Exported for the tests. */
export function cardBoxes(px: Pixels): Box[] {
  const g = foreground(px);
  const min = WORK_W * 0.12;
  return blobs(g)
    .filter((b) => b.w >= min && b.w <= WORK_W * 0.5)
    .filter((b) => Math.abs(b.w / b.h / CARD_RATIO - 1) < 0.12 && b.fill > 0.75)
    .map((b) => ({ x: b.x / g.scale, y: b.y / g.scale, w: b.w / g.scale, h: b.h / g.scale }));
}

const cx = (b: Box) => b.x + b.w / 2;
const cy = (b: Box) => b.y + b.h / 2;
const median = (a: number[]) => a.slice().sort((x, y) => x - y)[a.length >> 1]!;

/**
 * The boards on a screenshot, top to bottom: five boxes each, in the game's slot order
 * (three on top, left to right, then two below). Every box of a board has the board's
 * card size, centred where the card was found, since overlays and holo glare make the
 * blob of a single card a little larger or smaller than the card.
 *
 * One card per board may be missing from the blobs (a pale Colorless card can melt into
 * the background); its place follows from the other four.
 */
export function findBoards(px: Pixels): Box[][] {
  return boardsFrom(cardBoxes(px));
}

/** The grouping half of `findBoards`, on boxes already found. Exported for the tests. */
export function boardsFrom(found: Box[]): Box[][] {
  const boxes = found.slice().sort((a, b) => cy(a) - cy(b) || cx(a) - cx(b));
  // Rows: cards of about the same size whose centres line up.
  const rows: Box[][] = [];
  for (const b of boxes) {
    const row = rows.find((r) => Math.abs(cy(r[0]!) - cy(b)) < r[0]!.h * 0.25 && Math.abs(r[0]!.w / b.w - 1) < 0.2);
    if (row) row.push(b);
    else rows.push([b]);
  }
  rows.forEach((r) => r.sort((a, b) => cx(a) - cx(b)));

  const boards: Box[][] = [];
  const used = new Set<Box[]>();
  for (let i = 0; i < rows.length; i++) {
    const top = rows[i]!;
    if (used.has(top) || top.length < 2 || top.length > 3) continue;
    const w = median(top.map((b) => b.w));
    const h = median(top.map((b) => b.h));
    // The row below: one or two cards, a card height or so lower.
    const bottom = rows.find(
      (r, j) =>
        j > i &&
        !used.has(r) &&
        r.length <= 2 &&
        cy(r[0]!) - cy(top[0]!) > h * 0.95 &&
        cy(r[0]!) - cy(top[0]!) < h * 1.4 &&
        Math.abs(r[0]!.w / w - 1) < 0.2,
    );
    if (!bottom || top.length + bottom.length < 4) continue;
    const centres = layout(top.map(cx), bottom.map(cx), w, median(top.map(cy)), median(bottom.map(cy)));
    if (!centres) continue;
    used.add(top);
    used.add(bottom);
    boards.push(centres.map(([x, y]) => ({ x: x - w / 2, y: y - h / 2, w, h })));
  }
  return boards;
}

/**
 * Centres of the five slots from the centres found in each row, or null when they do
 * not make a 3 + 2 board. With all three on top, the gap between them gives the bottom
 * places; with both below, their gap gives the top ones.
 */
function layout(top: number[], bottom: number[], w: number, ty: number, by: number): [number, number][] | null {
  const near = (a: number, b: number) => Math.abs(a - b) < w * 0.2;
  let t: number[];
  if (top.length === 3) {
    const d = (top[2]! - top[0]!) / 2;
    if (d < w * 0.9 || d > w * 1.5 || !near(top[1]! - top[0]!, d)) return null;
    t = top;
  } else if (bottom.length === 2) {
    const d = bottom[1]! - bottom[0]!;
    if (d < w * 0.9 || d > w * 1.5) return null;
    t = [bottom[0]! - d / 2, bottom[0]! + d / 2, bottom[1]! + d / 2];
    // The two found on top must sit on two of those three places.
    if (!top.every((x) => t.some((y) => near(x, y)))) return null;
    t = t.map((y) => top.find((x) => near(x, y)) ?? y);
  } else return null;
  const d = (t[2]! - t[0]!) / 2;
  const b = [t[0]! + d / 2, t[1]! + d / 2];
  if (!bottom.every((x) => b.some((y) => near(x, y)))) return null;
  const bx = b.map((y) => bottom.find((x) => near(x, y)) ?? y);
  return [...t.map((x): [number, number] => [x, ty]), ...bx.map((x): [number, number] => [x, by])];
}

/** The artwork window of a regular card, as fractions of the card. Full-art cards are art there too. */
const ART = { x0: 0.08, x1: 0.92, y0: 0.1, y1: 0.47 };
const GX = 12;
const GY = 7;
export const SIG_LEN = GX * GY * 3;

/**
 * A card's fingerprint: the mean colour of each cell of a grid over its artwork, centred
 * and scaled per channel so a brighter or duller screenshot still compares the same.
 */
export function signature(px: Pixels, box: Box): Float32Array {
  const out = new Float32Array(SIG_LEN);
  const ax = box.x + box.w * ART.x0;
  const ay = box.y + box.h * ART.y0;
  const cw = (box.w * (ART.x1 - ART.x0)) / GX;
  const ch = (box.h * (ART.y1 - ART.y0)) / GY;
  for (let gy = 0; gy < GY; gy++)
    for (let gx = 0; gx < GX; gx++) {
      const x0 = Math.max(0, Math.round(ax + gx * cw));
      const x1 = Math.min(px.width, Math.max(x0 + 1, Math.round(ax + (gx + 1) * cw)));
      const y0 = Math.max(0, Math.round(ay + gy * ch));
      const y1 = Math.min(px.height, Math.max(y0 + 1, Math.round(ay + (gy + 1) * ch)));
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let y = y0; y < y1; y++) {
        let i = (y * px.width + x0) * 4;
        for (let x = x0; x < x1; x++, i += 4) {
          r += px.data[i]!;
          g += px.data[i + 1]!;
          b += px.data[i + 2]!;
          n++;
        }
      }
      const k = (gy * GX + gx) * 3;
      out[k] = r / Math.max(1, n);
      out[k + 1] = g / Math.max(1, n);
      out[k + 2] = b / Math.max(1, n);
    }
  for (let c = 0; c < 3; c++) {
    let m = 0;
    for (let k = c; k < SIG_LEN; k += 3) m += out[k]!;
    m /= SIG_LEN / 3;
    let v = 0;
    for (let k = c; k < SIG_LEN; k += 3) v += (out[k]! - m) ** 2;
    const sd = Math.sqrt(v / (SIG_LEN / 3)) || 1;
    for (let k = c; k < SIG_LEN; k += 3) out[k] = (out[k]! - m) / sd;
  }
  return out;
}

/** Correlation of two fingerprints: 1 is identical, around 0 is unrelated. */
export function similarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0;
  for (let k = 0; k < SIG_LEN; k++) s += a[k]! * b[k]!;
  return s / SIG_LEN;
}

/**
 * The fingerprints of a card found on the screenshot, nudged a little in position and
 * size: the box found is only roughly the card's edge (overlays, holo glare).
 */
export function signatures(px: Pixels, box: Box): Float32Array[] {
  const out: Float32Array[] = [];
  for (const s of [0.96, 1, 1.04])
    for (const dx of [-0.03, 0, 0.03])
      for (const dy of [-0.03, 0, 0.03]) {
        const w = box.w * s,
          h = box.h * s;
        out.push(
          signature(px, {
            x: box.x + (box.w - w) / 2 + dx * box.w,
            y: box.y + (box.h - h) / 2 + dy * box.h,
            w,
            h,
          }),
        );
      }
  return out;
}

/** How well a found card matches a known fingerprint: the best of its nudged versions. */
export function bestSimilarity(found: Float32Array[], known: ArrayLike<number>): number {
  let best = -1;
  for (const f of found) best = Math.max(best, similarity(f, known));
  return best;
}

/** Hue (0–1), saturation and value of a colour. */
function hsv(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    d = mx - mn;
  let hh = 0;
  if (d) {
    hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hh /= 6;
    if (hh < 0) hh += 1;
  }
  return [hh, mx ? d / mx : 0, mx / 255];
}

/** Calls `fn` with the colour of a grid of points over a box (clipped to the picture). */
function sample(
  px: Pixels,
  b: Box,
  cols: number,
  rows: number,
  fn: (r: number, g: number, bl: number) => void,
): number {
  let n = 0;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const x = Math.floor(b.x + ((i + 0.5) * b.w) / cols);
      const y = Math.floor(b.y + ((j + 0.5) * b.h) / rows);
      if (x < 0 || y < 0 || x >= px.width || y >= px.height) continue;
      const k = (y * px.width + x) * 4;
      fn(px.data[k]!, px.data[k + 1]!, px.data[k + 2]!);
      n++;
    }
  return n;
}

/**
 * How much of the teal "GET" mark sits on top of a card (0–1). On the result screen
 * the game puts it over the card the player got; above 0.15 it is there. Thresholds
 * from the Japanese tool, measured on real screenshots.
 */
export function getMark(px: Pixels, box: Box): number {
  let teal = 0;
  const n = sample(px, { x: box.x, y: box.y - box.h * 0.1, w: box.w, h: box.h * 0.18 }, 60, 18, (r, g, b) => {
    const [hh, s, v] = hsv(r, g, b);
    if (hh > 0.42 && hh < 0.54 && s > 0.38 && v > 0.5) teal++;
  });
  return n ? teal / n : 0;
}
export const GET_MIN = 0.15;

/**
 * An hourglass in place of a card: orange is a Wonder Hourglass, blue-purple a Pack
 * Hourglass (it has a yellow Pikachu on top, so three tenths purple is enough).
 * Null when the slot is not mostly one of those colours.
 */
export function hourglass(px: Pixels, box: Box): "wonder" | "pack" | null {
  let orange = 0,
    purple = 0;
  const n = sample(px, box, 30, 34, (r, g, b) => {
    const [hh, s, v] = hsv(r, g, b);
    if (s < 0.3 || v < 0.35) return;
    if (hh >= 0.02 && hh < 0.16) orange++;
    else if (hh >= 0.55 && hh < 0.9) purple++;
  });
  const coloured = orange + purple;
  if (!n || coloured < n * 0.25) return null;
  return purple / coloured >= 0.3 ? "pack" : "wonder";
}
