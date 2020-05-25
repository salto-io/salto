/*
*                      Copyright 2020 Salto Labs Ltd.
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
import {
  ElemID, Field, InstanceElement, isListType, isPrimitiveType, ObjectType, PrimitiveType,
  PrimitiveTypes, Value, Values, isObjectType,
} from '@salto-io/adapter-api'
import {
  applyRecursive, MapKeyFunc, mapKeysRecursive, naclCase, TransformFunc, transformValues,
} from '@salto-io/adapter-utils'
import _ from 'lodash'
import {
  ADDRESS_FORM, ENTRY_FORM, TRANSACTION_FORM, IS_ATTRIBUTE, IS_NAME, NETSUITE, RECORDS_PATH,
  SCRIPT_ID,
} from './constants'
import { ATTRIBUTE_PREFIX, CDATA_TAG_NAME, CustomizationInfo } from './client/client'
import { fieldTypes } from './types/field_types'
import { customTypes } from './types'


const XML_TRUE_VALUE = 'T'
const XML_FALSE_VALUE = 'F'

const castToListRecursively = (
  type: ObjectType,
  values: Values,
): void => {
  // Cast all lists to list
  const castLists = (field: Field, value: Value): Value => {
    if (isListType(field.type) && !_.isArray(value)) {
      return [value]
    }
    return value
  }
  applyRecursive(type, values, castLists)
}

export const createInstanceElement = (values: Values, type: ObjectType):
  InstanceElement => {
  const getInstanceName = (transformedValues: Values): string => {
    const nameField = Object.values(type.fields)
      .find(f => f.annotations[IS_NAME]) as Field
    // fallback to SCRIPT_ID since sometimes the IS_NAME field is not mandatory
    // (e.g. customrecordtype of customsegment)
    return naclCase(transformedValues[nameField.name] ?? transformedValues[SCRIPT_ID])
  }

  const transformPrimitive: TransformFunc = ({ value, field }) => {
    const fieldType = field?.type
    if (!isPrimitiveType(fieldType)) {
      return value
    }

    // We sometimes get empty strings that we want to filter out
    if (value === '') {
      return undefined
    }

    switch (fieldType.primitive) {
      case PrimitiveTypes.NUMBER:
        return Number(value)
      case PrimitiveTypes.BOOLEAN:
        return value === XML_TRUE_VALUE
      default:
        return String(value)
    }
  }

  const transformAttributeKey: MapKeyFunc = ({ key }) =>
    (key.startsWith(ATTRIBUTE_PREFIX) ? key.slice(ATTRIBUTE_PREFIX.length) : key)

  const valuesWithTransformedAttrs = mapKeysRecursive(values, transformAttributeKey)
  const transformedValues = transformValues({
    values: valuesWithTransformedAttrs,
    type,
    transformFunc: transformPrimitive,
  }) as Values
  castToListRecursively(type, transformedValues)
  const instanceName = getInstanceName(transformedValues)
  return new InstanceElement(instanceName, type, transformedValues,
    [NETSUITE, RECORDS_PATH, type.elemID.name, instanceName])
}

export const restoreAttributes = (values: Values, type: ObjectType, instancePath: ElemID):
  Values => {
  const allAttributesPaths = new Set<string>()
  const createPathSetCallback: TransformFunc = ({ value, field, path }) => {
    if (path && field && field.annotations[IS_ATTRIBUTE]) {
      allAttributesPaths.add(path.getFullName())
    }
    return value
  }

  transformValues({
    values,
    type,
    transformFunc: createPathSetCallback,
    pathID: instancePath,
    strict: false,
  })

  const restoreAttributeFunc: MapKeyFunc = ({ key, pathID }) => {
    if (pathID && allAttributesPaths.has(pathID.getFullName())) {
      return ATTRIBUTE_PREFIX + key
    }
    return key
  }

  return mapKeysRecursive(values, restoreAttributeFunc, instancePath)
}

const sortValuesBasedOnType = (typeName: string, values: Values, instancePath: ElemID): Values => {
  // we use customTypes[typeName] and not instance.type since it preserves fields order
  const topLevelType = customTypes[typeName]

  const sortValues: TransformFunc = ({ field, value, path }) => {
    const type = field?.type
      ?? (path && path.isEqual(instancePath) ? topLevelType : undefined)
    if (isObjectType(type) && _.isPlainObject(value)) {
      const fieldsOrder = Object.keys(type.fields)
      return _.fromPairs(fieldsOrder
        .map(fieldName => [fieldName, value[fieldName]])
        .filter(([_fieldName, val]) => !_.isUndefined(val)))
    }
    return value
  }

  return transformValues(
    { type: topLevelType, values, transformFunc: sortValues, pathID: instancePath, strict: true }
  ) ?? {}
}

// According to https://{account_id}.app.netsuite.com/app/help/helpcenter.nl?fid=section_1497980303.html
// there are types that their instances XMLs should be sent in a predefined order
const shouldSortValues = (typeName: string): boolean =>
  [ADDRESS_FORM, ENTRY_FORM, TRANSACTION_FORM].includes(typeName)

export const toCustomizationInfo = (instance: InstanceElement): CustomizationInfo => {
  const transformPrimitive: TransformFunc = ({ value, field }) => {
    const fieldType = field?.type
    if (!isPrimitiveType(fieldType)) {
      return value
    }
    if (fieldType.primitive === PrimitiveTypes.BOOLEAN) {
      return value ? XML_TRUE_VALUE : XML_FALSE_VALUE
    }
    if (fieldType.isEqual(fieldTypes.cdata as PrimitiveType)) {
      return { [CDATA_TAG_NAME]: value }
    }
    return String(value)
  }

  const transformedValues = transformValues({
    values: instance.value,
    type: instance.type,
    transformFunc: transformPrimitive,
  }) || {}

  const typeName = instance.type.elemID.name

  const values = shouldSortValues(typeName)
    ? sortValuesBasedOnType(typeName, transformedValues, instance.elemID)
    : transformedValues
  return { typeName, values: restoreAttributes(values, instance.type, instance.elemID) }
}
