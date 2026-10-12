// Xcode 27 refuses to build a target whose iOS deployment target is below 15.0.
// A few pods (react-native-svg, lottie, async-storage, rive) declare resource-bundle
// targets at 12.4–14.0, so the example app fails to build for the simulator.
// This raises every pod target below MIN to MIN in the Podfile's post_install.
// Remove it once those pods declare 15.0 or later themselves.
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MIN = "15.1";
const MARKER = "# withMinPodsDeploymentTarget";

const snippet = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || Gem::Version.new(current) < Gem::Version.new('${MIN}')
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN}'
        end
      end
    end`;

function addToPodfile(contents) {
  if (contents.includes(MARKER)) return contents;
  const hook = "post_install do |installer|";
  if (!contents.includes(hook)) {
    throw new Error("withMinPodsDeploymentTarget: no post_install hook in the Podfile");
  }
  return contents.replace(hook, hook + snippet);
}

module.exports = (config) =>
  withDangerousMod(config, [
    "ios",
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      fs.writeFileSync(podfile, addToPodfile(fs.readFileSync(podfile, "utf8")));
      return cfg;
    },
  ]);

module.exports.addToPodfile = addToPodfile;
