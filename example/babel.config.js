module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // react-native-audio-api's worklet-based nodes need this; it must run last.
    plugins: ["react-native-worklets/plugin"],
  };
};
