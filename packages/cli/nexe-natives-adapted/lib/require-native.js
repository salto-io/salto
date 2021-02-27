const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');

function requireNative(moduleName, internalModulesDir, externalModulesDir) {
  const modulesDir = path.join(internalModulesDir, moduleName);
  const nativesDir = path.join(externalModulesDir, moduleName);

  // remove native dir if exists
  rimraf.sync(nativesDir);

  // copy module to native dir
  (function cpr(cwd = '') {
    const srcDir = path.join(modulesDir, cwd);
    const dstDir = path.join(nativesDir, cwd);

    // create destination dir
    fs.mkdirSync(dstDir, { recursive: true });

    const list = fs.readdirSync(srcDir);
    list.forEach((srcName) => {
      const srcPath = path.join(srcDir, srcName);
      const dstPath = path.join(dstDir, srcName);

      const src = fs.statSync(srcPath);

      // if file, copy to destination
      if (src.isFile()) {
        fs.copyFileSync(srcPath, dstPath);
        return;
      }

      // else if directory, recursively navigate
      if (src.isDirectory()) {
        cpr(path.join(cwd, srcName));
      }
    });
  }());

  // returns native package required from copied location
  // eslint-disable-next-line
  const nativePkg = __non_webpack_require__(nativesDir);

  return nativePkg;
}

module.exports = requireNative;
