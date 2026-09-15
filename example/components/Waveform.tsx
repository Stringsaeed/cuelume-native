/**
 * Draws a `SoundWaveform`'s peaks as a smooth oscilloscope-style trace, like
 * the one on cuelume.dev — one continuous line around a baseline, not
 * audio-editor-style min/max bars. A muted base trace shows the whole shape;
 * an accent-colored trace is trimmed by `progress` (a Reanimated shared
 * value driven from `withTiming`) to sweep across it as the sound plays.
 */

import { Canvas, Line, Path, Skia, type SkPath, vec } from "@shopify/react-native-skia";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";

const AMPLITUDE_RATIO = 0.82;
const BASE_STROKE_WIDTH = 2;
const PLAYED_STROKE_WIDTH = 2.5;
const DEFAULT_HEIGHT = 140;

type WaveformProps = {
  peaks: Float32Array;
  color: string;
  mutedColor: string;
  gridColor: string;
  progress: SharedValue<number>;
  height?: number;
};

/** A smooth line through `peaks`, via quadratic Beziers to each pair's midpoint. */
function buildPath(peaks: Float32Array, width: number, height: number): SkPath {
  const path = Skia.Path.Make();
  if (peaks.length === 0 || width === 0) return path;

  const baselineY = height / 2;
  const amplitude = (height / 2) * AMPLITUDE_RATIO;
  const stepX = peaks.length > 1 ? width / (peaks.length - 1) : 0;
  const pointX = (i: number) => i * stepX;
  const pointY = (i: number) => baselineY - peaks[i] * amplitude;

  path.moveTo(pointX(0), pointY(0));
  for (let i = 1; i < peaks.length; i++) {
    const midX = (pointX(i - 1) + pointX(i)) / 2;
    const midY = (pointY(i - 1) + pointY(i)) / 2;
    path.quadTo(pointX(i - 1), pointY(i - 1), midX, midY);
  }
  path.lineTo(pointX(peaks.length - 1), pointY(peaks.length - 1));

  return path;
}

export function Waveform({
  peaks,
  color,
  mutedColor,
  gridColor,
  progress,
  height = DEFAULT_HEIGHT,
}: WaveformProps) {
  const [width, setWidth] = useState(0);
  const path = useMemo(() => buildPath(peaks, width, height), [peaks, width, height]);
  const baselineY = height / 2;

  return (
    <View
      style={styles.container}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <Canvas style={{ width: "100%", height }}>
        {width > 0 && (
          <>
            <Line p1={vec(0, baselineY)} p2={vec(width, baselineY)} color={gridColor} strokeWidth={1} />
            <Path
              path={path}
              style="stroke"
              strokeWidth={BASE_STROKE_WIDTH}
              strokeJoin="round"
              strokeCap="round"
              color={mutedColor}
              start={0}
              end={1}
            />
            <Path
              path={path}
              style="stroke"
              strokeWidth={PLAYED_STROKE_WIDTH}
              strokeJoin="round"
              strokeCap="round"
              color={color}
              start={0}
              end={progress}
            />
          </>
        )}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
});
