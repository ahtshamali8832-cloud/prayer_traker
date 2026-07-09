const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Avoid Metro worker spawn EPERM errors on Windows
config.maxWorkers = 1;

const supabaseNodeFetchShim = path.resolve(__dirname, 'lib/shims/supabase-node-fetch.js');
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@supabase/node-fetch') {
    return {
      filePath: supabaseNodeFetchShim,
      type: 'sourceFile',
    };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
