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
import { InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { ISSUE_TYPE_NAME, PRIORITY_TYPE_NAME, PROJECT_TYPE, RESOLUTION_TYPE_NAME, STATUS_TYPE_NAME, STATUS_CATEGORY_TYPE_NAME } from '../../constants'
import { FIELD_TYPE_NAME } from '../fields/constants'
import { isJqlFieldDetails, JqlFieldDetails } from './types'

const JQL_NAME_TO_FIELD_NAME: Record<string, string | undefined> = {
  issuetype: 'issue type',
  type: 'issue type',
  statuscategory: 'status category',
}

const CONTEXT_TYPE_TO_FIELD: Record<string, string> = {
  [FIELD_TYPE_NAME]: 'name',
  [PROJECT_TYPE]: 'key',
  [STATUS_TYPE_NAME]: 'name',
  [RESOLUTION_TYPE_NAME]: 'name',
  [PRIORITY_TYPE_NAME]: 'name',
  [ISSUE_TYPE_NAME]: 'name',
  [STATUS_CATEGORY_TYPE_NAME]: 'name',
}

export const generateJqlContext = (
  instances: InstanceElement[],
): Record<string, Record<string, InstanceElement>> =>
  _(instances)
    .filter(instance => instance.elemID.typeName in CONTEXT_TYPE_TO_FIELD)
    .groupBy(instance => instance.elemID.typeName)
    .mapValues(instanceGroup => _.keyBy(
      instanceGroup.filter(instance => _.isString(instance.value.name)),
      instance => {
        const fieldName = CONTEXT_TYPE_TO_FIELD[instance.elemID.typeName]
        return instance.value[fieldName].toLowerCase() as string
      },
    ))
    .value()

const getJqlValues = (
  jqlComponent: JqlFieldDetails
): string[] => [
  jqlComponent.operand?.value,
  ...(jqlComponent.operand?.values?.map(({ value }) => value) ?? []),
].filter(values.isDefined)

export const extractReferences = (
  jqlComponent: unknown,
  jqlContext: Record<string, Record<string, InstanceElement>>
): ReferenceExpression[] => {
  if (typeof jqlComponent !== 'object' || jqlComponent === null) {
    return []
  }

  if (!isJqlFieldDetails(jqlComponent)) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return Object.values(jqlComponent).flatMap(val => extractReferences(val, jqlContext))
  }

  const jqlFieldName = jqlComponent.field.name.toLowerCase()

  const fieldName = JQL_NAME_TO_FIELD_NAME[jqlFieldName] ?? jqlFieldName
  const fieldInstance = jqlContext[FIELD_TYPE_NAME]?.[fieldName]

  if (fieldInstance === undefined) {
    return []
  }

  const references = [new ReferenceExpression(fieldInstance.elemID, fieldInstance)]

  const nameToInstance = jqlContext[fieldInstance.value.name.replace(/\s+/g, '')]
  if (nameToInstance !== undefined) {
    const valueNames = getJqlValues(jqlComponent)

    references.push(
      ...valueNames
        .map(name => nameToInstance[name.toLowerCase()])
        .filter(values.isDefined)
        .map(instance => new ReferenceExpression(instance.elemID, instance))
    )
  }

  return references
}
