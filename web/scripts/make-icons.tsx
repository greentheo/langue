/**
 * Draw the app icons: a phosphor-green "L" with an amber cursor on the dark
 * screen colour, made of plain rectangles so it needs no font.
 *
 *   npx tsx scripts/make-icons.tsx
 *
 * Writes the install icons the manifest points at (public/icons), the
 * home-screen icon iOS uses (src/app/apple-icon.png) and the browser-tab icon
 * (src/app/icon.png). Run it again only to change the design.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ImageResponse } from "next/og";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "..");

const SCREEN = "#0a0e0a";
const PHOSPHOR = "#33ff66";
const AMBER = "#ffb000";

/**
 * `inset` shrinks the drawing toward the centre: maskable icons must keep
 * everything inside the middle 80%, because launchers crop them to a circle
 * or a squircle.
 */
function icon(size: number, inset = 1) {
  const unit = (fraction: number) => Math.round(size * (0.5 + (fraction - 0.5) * inset));
  const box = (left: number, top: number, right: number, bottom: number, color: string, glow: boolean) => ({
    position: "absolute" as const,
    left: unit(left),
    top: unit(top),
    width: unit(right) - unit(left),
    height: unit(bottom) - unit(top),
    background: color,
    boxShadow: glow ? `0 0 ${Math.max(2, Math.round(size * 0.05))}px ${color}` : undefined,
  });

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: size, height: size, background: SCREEN, position: "relative" }}>
        {/* The L: a stem and a foot. */}
        <div style={box(0.27, 0.22, 0.4, 0.74, PHOSPHOR, true)} />
        <div style={box(0.27, 0.61, 0.6, 0.74, PHOSPHOR, true)} />
        {/* The cursor, waiting for the next letter. */}
        <div style={box(0.65, 0.68, 0.82, 0.74, AMBER, true)} />
      </div>
    ),
    { width: size, height: size },
  );
}

async function write(path: string, response: ImageResponse) {
  const target = join(WEB, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  console.log(`wrote ${path}`);
}

async function main() {
  await write("public/icons/icon-192.png", icon(192));
  await write("public/icons/icon-512.png", icon(512));
  await write("public/icons/icon-maskable-512.png", icon(512, 0.8));
  await write("src/app/apple-icon.png", icon(180));
  await write("src/app/icon.png", icon(64));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
