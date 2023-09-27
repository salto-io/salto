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
import { logger } from '@salto-io/logging'
import {
  CORE_ANNOTATIONS,
  Element,
  isField,
  isInstanceElement,
  isObjectType, isReferenceExpression,
  ReadOnlyElementsSource, Values,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'

const log = logger(module)
const { isDefined } = values

type ImportantValue = { value: string; indexed: boolean; highlighted: boolean }
type ImportantValues = ImportantValue[]

const isValidIndexedValueData = (ImportantValue: ImportantValue, valueData: unknown): boolean => {
  if (ImportantValue.indexed !== true) {
    return true
  }
  if (_.isArray(valueData)) {
    return valueData.every(part => _.isString(part) || _.isNumber(part))
  }

  return _.isString(valueData)
    || _.isNumber(valueData)
    || _.isBoolean(valueData)
    || valueData === undefined
    || isReferenceExpression(valueData)
}


const getRelevantImportantValues = (
  importantValues: ImportantValues,
  indexedOnly?: boolean,
  highlightedOnly?: boolean
): ImportantValues => {
  const indexedValues = indexedOnly === true
    ? importantValues.filter(value => value.indexed === true)
    : importantValues
  return highlightedOnly === true
    ? indexedValues.filter(value => value.highlighted === true)
      .filter(value => {
        if (value.value.includes('.')) {
          log.warn(`${value.value} is an inner value, we do not support inner values as highlighted important values`)
          return false
        }
        return true
      })
    : indexedValues
}


const extractImportantValuesFromElement = ({
  importantValues,
  element,
  indexedOnly,
  highlightedOnly,
}:{
  importantValues: ImportantValues
  element: Element
  indexedOnly?: boolean
  highlightedOnly?: boolean
}): Values => {
  if (_.isEmpty(importantValues)) {
    return {}
  }
  const relevantImportantValues = getRelevantImportantValues(importantValues, indexedOnly, highlightedOnly)
  const getFrom = isInstanceElement(element) ? element.value : element.annotations
  const finalImportantValues = relevantImportantValues.map(ImportantValue => {
    const { value } = ImportantValue
    const valueData = _.get(getFrom, value, undefined)
    if (!isValidIndexedValueData(ImportantValue, valueData)) {
      log.warn(`${ImportantValue.value} for element ${element.elemID.getFullName()} is not a primitive value,
      we do not support non primitive values as indexed important values`)
      return undefined
    }
    return { [value]: valueData }
  }).filter(isDefined)

  return finalImportantValues
}

// this function returns the important values of an element. if the element is an instance or a field the important
// values will be calculated from the type. When the flag indexedOnly is on, only values with indexed = true will be
// returned
export const getImportantValues = async ({
  element,
  elementSource,
  indexedOnly,
  highlightedOnly,
}:{
  element: Element
  elementSource?: ReadOnlyElementsSource
  indexedOnly?: boolean
  highlightedOnly?: boolean
}): Promise<Values> => {
  if (isObjectType(element)) {
    const importantValues = element.annotations[CORE_ANNOTATIONS.SELF_IMPORTANT_VALUES]
    return extractImportantValuesFromElement({ importantValues, element, indexedOnly, highlightedOnly })
  }
  if (isField(element) || isInstanceElement(element)) {
    const typeObj = await element.getType(elementSource)
    const importantValues = typeObj?.annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES]
    return extractImportantValuesFromElement({ importantValues, element, indexedOnly, highlightedOnly })
  }
  return {}
}
