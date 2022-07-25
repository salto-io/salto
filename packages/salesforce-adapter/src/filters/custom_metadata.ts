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
import { isInstanceElement, Values, isInstanceChange, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { LocalFilterCreator } from '../filter'
import { isInstanceOfType, isInstanceOfTypeChange } from './utils'
import { XML_ATTRIBUTE_PREFIX } from '../constants'
import { isNull } from '../transformers/transformer'

const log = logger(module)
const { awu } = collections.asynciterable
const { makeArray } = collections.array

type NullValue = {
  // The "attr_" here is actually XML_ATTRIBUTE_PREFIX
  'attr_xsi:nil': 'true'
}
type ServiceMDTRecordFieldValue = {
  field: string
  value?: NullValue | {
    '#text': string
    // The "attr_" here is actually XML_ATTRIBUTE_PREFIX
    'attr_xsi:type': string
  }
}
export type ServiceMDTRecordValue = Values & {
  values: ServiceMDTRecordFieldValue | ServiceMDTRecordFieldValue[]
}

const isServiceMDTRecordFieldValue = (value: Values): value is ServiceMDTRecordFieldValue => (
  _.isString(value.field)
  && (
    value.value === undefined
    || isNull(value.value)
    || _.isString(value.value[`${XML_ATTRIBUTE_PREFIX}xsi:type`])
  )
)

const isServiceMDTRecordValues = (value: Values): value is ServiceMDTRecordValue => (
  'values' in value
  && makeArray(value.values).every(isServiceMDTRecordFieldValue)
)

type NaclMDTRecordFieldValue = {
  field: string
  value?: string
  type?: string
}

export type NaclMDTRecordValue = Values & {
  values: NaclMDTRecordFieldValue[]
}

const isNaclMDTRecordFieldValue = (value: Values): value is NaclMDTRecordFieldValue => (
  _.isString(value.field)
  && (value.value === undefined || _.isString(value.value))
  && (value.type === undefined || _.isString(value.type))
)

const isNaclMDTRecordValues = (value: Values): value is NaclMDTRecordValue => (
  'values' in value
  && Array.isArray(value.values)
  && value.values.every(isNaclMDTRecordFieldValue)
)

const serviceFieldValueToNaclValue = (
  value: ServiceMDTRecordFieldValue
): NaclMDTRecordFieldValue => ({
  field: value.field,
  ...isNull(value.value)
    ? {}
    : { value: _.get(value.value, '#text'), type: _.get(value.value, 'attr_xsi:type') },
})

const naclFieldValueToServiceValue = (
  { field, value, type }: NaclMDTRecordFieldValue
): ServiceMDTRecordFieldValue => ({
  field,
  value: (value === undefined || type === undefined)
    ? { 'attr_xsi:nil': 'true' }
    : { '#text': value, 'attr_xsi:type': type },
})

const additionalNamespaces = Object.fromEntries([
  [`${XML_ATTRIBUTE_PREFIX}xmlns:xsd`, 'http://www.w3.org/2001/XMLSchema'],
  [`${XML_ATTRIBUTE_PREFIX}xmlns:xsi`, 'http://www.w3.org/2001/XMLSchema-instance'],
])

const formatRecordValuesForNacl = (values: Values): Values => {
  if (isServiceMDTRecordValues(values)) {
    return _.merge(
      _.omit(
        values,
        'values', Object.keys(additionalNamespaces),
      ),
      { values: makeArray(values.values).map(serviceFieldValueToNaclValue) }
    )
  }
  log.info('Unexpected value format in %s, leaving instance values as-is', values.fullName)
  return values
}

const formatRecordValuesForService = (values: Values): Values => {
  if (isNaclMDTRecordValues(values)) {
    return _.merge(
      _.omit(values, 'values'),
      { values: values.values.map(naclFieldValueToServiceValue) },
      additionalNamespaces,
    )
  }
  log.info('Unexpected value format in %s, leaving instance values as-is', values.fullName)
  return values
}

const filterCreator: LocalFilterCreator = () => ({
  onFetch: async elements => {
    await awu(elements)
      .filter(isInstanceElement)
      .filter(isInstanceOfType('CustomMetadata'))
      .forEach(instance => {
        instance.value = formatRecordValuesForNacl(instance.value)
      })
  },

  preDeploy: async changes => {
    await awu(changes)
      .filter(isInstanceChange)
      .filter(isInstanceOfTypeChange('CustomMetadata'))
      .filter(isAdditionOrModificationChange)
      .forEach(change => {
        change.data.after.value = formatRecordValuesForService(change.data.after.value)
      })
  },

  onDeploy: async changes => {
    await awu(changes)
      .filter(isInstanceChange)
      .filter(isInstanceOfTypeChange('CustomMetadata'))
      .filter(isAdditionOrModificationChange)
      .forEach(change => {
        change.data.after.value = formatRecordValuesForNacl(change.data.after.value)
      })
  },
})

export default filterCreator
