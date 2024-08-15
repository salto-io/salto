/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { CORE_ANNOTATIONS, isInstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { pathNaclCase } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { OBJECT_SCHEMA_TYPE, OBJECT_TYPE_ATTRIBUTE_TYPE } from '../../constants'

/* This filter change the attributes path to be nested to the ObjectType that created them.
 * The filter also removes the attributes from their parent asset schema.
 */
const filter: FilterCreator = ({ config }) => ({
  name: 'changeAttributesPathFilter',
  onFetch: async elements => {
    if (!config.fetch.enableJSM || !(config.fetch.enableJsmExperimental || config.fetch.enableJSMPremium)) {
      return
    }
    const attributes = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === OBJECT_TYPE_ATTRIBUTE_TYPE)
    const attributesByAssetObjectTypeName = _.groupBy(attributes, attribute =>
      attribute.value.objectType.elemID.getFullName(),
    )

    Object.values(attributesByAssetObjectTypeName).forEach(assetAttributes => {
      const assetsObjectType = assetAttributes[0].value.objectType.value
      assetAttributes.forEach(attribute => {
        attribute.path = [...assetsObjectType.path.slice(0, -1), 'attributes', pathNaclCase(attribute.value.name)]
        delete attribute.annotations[CORE_ANNOTATIONS.PARENT]
      })
    })

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === OBJECT_SCHEMA_TYPE)
      .forEach(instance => {
        delete instance.value.attributes
      })
  },
})
export default filter
