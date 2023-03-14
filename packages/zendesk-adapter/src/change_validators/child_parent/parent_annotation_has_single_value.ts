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
import { ChangeValidator, getChangeData, isInstanceElement, CORE_ANNOTATIONS,
  isReferenceExpression } from '@salto-io/adapter-api'
import { ZendeskApiConfig } from '../../config'
import { getChildAndParentTypeNames } from './utils'

export const parentAnnotationToHaveSingleValueValidatorCreator = (
  apiConfig: ZendeskApiConfig,
): ChangeValidator => async changes => {
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
