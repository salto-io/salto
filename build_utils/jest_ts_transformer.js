const path = require('path')
const fs = require('fs')
const babelJest = require('babel-jest')
const DIST_BASE_PATH = 'dist'

const _process = (src, filename, config) => {
  if (filename.endsWith('.d.ts')) {
    // do not process d.ts files
    return { code: src }
  }

  const relativePath = path.relative(config.rootDir, filename)
  if (relativePath[0] === '.' || relativePath.startsWith('dist/') || !relativePath.endsWith('ts')) {
    // outside of rootDir, already in dist or not TypeScript - ignore
    return { code: src }
  }

  const distFilename = path.join(config.rootDir, DIST_BASE_PATH, relativePath.replace(/\.ts$/, '.js'))

  const code = fs.readFileSync(distFilename, 'utf8')
    .replace(/\b__dirname\b/g, `'${path.dirname(distFilename)}'`)
    .replace(/\b__filename\b/g, `'${distFilename}'`)

  const mapFilename = code.match(/^\/\/\# sourceMappingURL=(.*)$/m)[1]
  map = JSON.parse(fs.readFileSync(path.join(path.dirname(distFilename), mapFilename), 'utf8'))

  return { code, map, filename: distFilename }
}

module.exports = {
  process(src, filename, config, options) {
    const { code, map, distFilename } = _process(src, filename, config)
    const babelCode = babelJest.process(code, distFilename || filename, config, options).code
    return { code: babelCode, map }
  }
}

