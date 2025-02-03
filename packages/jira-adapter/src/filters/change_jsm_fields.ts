/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { isInstanceElement } from '@salto-io/adapter-api'
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { OBJECT_TYPE_ATTRIBUTE_TYPE, OBJECT_TYPE_TYPE } from '../constants'

type ObjectWithId = {
  id: number
}
const OBJECT_RESPONSE_SCHEME = Joi.object({
  id: Joi.number().required(),
})
  .unknown(true)
  .required()

const isObjectWithId = createSchemeGuard<ObjectWithId>(OBJECT_RESPONSE_SCHEME)

/* This filter modifies JSM object fields to ensure compatibility with their deployment requirements. */
const filter: FilterCreator = () => ({
  name: 'changeJSMElementsFieldFilter',
  onFetch: async elements => {
    const instanceElements = elements.filter(isInstanceElement)

    instanceElements
      .filter(e => e.elemID.typeName === OBJECT_TYPE_TYPE)
      .forEach(instance => {
        instance.value.iconId = isObjectWithId(instance.value.icon) ? instance.value.icon.id : instance.value.icon
        delete instance.value.icon
      })

    instanceElements
      .filter(e => e.elemID.typeName === OBJECT_TYPE_ATTRIBUTE_TYPE)
      .forEach(instance => {
        instance.value.defaultTypeId = isObjectWithId(instance.value.defaultType) ? instance.value.defaultType.id : -1
        delete instance.value.defaultType
        instance.value.additionalValue = isObjectWithId(instance.value.referenceType)
          ? instance.value.referenceType.id
          : undefined
        delete instance.value.referenceType
        instance.value.typeValue = instance.value.referenceObjectTypeId
        delete instance.value.referenceObjectTypeId
      })
  },
})
export default filter
