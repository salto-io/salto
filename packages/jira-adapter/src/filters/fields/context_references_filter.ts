/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, InstanceElement, isInstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from './constants'

const filter: FilterCreator = () => ({
  name: 'contextReferencesFilter',
  onFetch: async (elements: Element[]) => {
    const parentToContext = _.groupBy(
      elements.filter(isInstanceElement).filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME),
      instance => getParents(instance)[0].elemID.getFullName(),
    )

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_TYPE_NAME)
      .forEach(instance => {
        instance.value.contexts = parentToContext[instance.elemID.getFullName()]?.map(
          (context: InstanceElement) => new ReferenceExpression(context.elemID, context),
        )
      })
  },
})

export default filter
