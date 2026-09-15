import { Ionicons } from "@expo/vector-icons";
import {
  getSoundWaveform,
  play,
  sounds,
  type SoundName,
  type SoundWaveform,
} from "cuelume-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Easing,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { SOUND_HAPTICS } from "../lib/haptics";
import { SOUND_CHARACTER, SOUND_COLORS } from "../lib/soundMeta";
import { fonts, theme } from "../lib/theme";
import { Waveform } from "./Waveform";
import { useCallback, useEffect, useRef, useState } from "react";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { CueSheet } from "./CueSheet";

/** The hero "player" — selected sound's waveform, name, and duration, with buttons to replay it or pick another. */
export function SoundPreviewPlayer() {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [selected, setSelected] = useState<SoundName>("chime");
  const [waveforms, setWaveforms] = useState<
    Partial<Record<SoundName, SoundWaveform>>
  >({});
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progress = useSharedValue(0);

  const color = SOUND_COLORS[selected];
  const waveform = waveforms[selected];

  const handlePreview = useCallback(
    (name: SoundName) => {
      setSelected(name);

      const waveform = waveforms[name];
      const durationMs = waveform ? Math.max(waveform.duration * 1000, 1) : 300;
      progress.value = 0;
      if (waveform) {
        progress.value = withTiming(1, {
          duration: durationMs,
          easing: Easing.linear,
        });
      }

      play(name);
      SOUND_HAPTICS[name]();

      if (playTimeout.current) clearTimeout(playTimeout.current);
      setIsPlaying(true);
      playTimeout.current = setTimeout(() => setIsPlaying(false), durationMs);
    },
    [progress, waveforms],
  );

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      sounds.map(async (name) => [name, await getSoundWaveform(name)] as const),
    ).then((entries) => {
      if (cancelled) return;
      setWaveforms(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (playTimeout.current) clearTimeout(playTimeout.current);
    };
  }, []);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          style={styles.titleGroup}
          onPress={() => sheetRef.current?.present()}
          hitSlop={8}
        >
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={styles.name}>{selected}</Text>
          <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
        </Pressable>
        <Text style={styles.duration}>
          {waveform ? `${waveform.duration.toFixed(2)} s` : "…"}
        </Text>
      </View>

      <Text style={styles.character}>{SOUND_CHARACTER[selected]}</Text>

      <View style={styles.waveformWrapper}>
        {waveform ? (
          <Waveform
            peaks={waveform.peaks}
            color={color}
            mutedColor={theme.border}
            gridColor={theme.grid}
            progress={progress}
          />
        ) : (
          <View style={styles.waveformPlaceholder} />
        )}
      </View>

      <Pressable
        style={[
          styles.playButton,
          { backgroundColor: color },
          (!waveform || isPlaying) && styles.playButtonDisabled,
        ]}
        onPress={() => handlePreview(selected)}
        disabled={!waveform || isPlaying}
      >
        <Ionicons
          name="play"
          size={20}
          color="#fff"
          style={[styles.playIcon, { textShadowColor: color }]}
        />
      </Pressable>

      <CueSheet
        outerRef={sheetRef}
        sounds={sounds}
        selected={selected}
        onSelect={handlePreview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.panelAlt,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: theme.border,
    padding: 16,
    gap: 10,
    boxShadow: [
      {
        offsetX: 4,
        offsetY: 4,
        blurRadius: 9,
        color: "rgba(40, 33, 28, 0.1)",
      },
    ],
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  name: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 20,
    color: theme.text,
    textTransform: "capitalize",
  },
  duration: {
    fontSize: 13,
    color: theme.textSecondary,
    fontFamily: fonts.mono,
  },
  character: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: theme.textSecondary,
  },
  waveformWrapper: {
    marginVertical: 4,
  },
  waveformPlaceholder: {
    height: 140,
    borderRadius: 8,
    backgroundColor: theme.panel,
  },
  playButton: {
    alignSelf: "flex-end",
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  playButtonDisabled: {
    opacity: 0.5,
  },
  playIcon: {
    marginLeft: 2,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
});
