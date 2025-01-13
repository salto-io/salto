/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { CORE_ANNOTATIONS, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { OBJECT_SCHEMA_TYPE, OBJECT_TYPE_TYPE } from '../../constants'

const log = logger(module)

/* This filter modifies fields for objectTypes and objectSchemas  */
const filter: FilterCreator = ({ config }) => ({
  name: 'assetsObjectTypeChangeFields',
  onFetch: async elements => {
    if (!config.fetch.enableJSM || !(config.fetch.enableJsmExperimental || config.fetch.enableJSMPremium)) {
      return
    }
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === OBJECT_TYPE_TYPE)
      .forEach(instance => {
        if (instance.value.parentObjectTypeId === undefined) {
          // add reference to assetsSchema to the root, in order to be able to later update its elemID.
          ;[instance.value.parentObjectTypeId] = instance.annotations[CORE_ANNOTATIONS.PARENT]
        }
      })
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === OBJECT_SCHEMA_TYPE)
      .forEach(instance => {
        delete instance.value.objectTypes
        delete instance.value.objectSchemaStatuses
        delete instance.value.referenceTypes
        if (!Array.isArray(instance.value.properties) || !(instance.value.properties.length === 1)) {
          // Each objectSchema has a single object properties, so we can remove the array and keep the object
          log.error('objectSchema properties should be an array with a single object', instance.value.properties)
          return
        }
        // eslint-disable-next-line prefer-destructuring
        instance.value.properties = instance.value.properties[0]
      })
  },
})
export default filter
