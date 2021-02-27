const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');

const requireNative = require('./lib/require-native');

const defaultLocalPath = path.join(process.env.HOME, '.nexe_natives');

function getPathToNodeModules(mainPath) {
  if (path.resolve(mainPath).endsWith('node_modules')) {
    return mainPath;
  }

  const parent = path.dirname(mainPath);

  // if reached root of fs
  if (parent === mainPath) {
    throw Error('could not find node_modules');
  }

  return getPathToNodeModules(parent);
}

function getPathToPackageJson(mainPath) {
  try {
    const list = fs.readdirSync(mainPath);
    if (list.includes('package.json')) {
      return path.join(mainPath, 'package.json');
    }
  } catch (err) {
    // ignore
  }

  const parent = path.dirname(mainPath);

  // if reached root of fs
  if (parent === mainPath) {
    throw Error('could not find package.json');
  }

  return getPathToPackageJson(parent);
}

module.exports = (mainPath, opts = {}) => {
  const externalModulesDir = opts.localPath || defaultLocalPath;
  const internalModulesDir = getPathToNodeModules(mainPath);
  const removeOnExit = (typeof opts.removeOnExit !== 'boolean' || opts.removeOnExit);

  // parse package.json for module name
  // eslint-disable-next-line
  const moduleName = opts.name || require(getPathToPackageJson(mainPath)).name;

  if (removeOnExit) {
    process.on('exit', () => {
      try {
        const moduleDir = path.join(externalModulesDir, moduleName);
        rimraf.sync(moduleDir);
        const list = fs.readdirSync(externalModulesDir);
        if (list.length === 0) {
          rimraf.sync(externalModulesDir);
        }
      } catch (err) {
        // ignore error when deleting
      }
    });
  }

  return requireNative(moduleName, internalModulesDir, externalModulesDir);
};
