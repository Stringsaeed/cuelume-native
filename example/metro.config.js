// `cuelume-native` isn't a sibling workspace package — this `example/` app
// is nested *inside* the library's own repo root, which is itself the
// workspace root. `react-native-monorepo-config` handles the watchFolders/
// extraNodeModules/blockList wiring this needs (and de-dupes react/
// react-native between the root's devDependencies and example's
// dependencies) — this is the same helper `create-react-native-library`
// generates for library + example repos shaped like this one.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withMetroConfig } = require("react-native-monorepo-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const baseConfig = getDefaultConfig(projectRoot);

// `cuelume-native`'s source uses NodeNext-style relative imports
// (`./sounds/recipes.js`) so the *compiled* dist output resolves correctly
// under plain Node ESM (our test suite runs it that way). Metro reads the
// raw .ts source directly, where the same specifier doesn't exist as
// written — strip a trailing ".js" off relative imports so Metro's own
// `sourceExts` (which includes "ts") finds the real file.
baseConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    return context.resolveRequest(context, moduleName.slice(0, -3), platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withMetroConfig(baseConfig, {
  root: workspaceRoot,
  dirname: projectRoot,
});
