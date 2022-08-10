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
import { collections } from '@salto-io/lowerdash'
import { elements } from '@salto-io/adapter-components'
import { AdditionChange, InstanceElement, isAdditionChange, isInstanceElement, isReferenceExpression, ModificationChange } from '@salto-io/adapter-api'
import { ZendeskApiConfig } from '../../config'


export type ChildParentRelationship = {
  parent: string
  child: string
  fieldName: string
}

const ADDITIONAL_CHILD_PARENT_RELATIONSHIPS: ChildParentRelationship[] = [
  { parent: 'macro', child: 'macro_attachment', fieldName: 'attachments' },
  { parent: 'brand', child: 'brand_logo', fieldName: 'logo' },
]

export const getChildAndParentTypeNames = (config: ZendeskApiConfig): ChildParentRelationship[] => {
  const parentTypes = Object.keys(
    _.omitBy(config.types, typeConfig => _.isEmpty(typeConfig.transformation?.standaloneFields))
  )
  return parentTypes.flatMap(parentType => {
    const fields = config.types[parentType].transformation?.standaloneFields ?? []
    return fields.map(field => {
      const fullChildTypeName = elements.ducktype.toNestedTypeName(parentType, field.fieldName)
      const childTypeName = Object.entries(config.types).find(([_typeName, typeConfig]) =>
        typeConfig.transformation?.sourceTypeName === fullChildTypeName)?.[0] ?? fullChildTypeName
      return { parent: parentType, child: childTypeName, fieldName: field.fieldName }
    })
  }).concat(ADDITIONAL_CHILD_PARENT_RELATIONSHIPS)
}

const getIdsFromReferenceExpressions = (values: unknown): string[] => {
  // Handling with list-type fields as well
  const { makeArray } = collections.array
  return makeArray(values)
    .filter(isReferenceExpression)
    .map(ref => ref.value)
    .filter(isInstanceElement)
    .map(inst => inst.elemID.getFullName())
}

export const getRemovedAndAddedChildren = (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>, fieldName: string
): { removed: string[]; added: string[] } => {
  const childrenBefore = isAdditionChange(change)
    ? []
    : getIdsFromReferenceExpressions(change.data.before.value[fieldName])
  const childrenAfter = getIdsFromReferenceExpressions(change.data.after.value[fieldName])
  return {
    removed: childrenBefore.filter(child => !childrenAfter.includes(child)),
    added: childrenAfter.filter(child => !childrenBefore.includes(child)),
  }
}
