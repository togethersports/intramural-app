// The shared logic in ./core lives INSIDE this project on purpose: EAS Build
// uploads only the Expo project directory, so anything above it (the old
// ../packages/core) is simply absent on the build machine and the bundle
// fails to resolve it. Keeping it here needs no watchFolders at all.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Resolve ONLY from the app's own node_modules. core/ has zero dependencies,
// so reaching into the web app's tree would buy nothing and risk bundling its
// React (a different patch version) or a Next-only module.
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
