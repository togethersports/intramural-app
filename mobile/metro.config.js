// Metro must be told the shared logic lives OUTSIDE this project directory.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// Watch the repo root so packages/core is bundled and hot-reloads.
config.watchFolders = [path.resolve(repoRoot, "packages")];

// Resolve ONLY from the app's own node_modules. packages/core has zero
// dependencies, so reaching into the web app's tree would buy nothing and
// risk bundling its React (a different patch version) or a Next-only module.
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
