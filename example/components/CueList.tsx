import type { SoundName } from "cuelume-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SOUND_CHARACTER, SOUND_COLORS } from "../lib/soundMeta";
import { fonts, theme } from "../lib/theme";
import { VerifiedShine } from "./micro-interactions/verified-shine";

const SHINE_SIZE = 20;

type CueListProps = {
  sounds: readonly SoundName[];
  selected: SoundName;
  onSelect: (name: SoundName) => void;
};

/** Rows only — the caller (currently `CueSheet`) provides the surrounding chrome and scroll container. */
export function CueList({ sounds, selected, onSelect }: CueListProps) {
  return (
    <>
      {sounds.map((name) => {
        const isSelected = name === selected;
        return (
          <Pressable
            key={name}
            style={styles.row}
            onPress={() => onSelect(name)}
          >
            <View
              style={[styles.dot, { backgroundColor: SOUND_COLORS[name] }]}
            />
            <View style={styles.textGroup}>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.character}>{SOUND_CHARACTER[name]}</Text>
            </View>
            {isSelected && (
              <VerifiedShine
                size={SHINE_SIZE}
                color={theme.success}
                label="Selected"
              />
            )}
          </Pressable>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  textGroup: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: fonts.displaySemiBold,
    fontSize: 16,
    color: theme.text,
    textTransform: "capitalize",
  },
  character: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: theme.textSecondary,
  },
});
