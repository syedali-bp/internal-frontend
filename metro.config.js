// Learn more https://docs.expo.dev/versions/v57.0.0/config/metro/
const { getDefaultConfig } = require('expo/metro-config')

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

// Gradle writes thousands of files under these during a native build. Metro has
// no reason to crawl or resolve from them, and watching them drives the file
// watcher's memory up until the OOM killer starts picking targets.
config.resolver.blockList = [
  /\/android\/build\/.*/,
  /\/android\/app\/build\/.*/,
  /\/android\/app\/\.cxx\/.*/,
  /\/android\/\.gradle\/.*/,
  /\/android\/\.kotlin\/.*/,
  /\/ios\/build\/.*/,
  /\/ios\/Pods\/.*/,
]

module.exports = config
