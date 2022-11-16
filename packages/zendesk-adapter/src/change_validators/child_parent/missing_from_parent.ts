/*
*                      Copyright 2022 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { ChangeValidator, CORE_ANNOTATIONS, getChangeData, InstanceElement, isInstanceElement,
  isReferenceExpression, isInstanceChange, AdditionChange, ChangeError, isAdditionChange,
  isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { ZendeskApiConfig } from '../../config'
import { getChildAndParentTypeNames, getIdsFromReferenceExpressions } from './utils'

const { awu } = collections.asynciterable
const log = logger(module)

export const createParentReferencesError = (
  change: AdditionChange<InstanceElement>,
  parentFullName: string,
): ChangeError => {
  const instance = getChangeData(change)
  return {
    elemID: instance.elemID,
    severity: 'Error',
    message: `Cannot add ${instance.elemID.typeName} because there is no reference to it from its parent`,
    detailedMessage: `Cannot add ${instance.elemID.getFullName()} because there is no reference to it from ${parentFullName}`,
  }
}

export const missingFromParentValidatorCreator = (
  apiConfig: ZendeskApiConfig,
): ChangeValidator => async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.warn('Element source was not passed to missingFromParentValidatorCreator. Skipping validator')
    return []
  }
  const relationships = getChildAndParentTypeNames(apiConfig)
  const childrenTypes = new Set(relationships.map(r => r.child))
  const instanceChanges = changes.filter(isInstanceChange)
  const relevantChanges = instanceChanges
    .filter(isAdditionChange)
    .filter(change => childrenTypes.has(getChangeData(change).elemID.typeName))
  const changeByID = _.keyBy(instanceChanges, change => getChangeData(change).elemID.getFullName())
  return awu(relevantChanges).flatMap(change => {
    const instance = getChangeData(change)
    const { typeName } = instance.elemID
    const parentRef = instance.annotations[CORE_ANNOTATIONS.PARENT]?.[0]
    if (!(isReferenceExpression(parentRef) && isInstanceElement(parentRef.value))) {
      return []
    }
    const parentFullName = parentRef.value.elemID.getFullName()
    const relevantRelations = relationships.filter(r => r.child === typeName)
    return awu(relevantRelations).flatMap(async relation => {
      const parentChange = changeByID[parentFullName]
      if (parentChange === undefined || !isAdditionOrModificationChange(parentChange)) {
        return [createParentReferencesError(change, parentFullName)]
      }
      const parentInstance = await elementSource.get(parentRef.value.elemID)
      if (parentInstance === undefined) {
        log.error('Could not find parent instance %s in element source', parentFullName)
        return []
      }
      const referencedIDs = getIdsFromReferenceExpressions(parentInstance.value[relation.fieldName])
      if (isAdditionChange(change) && !referencedIDs.some(id => id.isEqual(instance.elemID))) {
        return [createParentReferencesError(change, parentFullName)]
      }
      return []
    }).toArray()
  }).toArray()
}
