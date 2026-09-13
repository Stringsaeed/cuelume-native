import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { play, setEnabled, setVolume, sounds, useCuelumeSound, type SoundName } from "cuelume-native";

const VOLUME_STEPS = [0.25, 0.5, 0.75, 1] as const;

function SoundButton({ name }: { name: SoundName }) {
  return (
    <Pressable style={styles.soundButton} onPress={() => play(name)}>
      <Text style={styles.soundButtonLabel}>{name}</Text>
    </Pressable>
  );
}

/** Wired through the hook instead of calling `play()` directly — this is what `bind()` covered on the web. */
function SaveButton() {
  const sound = useCuelumeSound({ toggle: "success" });
  return (
    <Pressable style={[styles.actionButton, styles.saveButton]} {...sound}>
      <Text style={styles.actionButtonLabel}>Save</Text>
    </Pressable>
  );
}

function DeleteButton() {
  const sound = useCuelumeSound({ toggle: "error" });
  return (
    <Pressable style={[styles.actionButton, styles.deleteButton]} {...sound}>
      <Text style={styles.actionButtonLabel}>Delete</Text>
    </Pressable>
  );
}

export default function App() {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [volume, setVolumeState] = useState<(typeof VOLUME_STEPS)[number]>(1);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Cuelume Native</Text>
        <Text style={styles.subtitle}>
          Seventeen interaction sounds, synthesized live via react-native-audio-api.
        </Text>

        <Text style={styles.sectionTitle}>useCuelumeSound()</Text>
        <View style={styles.row}>
          <SaveButton />
          <DeleteButton />
        </View>

        <Text style={styles.sectionTitle}>play(name)</Text>
        <View style={styles.grid}>
          {sounds.map((name) => (
            <SoundButton key={name} name={name} />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.row}>
          <Text style={styles.preferenceLabel}>Enabled</Text>
          <Switch
            value={audioEnabled}
            onValueChange={(value) => {
              setAudioEnabled(value);
              setEnabled(value);
            }}
          />
        </View>
        <View style={styles.row}>
          {VOLUME_STEPS.map((step) => (
            <Pressable
              key={step}
              style={[styles.volumeButton, volume === step && styles.volumeButtonActive]}
              onPress={() => {
                setVolumeState(step);
                setVolume(step);
                play("tick");
              }}
            >
              <Text style={styles.volumeButtonLabel}>{Math.round(step * 100)}%</Text>
            </Pressable>
          ))}
        </View>

        <StatusBar style="auto" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0b0b10",
  },
  container: {
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
  },
  subtitle: {
    fontSize: 14,
    color: "#9a9aa6",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#6d6d78",
    marginTop: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  soundButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#1c1c24",
    borderWidth: 1,
    borderColor: "#2c2c36",
  },
  soundButtonLabel: {
    color: "#e5e5ea",
    fontSize: 14,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveButton: {
    backgroundColor: "#2e6cf6",
  },
  deleteButton: {
    backgroundColor: "#f6462e",
  },
  actionButtonLabel: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  preferenceLabel: {
    color: "#e5e5ea",
    fontSize: 15,
    flex: 1,
  },
  volumeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#1c1c24",
    borderWidth: 1,
    borderColor: "#2c2c36",
  },
  volumeButtonActive: {
    borderColor: "#2e6cf6",
  },
  volumeButtonLabel: {
    color: "#e5e5ea",
    fontSize: 13,
  },
});
