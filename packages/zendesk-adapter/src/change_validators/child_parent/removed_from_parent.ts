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
import { ChangeValidator, getChangeData, isInstanceChange, isModificationChange,
  isRemovalChange } from '@salto-io/adapter-api'
import { ZendeskApiConfig } from '../../config/config'
import { getChildAndParentTypeNames, getRemovedAndAddedChildren } from './utils'

export const removedFromParentValidatorCreator = (
  apiConfig: ZendeskApiConfig,
): ChangeValidator => async changes => {
  const relationships = getChildAndParentTypeNames(apiConfig)
  const parentTypes = new Set(relationships.map(r => r.parent))
  const instanceChanges = changes.filter(isInstanceChange)
  const relevantChanges = instanceChanges
    .filter(isModificationChange)
    .filter(change => parentTypes.has(getChangeData(change).elemID.typeName))
  const changeByID = _.keyBy(instanceChanges, change => getChangeData(change).elemID.getFullName())
  return relevantChanges.flatMap(change => {
    const instance = getChangeData(change)
    const { typeName } = instance.elemID
    const relevantRelations = relationships.filter(r => r.parent === typeName)
    return relevantRelations.flatMap(relation => {
      const nonFullyRemovedChildren = getRemovedAndAddedChildren(change, relation.fieldName)
        .removed
        .filter(childId =>
          (changeByID[childId] === undefined) || !isRemovalChange(changeByID[childId]))
      if (_.isEmpty(nonFullyRemovedChildren)) {
        return []
      }
      return [{
        elemID: instance.elemID,
        severity: 'Error',
        message: `Error while trying to remove ${typeName}, because the related instance still exists, please remove it as well`,
        detailedMessage: `Error while trying to remove ${instance.elemID.getFullName()}, because the related instance ${nonFullyRemovedChildren.join(', ')} still exists, please remove it as well`,
      }]
    })
  })
}
