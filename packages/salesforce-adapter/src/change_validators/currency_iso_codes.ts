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
import {
  Change,
  ChangeError,
  ChangeValidator, ElemID, getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange, isInstanceElement,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import {
  CURRENCY_CODE_TYPE_NAME,
  CURRENCY_ISO_CODE,
  FIELD_ANNOTATIONS,
  INSTANCE_FULL_NAME_FIELD,
  SALESFORCE,
} from '../constants'

const log = logger(module)

const { awu } = collections.asynciterable
const { isDefined } = values
const { makeArray } = collections.array

type CurrencyIsoCodesInstance = InstanceElement & {
  value: InstanceElement['value'] & {
    [FIELD_ANNOTATIONS.VALUE_SET]: {
      [INSTANCE_FULL_NAME_FIELD]: string
    }[]
  }
}

type InstanceWithCurrencyIsoCode = InstanceElement & {
  value: InstanceElement['value'] & {
    [CURRENCY_ISO_CODE]: string
  }
}

const isInstanceWithCurrencyIsoCode = (instance: InstanceElement): instance is InstanceWithCurrencyIsoCode => (
  _.isString(instance.value[CURRENCY_ISO_CODE])
)

const isCurrencyIsoCodesInstance = (instance: InstanceElement): instance is CurrencyIsoCodesInstance => {
  const valueSet = instance.value[FIELD_ANNOTATIONS.VALUE_SET]
  return isDefined(valueSet) && makeArray(valueSet)
    .every(entry => _.isString(entry[INSTANCE_FULL_NAME_FIELD]))
}

const createOrgHasNoMultiCurrencyEnabledError = (
  { elemID }: InstanceElement
): ChangeError => ({
  elemID,
  message: 'Organization doesnt support multi currency',
  detailedMessage: 'Cannot deploy instance with CurrencyIsoCode field to organization that does not support multi currencies',
  severity: 'Error',
})

const createInstanceHasUnsupportedCurrencyError = (
  instance: InstanceWithCurrencyIsoCode,
  supportedIsoCodes: string[],
): ChangeError => ({
  elemID: instance.elemID,
  message: `Unsupported currency ${instance.value[CURRENCY_ISO_CODE]}`,
  detailedMessage: `Please set to one of the supported currencies or enable the currency you need directly in salesforce. Current supported currencies are: ${supportedIsoCodes}`,
  severity: 'Error',
})

const changeValidator: ChangeValidator = async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    return []
  }
  const changesWithCurrencyIsoCode = await awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => isInstanceWithCurrencyIsoCode(getChangeData(change)))
    .toArray() as Change<InstanceWithCurrencyIsoCode>[]

  if (_.isEmpty(changesWithCurrencyIsoCode)) {
    return []
  }

  const currencyIsoCodesInstance = await elementsSource.get(new ElemID(SALESFORCE, CURRENCY_CODE_TYPE_NAME, 'instance'))
  if (currencyIsoCodesInstance === undefined || !isInstanceElement(currencyIsoCodesInstance)) {
    return changesWithCurrencyIsoCode
      .map(getChangeData)
      .map(createOrgHasNoMultiCurrencyEnabledError)
  }

  if (!isCurrencyIsoCodesInstance(currencyIsoCodesInstance)) {
    log.warn('CurrencyIsoCodes instance is invalid. Received: %o', currencyIsoCodesInstance)
    return []
  }
  const supportedIsoCodes = currencyIsoCodesInstance.value[FIELD_ANNOTATIONS.VALUE_SET]
    .map(entry => entry[INSTANCE_FULL_NAME_FIELD])

  return changesWithCurrencyIsoCode
    .map(getChangeData)
    .filter(instance => !supportedIsoCodes.includes(instance.value[CURRENCY_ISO_CODE]))
    .map(instance => createInstanceHasUnsupportedCurrencyError(instance, supportedIsoCodes))
}


export default changeValidator
