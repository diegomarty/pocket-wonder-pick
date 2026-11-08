/**
 * Screenshot reading on the page: choosing the picture, turning it into pixels, and
 * loading the card fingerprints the first time they are needed (about 1 MB, then
 * cached by the browser). The reading itself is in `domain/screenshot` and
 * `domain/read-shot`; nothing leaves the device.
 */

import { parseSigs, readBoard, type KnownSig, type ShotRead } from "../domain/read-shot";
import { findBoards, type Pixels } from "../domain/screenshot";

/** Wider pictures are scaled down first: plenty to find and compare cards, and light on memory. */
const MAX_W = 1080;

let sigs: Promise<KnownSig[]> | null = null;

export function loadSigs(): Promise<KnownSig[]> {
  sigs ??= fetch(`${import.meta.env.BASE_URL}card-sigs.bin`)
    .then((r) => {
      if (!r.ok) throw new Error("card-sigs.bin: " + r.status);
      return r.arrayBuffer();
    })
    .then(parseSigs)
    .catch((e) => {
      sigs = null;
      throw e;
    });
  return sigs;
}

/** Opens the photo picker (on a phone, the gallery); null when nothing was chosen. */
export function chooseImage(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}

async function pixels(file: Blob): Promise<Pixels> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_W / img.naturalWidth);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, w, h);
    return { width: w, height: h, data: ctx.getImageData(0, 0, w, h).data };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Every board on the picture, read against `known` (all cards by default). `mixed`
 * reads each card from any pack instead of choosing one pack for the five.
 */
export async function readShot(file: Blob, opts: { mixed?: boolean; known?: KnownSig[] } = {}): Promise<ShotRead[]> {
  const [px, all] = await Promise.all([pixels(file), opts.known ? Promise.resolve(opts.known) : loadSigs()]);
  // Let the "reading" state paint before the comparing, which takes a moment.
  await new Promise((r) => setTimeout(r, 30));
  return findBoards(px).map((b) => readBoard(px, b, all, opts.mixed));
}
