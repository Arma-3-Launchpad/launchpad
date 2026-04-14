const fs = require('node:fs');
const path = require('node:path');
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

/** Packaged layout under repo ``A3LaunchPad/`` (Python onedir, static UI, same parent as ``bin``). */
const a3LaunchPad = path.resolve(__dirname, '..', '..', 'A3LaunchPad');
const launchpadFrozenBin = path.join(a3LaunchPad, 'bin');
const launchpadWebDist = path.join(a3LaunchPad, 'web_dist');
const extraResource = [];
if (fs.existsSync(launchpadFrozenBin)) extraResource.push(launchpadFrozenBin);
if (fs.existsSync(launchpadWebDist)) extraResource.push(launchpadWebDist);

module.exports = {
  packagerConfig: {
    asar: true,
    ...(extraResource.length ? { extraResource } : {}),
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {},
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          {
            entry: 'src/main.js',
            config: 'vite.main.config.mjs',
            target: 'main',
          },
          {
            entry: 'src/preload.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.mjs',
          },
        ],
      },
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
