/**
 * An original mark for this app — a small waveform squiggle on a tinted
 * tile, echoing the app's own oscilloscope preview rather than reusing
 * cuelume.dev's logo (that mark lives only on their website, outside the
 * MIT-licensed `cuelume` code repo this project ports from, so it isn't
 * clearly ours to reuse for a separately-published package).
 */

import { Canvas, LinearGradient, Path, RoundedRect, Skia, type SkPath, vec } from "@shopify/react-native-skia";
import { useMemo } from "react";

const VIEWBOX = 64;
const CORNER_RADIUS = 15;
const STROKE_WIDTH = 4.5;
const MARK_POINTS: [number, number][] = [
  [14, 32],
  [21, 22],
  [28, 40],
  [35, 18],
  [42, 37],
  [50, 32],
];

/** Same smoothing technique as `Waveform.tsx` — a quadratic Bezier through each pair's midpoint. */
function buildMarkPath(): SkPath {
  const path = Skia.Path.Make();
  path.moveTo(...MARK_POINTS[0]);
  for (let i = 1; i < MARK_POINTS.length; i++) {
    const [px, py] = MARK_POINTS[i - 1];
    const [x, y] = MARK_POINTS[i];
    path.quadTo(px, py, (px + x) / 2, (py + y) / 2);
  }
  path.lineTo(...MARK_POINTS[MARK_POINTS.length - 1]);
  return path;
}

type LogoProps = {
  size?: number;
};

export function Logo({ size = 32 }: LogoProps) {
  const path = useMemo(buildMarkPath, []);
  const scale = size / VIEWBOX;

  return (
    <Canvas style={{ width: size, height: size }}>
      <RoundedRect x={0} y={0} width={VIEWBOX} height={VIEWBOX} r={CORNER_RADIUS} transform={[{ scale }]}>
        <LinearGradient start={vec(0, 0)} end={vec(0, VIEWBOX)} colors={["#5B9BFF", "#2748C0"]} />
      </RoundedRect>
      <Path
        path={path}
        style="stroke"
        strokeWidth={STROKE_WIDTH}
        strokeJoin="round"
        strokeCap="round"
        color="#fbfaf9"
        transform={[{ scale }]}
      />
    </Canvas>
  );
}
