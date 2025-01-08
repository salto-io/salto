/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { PROJECT_COMPONENT_TYPE, PROJECT_TYPE } from '../constants'

/**
 * Remove archived project components
 */
const filter: FilterCreator = () => ({
  name: 'archivedProjectComponentsFilter',
  onFetch: async (elements: Element[]) => {
    const removedComponents = _.remove(
      elements,
      element =>
        isInstanceElement(element) && element.elemID.typeName === PROJECT_COMPONENT_TYPE && element.value.archived,
    )

    const removedComponentsIds = new Set(removedComponents.map(instance => instance.elemID.getFullName()))

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === PROJECT_TYPE)
      .forEach(instance => {
        _.remove(
          instance.value.components,
          ref => isResolvedReferenceExpression(ref) && removedComponentsIds.has(ref.elemID.getFullName()),
        )
      })

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === PROJECT_COMPONENT_TYPE)
      .forEach(instance => {
        delete instance.value.archived
      })
  },
})

export default filter
