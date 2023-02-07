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
import { logger } from '@salto-io/logging'
import { BuiltinTypes, Change, CORE_ANNOTATIONS, Field, getChangeData, InstanceElement, isInstanceChange, isInstanceElement, isListType, isObjectType, isPrimitiveType, ListType, ObjectType, PrimitiveTypes, TypeElement, Value, Values } from '@salto-io/adapter-api'
import { collections, promises } from '@salto-io/lowerdash'
import { ConfigRecord, SelectOption } from '../client/suiteapp_client/types'
import { SELECT_OPTION } from '../constants'
import { FilterWith } from '../filter'
import { isSuiteAppConfigInstance, isSuiteAppConfigType } from '../types'

const log = logger(module)
const { awu } = collections.asynciterable
const { makeArray } = collections.array
const { mapValuesAsync } = promises.object

const CHECKBOX_TYPE = 'checkbox'
const INTEGER_TYPE = 'integer'
const SELECT_TYPE = 'select'
const MULTISELECT_TYPE = 'multiselect'
const FIELD_TYPES_TO_OMIT = [
  'never',
  'help',
  'inlinehtml',
  'label',
  'text',
  'textarea',
]

const BOOLEAN_TRUE = 'T'
const BOOLEAN_FALSE = 'F'

const VALUE_UNDEFINED = 'undefined'

const MULTISELECT_DELIMITER = '\u0005'

const isSelectFieldType = (fieldType: TypeElement): boolean =>
  fieldType.elemID.typeName === SELECT_OPTION

const isMultiSelectFieldType = (fieldType: TypeElement): boolean =>
  isListType(fieldType) && fieldType.refInnerType.elemID.typeName === SELECT_OPTION

const transformType = (
  configType: ObjectType,
  selectOptionType: ObjectType
): void => {
  if (!configType.annotations.fieldsDef) {
    return
  }

  const toFieldType = (type: string): TypeElement => {
    switch (type) {
      case CHECKBOX_TYPE:
        return BuiltinTypes.BOOLEAN
      case INTEGER_TYPE:
        return BuiltinTypes.NUMBER
      case SELECT_TYPE:
        return selectOptionType
      case MULTISELECT_TYPE:
        return new ListType(selectOptionType)
      default:
        return BuiltinTypes.STRING
    }
  }

  configType.fields = _(configType.annotations.fieldsDef)
    .filter(field => !FIELD_TYPES_TO_OMIT.includes(field.type))
    .keyBy(field => field.id)
    .mapValues(({ id, label, type }) =>
      new Field(configType, id, toFieldType(type), { label, type }))
    .value()

  configType.fields.configType = new Field(configType, 'configType', BuiltinTypes.STRING, {
    [CORE_ANNOTATIONS.REQUIRED]: true,
    [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
  })

  configType.annotations = {}
}

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
  const fieldIdToFieldDef = _.keyBy(fieldsDef, field => field.id)
  const getSelectOptionValue = (value: Value, field: Field): SelectOption =>
    fieldIdToFieldDef[field.name].selectOptions?.find(option => option.value === value) ?? { value, text: '' }

  const values: Values = { ...data.fields, configType }
  return mapValuesAsync(values, async (value, fieldName) => {
    if (value === VALUE_UNDEFINED) return undefined

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
  name: 'suiteAppConfigElementsFilter',
  onFetch: async elements => {
    const [selectOptionType] = elements
      .filter(isObjectType)
      .filter(type => type.elemID.name === SELECT_OPTION)

    await awu(elements)
      .filter(isObjectType)
      .filter(type => isSuiteAppConfigType(type))
      .forEach(type => {
        transformType(type, selectOptionType)
      })

    await awu(elements)
      .filter(isInstanceElement)
      .filter(instance => isSuiteAppConfigInstance(instance))
      .forEach(async instance => {
        instance.value = await getConfigInstanceValue(
          instance.value.configRecord, await instance.getType()
        )
      })
  },
  preDeploy: async changes => {
    await awu(changes)
      .filter(isInstanceChange)
      .filter(async change => isSuiteAppConfigInstance(getChangeData(change)))
      .forEach(transformValuesForDeploy)
  },
})

export default filterCreator
