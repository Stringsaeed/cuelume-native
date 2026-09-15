import { Ionicons } from "@expo/vector-icons";
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import type { BottomSheetModalMethods } from "@gorhom/bottom-sheet/lib/typescript/types";
import type { SoundName } from "cuelume-native";
import { useImperativeHandle, useRef, type RefObject } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, theme } from "../lib/theme";
import { CueList } from "./CueList";

const SHEET_BOTTOM_PADDING = 28;

type CueSheetProps = {
  sounds: readonly SoundName[];
  selected: SoundName;
  onSelect: (name: SoundName) => void;
  outerRef?: RefObject<BottomSheetModal | null>;
};

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
);

export const CueSheet = ({
  sounds,
  selected,
  onSelect,
  outerRef,
}: CueSheetProps) => {
  const { height } = useWindowDimensions();
  const innerRef = useRef<BottomSheetModalMethods>(null);
  const insets = useSafeAreaInsets();

  useImperativeHandle(outerRef, () => innerRef.current!);

  const close = () => {
    innerRef.current?.dismiss();
  };

  return (
    <BottomSheetModal
      ref={innerRef}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.surface}
      topInset={insets.top}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Choose a sound</Text>
        <Pressable style={styles.closeButton} onPress={close} hitSlop={8}>
          <Ionicons name="close" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>
      <BottomSheetScrollView
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: SHEET_BOTTOM_PADDING + insets.bottom },
        ]}
      >
        <CueList
          sounds={sounds}
          selected={selected}
          onSelect={(name) => {
            onSelect(name);
            close();
          }}
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  surface: {
    backgroundColor: theme.panelAlt,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleIndicator: {
    backgroundColor: theme.border,
    width: 36,
    height: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  headerTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: theme.text,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.panel,
  },
  listContent: {
    paddingHorizontal: 20,
  },
});
