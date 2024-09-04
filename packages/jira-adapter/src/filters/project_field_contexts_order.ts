/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Element,
  ReferenceExpression,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { PROJECT_IDS } from '../constants'
import { FIELD_CONTEXT_TYPE_NAME } from './fields/constants'

/**
 * sorting project field contexts to avoid unnecessary noise
 */
const filter: FilterCreator = () => ({
  name: 'ProjectsIdContextOrder',
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
      .filter(instance => Array.isArray(instance.value[PROJECT_IDS]))
      .forEach(instance => {
        instance.value[PROJECT_IDS] = _.sortBy(instance.value[PROJECT_IDS], (ref: ReferenceExpression) =>
          ref.elemID.getFullName(),
        )
      })
  },
  onDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
      .filter(instance => Array.isArray(instance.value[PROJECT_IDS]))
      .forEach(instance => {
        instance.value[PROJECT_IDS] = _.sortBy(instance.value[PROJECT_IDS], (ref: ReferenceExpression) =>
          ref.elemID.getFullName(),
        )
      })
  },
})

export default filter
