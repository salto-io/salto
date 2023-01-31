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
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { Change, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { conditionFieldValue, isCorrectConditions } from './filters/utils'

const { awu } = collections.asynciterable

export type ValueReplacer = (instance: InstanceElement, mapping?: Record<string, string>) => ElemID[]

type FieldsParams = {
  fieldName: string[]
  fieldsToReplace: { name: string; valuePath?: string[] }[]
}

export const replaceConditionsAndActionsCreator = (
  params: FieldsParams[],
  isIdNumber = false,
): ValueReplacer => (instance, mapping) => (
  params.flatMap(replacerParams => {
    const conditions = _.get(instance.value, replacerParams.fieldName)
    const { typeName } = instance.elemID
    // Coditions can be undefined - in that case, we don't want to log a warning
    if (conditions === undefined
      || !isCorrectConditions(conditions, typeName)) {
      return []
    }
    return conditions
      .flatMap((condition, i) => {
        const fieldNamesToReplace = replacerParams.fieldsToReplace.map(f => f.name)
        const conditionValue = conditionFieldValue(condition, typeName)
        if (!fieldNamesToReplace.includes(conditionValue)) {
          return []
        }
        const valueRelativePath = replacerParams.fieldsToReplace
          .find(f => f.name === conditionValue)?.valuePath ?? ['value']
        const value = _.get(condition, valueRelativePath)?.toString()
        if (value === undefined) {
          return []
        }
        const valuePath = instance.elemID
          .createNestedID(...replacerParams.fieldName, i.toString(), ...valueRelativePath)
        if (mapping !== undefined) {
          const newValue = Object.prototype.hasOwnProperty.call(mapping, value) ? mapping[value] : undefined
          if (newValue !== undefined) {
            _.set(condition, valueRelativePath, (isIdNumber && Number.isInteger(Number(newValue)))
              ? Number(newValue)
              : newValue)
          }
        }
        return [valuePath]
      })
  })
)

export const fieldReplacer = (fields: string[]): ValueReplacer => (instance, mapping) => (
  fields
    .flatMap(field => {
      const fieldValue = _.get(instance.value, field)
      if (fieldValue === undefined) {
        return []
      }
      const fieldValuePath = instance.elemID.createNestedID(field)
      const values = (_.isArray(fieldValue) ? fieldValue : [fieldValue])
        .map(v => v.toString())
      if (mapping !== undefined) {
        values.forEach((value, i) => {
          const newValue = Object.prototype.hasOwnProperty.call(mapping, value) ? mapping[value] : undefined
          if (newValue !== undefined) {
            _.set(
              instance.value,
              _.isArray(fieldValue) ? [field, i] : field,
              (Number.isInteger(Number(newValue))) ? Number(newValue) : newValue
            )
          }
        })
      }
      return _.isArray(fieldValue)
        ? values.map((_value, i) => fieldValuePath.createNestedID(i.toString()))
        : [fieldValuePath]
    })
)

export const deployModificationFunc = async (
  changes: Change<InstanceElement>[],
  mapping: Record<string, string>,
  typeNameToReplacer: Record<string, ValueReplacer>
): Promise<void> => {
  await awu(changes).forEach(async change => {
    await applyFunctionToChangeData<Change<InstanceElement>>(
      change,
      instance => {
        typeNameToReplacer[instance.elemID.typeName]?.(instance, mapping)
        return instance
      }
    )
  })
}
