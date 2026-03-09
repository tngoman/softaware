#!/usr/bin/env node
/**
 * Postinstall script to fix @excalidraw/excalidraw ESM resolution errors.
 *
 * Problem: @excalidraw/excalidraw has "type": "module" and imports roughjs
 * paths without .js extensions (e.g. 'roughjs/bin/rough'). Webpack 5 enforces
 * fullySpecified resolution for ESM, so these imports fail.
 *
 * Fix: Patches roughjs/package.json with an exports map AND rewrites the
 * import statements in excalidraw's dist files to include .js extensions.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ROUGHJS_PKG = path.join(ROOT, 'node_modules', 'roughjs', 'package.json');
const EXCALIDRAW_DEV = path.join(ROOT, 'node_modules', '@excalidraw', 'excalidraw', 'dist', 'dev');
const EXCALIDRAW_PROD = path.join(ROOT, 'node_modules', '@excalidraw', 'excalidraw', 'dist', 'prod');

// List of roughjs/bin modules that excalidraw imports without extensions
const ROUGHJS_MODULES = ['rough', 'generator', 'math', 'canvas', 'svg', 'core', 'geometry', 'renderer'];

function patchRoughjsPackageJson() {
  if (!fs.existsSync(ROUGHJS_PKG)) {
    console.log('[fix-esm] roughjs not found, skipping package.json patch');
    return;
  }

  const pkg = JSON.parse(fs.readFileSync(ROUGHJS_PKG, 'utf8'));

  // Build exports map
  const exports = {
    '.': {
      'import': './bundled/rough.esm.js',
      'require': './bundled/rough.cjs.js',
      'default': './bundled/rough.cjs.js'
    }
  };

  for (const mod of ROUGHJS_MODULES) {
    exports[`./bin/${mod}`] = `./bin/${mod}.js`;
    exports[`./bin/${mod}.js`] = `./bin/${mod}.js`;
  }

  exports['./bin/*'] = './bin/*';
  exports['./bundled/*'] = './bundled/*';
  exports['./*'] = './*';

  pkg.exports = exports;
  fs.writeFileSync(ROUGHJS_PKG, JSON.stringify(pkg, null, 2) + '\n');
  console.log('[fix-esm] ✅ Patched roughjs/package.json with exports map');
}

function patchExcalidrawDist(distDir) {
  if (!fs.existsSync(distDir)) {
    console.log(`[fix-esm] ${distDir} not found, skipping`);
    return;
  }

  const jsFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.js'));
  let patchCount = 0;

  for (const file of jsFiles) {
    const filePath = path.join(distDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let patched = false;

    for (const mod of ROUGHJS_MODULES) {
      // Handle both normal and minified imports:
      //   from "roughjs/bin/rough"    (normal, with space)
      //   from"roughjs/bin/rough"     (minified, no space)
      for (const pattern of [
        `from "roughjs/bin/${mod}"`,
        `from"roughjs/bin/${mod}"`,
      ]) {
        const replacement = pattern.replace(
          `roughjs/bin/${mod}"`,
          `roughjs/bin/${mod}.js"`
        );
        if (content.includes(pattern)) {
          content = content.split(pattern).join(replacement);
          patched = true;
        }
      }
    }

    if (patched) {
      fs.writeFileSync(filePath, content);
      patchCount++;
      console.log(`[fix-esm] ✅ Patched ${file}`);
    }
  }

  if (patchCount === 0) {
    console.log(`[fix-esm] No files needed patching in ${path.basename(distDir)}/`);
  }
}

// Run
console.log('[fix-esm] Fixing @excalidraw/excalidraw ESM resolution...');
patchRoughjsPackageJson();
patchExcalidrawDist(EXCALIDRAW_DEV);
patchExcalidrawDist(EXCALIDRAW_PROD);
console.log('[fix-esm] Done.');
