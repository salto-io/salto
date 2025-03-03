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
  CORE_ANNOTATIONS,
  getChangeData,
  InstanceElement,
  isInstanceElement,
  isReferenceExpression,
  isInstanceChange,
  AdditionChange,
  ChangeError,
  isAdditionChange,
  isAdditionOrModificationChange,
  ElemID,
} from '@salto-io/adapter-api'
import { definitions as definitionsUtils } from '@salto-io/adapter-components'
import { Options } from '../../definitions/types'
import { getChildAndParentTypeNames, getRemovedAndAddedChildren } from './utils'

const createParentReferencesError = (change: AdditionChange<InstanceElement>, parentElemId: ElemID): ChangeError => {
  const instance = getChangeData(change)
  return {
    elemID: instance.elemID,
    severity: 'Error',
    message: 'Element needs to be referred from its parent',
    detailedMessage: `To add this ${instance.elemID.typeName}, please make sure ${instance.elemID.getFullName()} is included in ‘${parentElemId.getFullName()}’. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/9582618-element-needs-to-be-referred-from-its-parent`,
  }
}

export const missingFromParentValidatorCreator =
  (definitions: definitionsUtils.ApiDefinitions<Options>): ChangeValidator =>
  async changes => {
    const relationships = getChildAndParentTypeNames(definitions)
    const childrenTypes = new Set(relationships.map(r => r.child))
    const instanceChanges = changes.filter(isInstanceChange)
    const relevantChanges = instanceChanges
      .filter(isAdditionChange)
      .filter(change => childrenTypes.has(getChangeData(change).elemID.typeName))
    const changeByID = _.keyBy(instanceChanges, change => getChangeData(change).elemID.getFullName())
    return relevantChanges.flatMap(change => {
      const instance = getChangeData(change)
      const { typeName } = instance.elemID
      const parentRef = instance.annotations[CORE_ANNOTATIONS.PARENT]?.[0]
      if (!(isReferenceExpression(parentRef) && isInstanceElement(parentRef.value))) {
        return []
      }
      const parentFullName = parentRef.value.elemID.getFullName()
      const relevantRelations = relationships.filter(r => r.child === typeName)
      return relevantRelations.flatMap(relation => {
        const parentChange = changeByID[parentFullName]
        if (parentChange === undefined || !isAdditionOrModificationChange(parentChange)) {
          return [createParentReferencesError(change, parentRef.value.elemID)]
        }
        const { added } = getRemovedAndAddedChildren(parentChange, relation.fieldName)
        if (isAdditionChange(change) && !added.some(id => id.isEqual(instance.elemID))) {
          return [createParentReferencesError(change, parentRef.value.elemID)]
        }
        return []
      })
    })
  }
