/**
 * Webpack overrides for Create React App (via react-app-rewired).
 *
 * Fixes ESM "fullySpecified" resolution errors from @excalidraw/excalidraw's
 * dependency on roughjs. Webpack 5 enforces fully-specified imports for ESM
 * packages ("type": "module"), but roughjs uses extensionless imports like
 * 'roughjs/bin/rough' instead of 'roughjs/bin/rough.js'.
 *
 * Uses webpack.NormalModuleReplacementPlugin — the most reliable approach
 * because it rewrites the request BEFORE the fullySpecified check.
 */
const path = require('path');
const webpack = require('webpack');

module.exports = function override(config) {
  console.log('[config-overrides] Applying excalidraw/roughjs ESM fix...');

  // ---------------------------------------------------------------------------
  // 1. NormalModuleReplacementPlugin — intercepts module requests and appends
  //    .js extension for roughjs/bin/* imports. This fires before the
  //    fullySpecified enforcement, so it's bulletproof.
  // ---------------------------------------------------------------------------
  config.plugins = config.plugins || [];
  config.plugins.push(
    new webpack.NormalModuleReplacementPlugin(
      /^roughjs\/bin\/(.*)$/,
      (resource) => {
        // Only add .js if the request doesn't already have an extension
        if (!resource.request.endsWith('.js')) {
          const original = resource.request;
          resource.request = resource.request + '.js';
          console.log(`[roughjs-fix] ${original} → ${resource.request}`);
        }
      }
    )
  );

  // ---------------------------------------------------------------------------
  // 2. Disable fullySpecified for ALL .js/.mjs files in node_modules.
  //    This is the standard webpack 5 workaround for ESM interop issues.
  //    We apply it both at top-level rules and inside oneOf arrays.
  // ---------------------------------------------------------------------------
  const esmFixRule = {
    test: /\.m?js$/,
    include: /node_modules/,
    resolve: { fullySpecified: false },
  };

  // Walk existing rules and disable fullySpecified wherever it's set
  function patchRules(rules) {
    if (!rules) return;
    for (const rule of rules) {
      if (rule.resolve) {
        rule.resolve.fullySpecified = false;
      }
      if (rule.oneOf) {
        rule.oneOf.unshift({ ...esmFixRule });
        patchRules(rule.oneOf);
      }
      if (Array.isArray(rule.rules)) {
        patchRules(rule.rules);
      }
    }
  }
  patchRules(config.module.rules);

  // Also add at the top level
  config.module.rules.unshift(esmFixRule);

  // ---------------------------------------------------------------------------
  // 3. resolve.alias as final fallback — map exact roughjs imports to the
  //    actual .js files on disk.
  // ---------------------------------------------------------------------------
  const roughjsBin = path.resolve(__dirname, 'node_modules', 'roughjs', 'bin');

  config.resolve = config.resolve || {};
  config.resolve.alias = config.resolve.alias || {};
  Object.assign(config.resolve.alias, {
    'roughjs/bin/rough':     path.join(roughjsBin, 'rough.js'),
    'roughjs/bin/generator': path.join(roughjsBin, 'generator.js'),
    'roughjs/bin/math':      path.join(roughjsBin, 'math.js'),
  });

  // ---------------------------------------------------------------------------
  // 4. (Removed — devServer override is handled separately below.)
  // ---------------------------------------------------------------------------

  console.log('[config-overrides] ESM fix applied successfully.');
  return config;
};

/**
 * Override the webpack-dev-server configuration (via react-app-rewired).
 * Forces the HMR WebSocket client to use protocol 'auto' so that on an
 * https:// page the browser connects with wss:// instead of ws://.
 */
module.exports.devServer = function overrideDevServer(configFunction) {
  return function (proxy, allowedHost) {
    const config = configFunction(proxy, allowedHost);

    config.client = config.client || {};
    config.client.webSocketURL = {
      protocol: 'wss',
      hostname: 'softaware.net.za',
      port: 3003,
      pathname: '/ws',
    };

    console.log('[config-overrides] DevServer webSocketURL set to wss://softaware.net.za:3003/ws');
    return config;
  };
};
