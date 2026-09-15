/**
 * reacticx's gooey-switch/types.ts is loaded lazily behind a tab UI on their
 * site and wasn't retrievable verbatim (only index.tsx and const.ts streamed
 * into the page). Reconstructed from index.tsx's usage of each type plus the
 * documented public prop table — same shape, not a byte-for-byte copy.
 */

import type { ReactNode } from "react";
import type { SharedValue, WithSpringConfig } from "react-native-reanimated";

export type IconRender = {
  size: number;
  color: string;
};

export type IBlobConfig = {
  stretchX?: number;
  squishY?: number;
  sideBlobScale?: number;
};

export type BridgeConfig = {
  show?: boolean;
  height?: number;
  offset?: number;
};

export interface IGooeySwitch {
  active?: boolean;
  onToggle?: (active: boolean) => void;
  size?: number;
  inactiveColor?: string;
  activeColor?: string;
  trackColor?: string;
  iconTint?: string;
  toggleThreshold?: number;
  isDisabled?: boolean;
  showIcons?: boolean;
  animation?: WithSpringConfig;
  deformation?: IBlobConfig;
  connector?: BridgeConfig;
  blur?: number;
  gooey?: number;
  renderActiveIcon?: (props: IconRender) => ReactNode;
  renderInactiveIcon?: (props: IconRender) => ReactNode;
  onDragBegin?: () => void;
  onDragFinish?: (active: boolean) => void;
}

export interface ICoreOval {
  cx: SharedValue<number>;
  cy: number;
  rx: SharedValue<number>;
  ry: SharedValue<number>;
  progress: SharedValue<number>;
  onColor: string;
  offColor: string;
}

export interface IShadowOval {
  cx: SharedValue<number>;
  cy: number;
  rx: SharedValue<number>;
  ry: SharedValue<number>;
  color: string;
}

export interface IAnimatedBridge {
  leftX: number;
  rightX: number;
  cy: number;
  mainX: SharedValue<number>;
  height: number;
  color: string;
  progress: SharedValue<number>;
}
