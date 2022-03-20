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
import { Change, Field, getChangeData, InstanceElement, isInstanceChange, isInstanceElement, isListType, isPrimitiveType, ObjectType, PrimitiveTypes, TypeElement, Value, Values } from '@salto-io/adapter-api'
import { collections, promises } from '@salto-io/lowerdash'
import { ConfigRecord, SelectOption } from '../client/suiteapp_client/types'
import { SELECT_OPTION } from '../constants'
import { FilterWith } from '../filter'
import { isConfigInstance } from '../types'

const log = logger(module)
const { awu } = collections.asynciterable
const { makeArray } = collections.array
const { mapValuesAsync } = promises.object

const BOOLEAN_TRUE = 'T'
const BOOLEAN_FALSE = 'F'

const MULTISELECT_DELIMITER = '\u0005'

const isSelectFieldType = (fieldType: TypeElement): boolean =>
  fieldType.elemID.typeName === SELECT_OPTION

const isMultiSelectFieldType = (fieldType: TypeElement): boolean =>
  isListType(fieldType) && fieldType.refInnerType.elemID.typeName === SELECT_OPTION

const transformPrimitive = (
  value: Value,
  primitive: PrimitiveTypes,
  field: Field
): Value => {
  switch (primitive) {
    case PrimitiveTypes.BOOLEAN:
      if (![BOOLEAN_TRUE, BOOLEAN_FALSE].includes(value)) {
        log.warn('received unknown value in boolean field \'%s\': %o', field.elemID.getFullName(), value)
        return value
      }
      return value === BOOLEAN_TRUE
    case PrimitiveTypes.NUMBER:
      if (Number.isNaN(Number(value))) {
        log.warn('received unknown value in number field \'%s\': %o', field.elemID.getFullName(), value)
        return value
      }
      return Number(value)
    default:
      if (!_.isString(value)) {
        log.warn('received unknown value in string field \'%s\': %o', field.elemID.getFullName(), value)
      }
      return value
  }
}

const getConfigInstanceValue = async (
  { configType, fieldsDef, data }: ConfigRecord,
  type: ObjectType
): Promise<Values> => {
  const selectOptionsMap = _.keyBy(fieldsDef, field => field.id)
  const getSelectOptionValue = (value: Value, field: Field): SelectOption =>
    selectOptionsMap[field.name].selectOptions?.find(option => option.value === value) ?? { value, text: '' }

  const values: Values = { ...data.fields, configType }
  return mapValuesAsync(values, async (value, fieldName) => {
    const field = type.fields[fieldName]
    if (!field) return undefined

    const fieldType = await field.getType()
    if (isSelectFieldType(fieldType)) {
      return getSelectOptionValue(value, field)
    }
    if (isMultiSelectFieldType(fieldType)) {
      const items = _.isString(value) ? value.split(MULTISELECT_DELIMITER) : [value]
      return items.map(item => getSelectOptionValue(item, field))
    }
    return isPrimitiveType(fieldType)
      ? transformPrimitive(value, fieldType.primitive, field)
      : undefined
  })
}

const transformValuesForDeploy = async (change: Change<InstanceElement>): Promise<void> =>
  awu(Object.values(change.data)).forEach(
    async instance => {
      const type = await instance.getType()
      instance.value = await mapValuesAsync(instance.value, async (value, fieldName) => {
        const field = type.fields[fieldName]
        if (!field) return value

        const fieldType = await field.getType()
        if (isSelectFieldType(fieldType)) {
          return value.value
        }
        if (isMultiSelectFieldType(fieldType)) {
          return makeArray(value).map(item => item.value).join(MULTISELECT_DELIMITER)
        }
        return value
      })
    }
  )

const filterCreator = (): FilterWith<'onFetch' | 'preDeploy'> => ({
  onFetch: async elements => {
    await awu(elements)
      .filter(isInstanceElement)
      .filter(instance => isConfigInstance(instance) && instance.value.configRecord !== undefined)
      .forEach(async instance => {
        instance.value = await getConfigInstanceValue(
          instance.value.configRecord, await instance.getType()
        )
      })
  },
  preDeploy: async changes => {
    await awu(changes)
      .filter(isInstanceChange)
      .filter(async change => isConfigInstance(getChangeData(change)))
      .forEach(transformValuesForDeploy)
  },
})

export default filterCreator
