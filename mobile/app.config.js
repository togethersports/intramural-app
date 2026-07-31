/**
 * app.json stays the single static source of truth. This wrapper exists for
 * exactly one thing: the watchOS target is opt-in per build, because the 1.0
 * iPhone binary is in App Store review and its profiles must keep producing
 * byte-identical output. WITH_WATCH=1 (set by the *-watch profiles in
 * eas.json) adds the @bacons/apple-targets plugin, which generates the watch
 * app target from targets/watch/ at prebuild.
 */
const { expo } = require("./app.json");

module.exports = () => {
  if (process.env.WITH_WATCH !== "1") return expo;
  return {
    ...expo,
    ios: { ...expo.ios, appleTeamId: "6M7RM2GD2C" },
    plugins: [
      ...expo.plugins,
      ["@bacons/apple-targets", { appleTeamId: "6M7RM2GD2C" }],
    ],
  };
};
