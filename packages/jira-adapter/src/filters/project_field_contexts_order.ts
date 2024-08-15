/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  Element,
  ReferenceExpression,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { PROJECT_TYPE } from '../constants'

/**
 * sorting project field contexts to avoid unnecessary noise
 */
const filter: FilterCreator = () => ({
  name: 'projectFieldContexts',
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === PROJECT_TYPE)
      .filter(instance => instance.value.fieldContexts !== undefined)
      .forEach(instance => {
        instance.value.fieldContexts = _.sortBy(instance.value.fieldContexts, (ref: ReferenceExpression) =>
          ref.elemID.getFullName(),
        )
      })
  },
  onDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(element => element.elemID.typeName === PROJECT_TYPE)
      .filter(element => element.value.fieldContexts !== undefined)
      .forEach(element => {
        element.value.fieldContexts = _.sortBy(element.value.fieldContexts, (ref: ReferenceExpression) =>
          ref.elemID.getFullName(),
        )
      })
  },
})

export default filter
