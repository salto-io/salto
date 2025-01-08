/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  ChangeValidator,
  getChangeData,
  isInstanceElement,
  CORE_ANNOTATIONS,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { ZendeskApiConfig } from '../../user_config'
import { getChildAndParentTypeNames } from './utils'

export const parentAnnotationToHaveSingleValueValidatorCreator =
  (apiConfig: ZendeskApiConfig): ChangeValidator =>
  async changes => {
    const relationships = getChildAndParentTypeNames(apiConfig)
    const childrenTypes = new Set(relationships.map(r => r.child))
    return changes
      .map(getChangeData)
      .filter(isInstanceElement)
      .filter(instance => childrenTypes.has(instance.elemID.typeName))
      .filter(instance => {
        const parents = instance.annotations[CORE_ANNOTATIONS.PARENT]
        return !(_.isArray(parents) && parents.length === 1 && isReferenceExpression(parents[0]))
      })
      .map(instance => ({
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Cannot change an element with zero or multiple parents',
        detailedMessage: 'Please make sure to set exactly one parent for this element',
      }))
  }
