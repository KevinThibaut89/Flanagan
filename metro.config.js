const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Named imports from `@expo/vector-icons` pull every icon TTF into the
// published update. Expo Go then has to download them all, which surfaces as
// "Failed to load all assets". Keep only MaterialCommunityIcons.
const unusedIconFonts =
  /node_modules\/@expo\/vector-icons\/build\/vendor\/react-native-vector-icons\/Fonts\/(?!MaterialCommunityIcons\.ttf$).+\.ttf$/;

const existing = config.resolver.blockList;
config.resolver.blockList = existing ? [existing, unusedIconFonts].flat() : unusedIconFonts;

module.exports = config;
