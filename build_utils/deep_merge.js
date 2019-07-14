const _ = require('lodash')

const customizer = (objValue, srcValue) => {
  if (_.isArray(srcValue) && _.isArray(objValue)) {
    return objValue.concat(srcValue)
  }
}

module.exports = (object, sources) => _.mergeWith(_.cloneDeep(object), sources, customizer)

