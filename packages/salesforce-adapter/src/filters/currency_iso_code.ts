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
import { Element, isObjectType, ObjectType, ElemID, ListType, InstanceElement, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { pathNaclCase } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { FilterWith } from '../filter'
import { SALESFORCE, FIELD_ANNOTATIONS, RECORDS_PATH, SETTINGS_PATH, CUSTOM_VALUE } from '../constants'
import { Types, getTypePath } from '../transformers/transformer'


const CURRENCY_CODE_TYPE_NAME = 'CurrencyIsoCodes'
const currencyCodeType = new ObjectType(
  {
    elemID: new ElemID(SALESFORCE, CURRENCY_CODE_TYPE_NAME),
    fields: {
      [FIELD_ANNOTATIONS.VALUE_SET]: { refType: new ListType(Types.valueSetType) },
    },
    annotations: {
      [CORE_ANNOTATIONS.CREATABLE]: false,
      [CORE_ANNOTATIONS.DELETABLE]: false,
      [CORE_ANNOTATIONS.UPDATABLE]: false,
    },
    isSettings: true,
  }
)

const CURRENCY_CODE_FIELD_NAME = 'CurrencyIsoCode'

type ValueSet = object

type CurrencyIsoCodeType = ObjectType & {
  fields: {
    [CURRENCY_CODE_FIELD_NAME]: {
      annotations: {
        valueSet?: ValueSet[]
        valueSetName?: string
      }
    }
  }
}

const VALUE_SET_SCHEMA = Joi.object({
  valueSet: Joi.array().items({
    [CUSTOM_VALUE.FULL_NAME]: Joi.string().required(),
    [CUSTOM_VALUE.DEFAULT]: Joi.boolean().required(),
    [CUSTOM_VALUE.LABEL]: Joi.string().required(),
    [CUSTOM_VALUE.IS_ACTIVE]: Joi.boolean().required(),
  }).required(),
}).unknown(true).required()

const TYPE_WITH_CURRENCY_ISO_CODE_SCHEMA = Joi.object({
  fields: Joi.object({
    [CURRENCY_CODE_FIELD_NAME]: Joi.object({
      annotations: VALUE_SET_SCHEMA,
    }).unknown(true).required(),
  }).unknown(true).required(),
}).unknown(true).required()

const isTypeWithCurrencyIsoCode = (elem: ObjectType): elem is CurrencyIsoCodeType => {
  const { error } = TYPE_WITH_CURRENCY_ISO_CODE_SCHEMA.validate(elem)
  return error === undefined
}

const transformCurrencyIsoCodes = (element: CurrencyIsoCodeType): void => {
  const valueSetName = currencyCodeType.elemID.getFullName()

  delete element.fields.CurrencyIsoCode.annotations.valueSet
  element.fields.CurrencyIsoCode.annotations.valueSetName = valueSetName
}

const createCurrencyCodesElements = (supportedCurrencies?: ValueSet): Element[] => {
  const currencyCodesIntance = new InstanceElement(
    ElemID.CONFIG_NAME,
    currencyCodeType,
    { [FIELD_ANNOTATIONS.VALUE_SET]: supportedCurrencies || [] },
    [SALESFORCE, RECORDS_PATH, SETTINGS_PATH, pathNaclCase(currencyCodeType.elemID.name)],
  )

  currencyCodeType.path = getTypePath(currencyCodeType)

  return [currencyCodeType, currencyCodesIntance]
}


/**
 * Build a global list of available currency code, and a replace all the explicit ValueSets
 * with ValueSetName which points to it
 */
const filterCreator = (): FilterWith<'onFetch'> => ({
  onFetch: async (elements: Element[]) => {
    const affectedElements = elements.filter(isObjectType).filter(isTypeWithCurrencyIsoCode)
    elements.push(...createCurrencyCodesElements(
      affectedElements[0]?.fields.CurrencyIsoCode.annotations.valueSet as ValueSet[]
    ))
    affectedElements.forEach(transformCurrencyIsoCodes)
  },
})

export default filterCreator
