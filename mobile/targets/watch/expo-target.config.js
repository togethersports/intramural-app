/**
 * The Intramural watch app — a real watchOS application target, generated
 * into the Xcode project at prebuild by @bacons/apple-targets.
 *
 * This target only exists when the WITH_WATCH=1 env var is set at prebuild
 * (see app.config.js): the 1.0 App Store binary is in review and must not
 * grow an unproven native target underneath it. Build with:
 *
 *   npx eas-cli build -p ios --profile simulator-watch
 */
module.exports = {
  type: "watch",
  name: "Intramural",
  displayName: "Intramural",
  // Leading dot = appended to the app's bundle id: app.intramural.ios.watch.
  // Apple requires a companion watch app's id to be prefixed by the host's.
  bundleIdentifier: ".watch",
  deploymentTarget: "9.4",
  icon: "../../assets/icon.png",
};
