/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { FIELD_CONFIGURATION_ITEM_TYPE_NAME } from '../../constants'
import { FilterCreator } from '../../filter'

const filter: FilterCreator = () => ({
  name: 'missingFieldDescriptionsFilter',
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_ITEM_TYPE_NAME)
      .filter(instance => _.isEmpty(instance.value.description))
      .filter(
        instance => isResolvedReferenceExpression(instance.value.id) && isInstanceElement(instance.value.id.value),
      )
      .forEach(instance => {
        instance.value.description = instance.value.id.value.value.description ?? ''
      })
  },
})

export default filter
