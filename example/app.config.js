// Dynamic config: app.json stays the static base (passed in as `config`).
// `EXPO_DEV_BRANCH` (set by the start/web scripts to the current git branch)
// names the dev server after the branch so concurrent worktrees are
// distinguishable in Expo Go / dev tools. Falls back to the app.json name.
module.exports = ({ config }) => ({
  ...config,
  name: process.env.EXPO_DEV_BRANCH || config.name,
});
