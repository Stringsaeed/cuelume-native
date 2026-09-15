import { useState } from "react";
import {
  DynaPuff_600SemiBold,
  DynaPuff_700Bold,
} from "@expo-google-fonts/dynapuff";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { NanumGothicCoding_400Regular } from "@expo-google-fonts/nanum-gothic-coding";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { setEnabled, setVolume, useCuelumeSound } from "cuelume-native";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Presets } from "react-native-pulsar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { Logo } from "./components/Logo";
import GooeySwitch from "./components/micro-interactions/gooey-switch";
import { SquigglySlider } from "./components/molecules/squiggly-slider";
import { SoundPreviewPlayer } from "./components/SoundPreviewPlayer";
import { fonts, theme } from "./lib/theme";

const SAVE_COLOR = "#2e6cf6";
const DELETE_COLOR = "#f6462e";

/** Wired through the hook instead of calling `play()` directly — this is what `bind()` covered on the web. */
function SaveButton() {
  const sound = useCuelumeSound({ toggle: "success" });
  return (
    <Pressable
      style={[styles.actionButton, styles.saveButton]}
      onPressIn={sound.onPressIn}
      onPressOut={sound.onPressOut}
      onPress={() => {
        sound.onPress();
        Presets.System.notificationSuccess();
      }}
    >
      <Text style={[styles.actionButtonLabel, styles.saveButtonLabel]}>
        Save
      </Text>
    </Pressable>
  );
}

function DeleteButton() {
  const sound = useCuelumeSound({ toggle: "error" });
  return (
    <Pressable
      style={[styles.actionButton, styles.deleteButton]}
      onPressIn={sound.onPressIn}
      onPressOut={sound.onPressOut}
      onPress={() => {
        sound.onPress();
        Presets.System.notificationError();
      }}
    >
      <Text style={[styles.actionButtonLabel, styles.deleteButtonLabel]}>
        Delete
      </Text>
    </Pressable>
  );
}

function AppContent() {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [volume, setVolumeState] = useState(1);
  const [sliderWidth, setSliderWidth] = useState(0);
  const preferenceSound = useCuelumeSound();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.brand}>
          <Logo size={32} />
          <Text style={styles.title}>Cuelume Native</Text>
        </View>
        <Text style={styles.subtitle}>
          Seventeen interaction sounds, synthesized live via
          react-native-audio-api.
        </Text>

        <SoundPreviewPlayer />

        <Text style={[styles.sectionTitle, styles.code]}>
          useCuelumeSound()
        </Text>
        <View style={styles.row}>
          <SaveButton />
          <DeleteButton />
        </View>

        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.row}>
          <Text style={styles.preferenceLabel}>Enabled</Text>
          <GooeySwitch
            active={audioEnabled}
            onToggle={(value) => {
              setAudioEnabled(value);
              setEnabled(value);
              preferenceSound.onPress();
              Presets.System.selection();
            }}
            size={72}
            activeColor={theme.accent}
            inactiveColor={theme.textMuted}
            trackColor={theme.border}
            iconTint="#ffffff"
          />
        </View>

        <View style={styles.row}>
          <Text style={styles.preferenceLabel}>Volume</Text>
          <Text style={styles.volumeReadout}>{Math.round(volume * 100)}%</Text>
        </View>
        <View
          style={styles.sliderWrapper}
          onLayout={(event) => setSliderWidth(event.nativeEvent.layout.width)}
        >
          {sliderWidth > 0 && (
            <SquigglySlider
              value={volume}
              onValueChange={(value) => {
                setVolumeState(value);
                setVolume(value);
              }}
              onSlidingComplete={() => {
                preferenceSound.onPressOut();
                Presets.System.impactLight();
              }}
              width={sliderWidth}
              activeColor={theme.accent}
              inactiveColor={theme.border}
              thumbColor={theme.accent}
              strokeWidth={4}
              amplitude={6}
              speed={3}
            />
          )}
        </View>

        <StatusBar style="dark" />
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    DynaPuff_600SemiBold,
    DynaPuff_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    NanumGothicCoding_400Regular,
  });

  if (!fontsLoaded) return <View style={styles.safeArea} />;

  return (
    <GestureHandlerRootView style={styles.flexFill}>
      <BottomSheetModalProvider>
        <SafeAreaProvider>
          <AppContent />
        </SafeAreaProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flexFill: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  container: {
    padding: 20,
    gap: 12,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: theme.text,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: theme.textMuted,
    marginTop: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  saveButton: {
    backgroundColor: SAVE_COLOR,
    boxShadow: [
      {
        offsetX: 1,
        offsetY: 1,
        blurRadius: 4,
        color: SAVE_COLOR + "80",
      },
    ],
  },
  deleteButton: {
    backgroundColor: DELETE_COLOR,
    boxShadow: [
      {
        offsetX: 1,
        offsetY: 1,
        blurRadius: 4,
        color: DELETE_COLOR + "80",
      },
    ],
  },
  actionButtonLabel: {
    fontFamily: fonts.display,
    color: "#fff",
    fontSize: 15,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  saveButtonLabel: {
    textShadowColor: SAVE_COLOR,
  },
  deleteButtonLabel: {
    textShadowColor: DELETE_COLOR,
  },
  preferenceLabel: {
    fontFamily: fonts.body,
    color: theme.text,
    fontSize: 15,
    flex: 1,
  },
  volumeReadout: {
    fontFamily: fonts.mono,
    color: theme.textSecondary,
    fontSize: 14,
  },
  sliderWrapper: {
    width: "100%",
  },
  code: {
    fontFamily: fonts.mono,
    padding: 8,
    backgroundColor: theme.grid,
    textTransform: "none",
    color: theme.accent,
    flexShrink: 1,
    flexGrow: 0,
    alignSelf: "flex-start",
    borderRadius: 4,
  },
});
