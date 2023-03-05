/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ChangeValidator, getChangeData, isInstanceChange, isModificationChange, isRemovalChange, ChangeError } from '@salto-io/adapter-api'
import { ZendeskApiConfig } from '../../config'
import { getChildAndParentTypeNames, getRemovedAndAddedChildren, ChildParentRelationship } from './utils'
import { FIELD_TYPE_NAMES } from '../../constants'

const WARNING_ONLY_PARENT_TYPES = FIELD_TYPE_NAMES

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
    return relevantRelations.flatMap((relation: ChildParentRelationship): ChangeError[] => {
      const nonFullyRemovedChildren = getRemovedAndAddedChildren(change, relation.fieldName)
        .removed
        .filter(childId =>
          (changeByID[childId.getFullName()] === undefined)
          || !isRemovalChange(changeByID[childId.getFullName()]))
      if (_.isEmpty(nonFullyRemovedChildren)) {
        return []
      }
      if (WARNING_ONLY_PARENT_TYPES.includes(instance.elemID.typeName)) {
        return [{
          elemID: instance.elemID,
          severity: 'Warning',
          message: `Removing ${relation.fieldName} from ${typeName} will also remove related instances`,
          detailedMessage: `The following ${relation.fieldName} are no longer referenced from ${typeName} "${instance.elemID.name}", but the instances still exist:\n${nonFullyRemovedChildren.map(id => `- ${id.name}`).join('\n')}\n\nIf you continue with the deploy they will be removed from the service, and any references to them will break. It is recommended to remove these options in Salto first and deploy again.`,
        }]
      }
      return [{
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Cannot remove this element since it is referenced by its children',
        detailedMessage: `Cannot remove this element since it is referred to by the following children: ${nonFullyRemovedChildren.map(e => e.getFullName()).join(', ')}
Please make sure to remove these references in order to remove the element`,
      }]
    })
  })
}
