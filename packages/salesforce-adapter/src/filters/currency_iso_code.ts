/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Element,
  isObjectType,
  ObjectType,
  ElemID,
  ListType,
  InstanceElement,
  ReferenceExpression,
  isAdditionChange,
  isObjectTypeChange,
  getChangeData,
} from '@salto-io/adapter-api'
import Joi from 'joi'
import { FilterCreator } from '../filter'
import {
  SALESFORCE,
  FIELD_ANNOTATIONS,
  RECORDS_PATH,
  SETTINGS_PATH,
  CUSTOM_VALUE,
  CURRENCY_CODE_TYPE_NAME,
  CURRENCY_ISO_CODE,
} from '../constants'
import { Types, getTypePath } from '../transformers/transformer'

const currencyCodeType = new ObjectType({
  elemID: new ElemID(SALESFORCE, CURRENCY_CODE_TYPE_NAME),
  fields: {
    [FIELD_ANNOTATIONS.VALUE_SET]: {
      refType: new ListType(Types.valueSetType),
    },
  },
  isSettings: true,
  path: getTypePath(CURRENCY_CODE_TYPE_NAME),
})

type ValueSet = {}

type CurrencyIsoCodeType = ObjectType & {
  fields: {
    [CURRENCY_ISO_CODE]: {
      annotations: {
        valueSet?: ValueSet[]
        valueSetName?: ReferenceExpression
      }
    }
  }
}

const VALUE_SET_SCHEMA = Joi.object({
  valueSet: Joi.array()
    .items({
      [CUSTOM_VALUE.FULL_NAME]: Joi.string().required(),
      [CUSTOM_VALUE.DEFAULT]: Joi.boolean().required(),
      [CUSTOM_VALUE.LABEL]: Joi.string().required(),
      [CUSTOM_VALUE.IS_ACTIVE]: Joi.boolean().required(),
    })
    .required(),
})
  .unknown(true)
  .required()

const isTypeWithCurrencyIsoCode = (elem: ObjectType): elem is CurrencyIsoCodeType => {
  if (!Object.prototype.hasOwnProperty.call(elem.fields, CURRENCY_ISO_CODE)) {
    return false
  }
  const { error } = VALUE_SET_SCHEMA.validate(elem.fields[CURRENCY_ISO_CODE]?.annotations)
  return error === undefined
}

const transformCurrencyIsoCodes = (element: CurrencyIsoCodeType, currencyCodeInstance: InstanceElement): void => {
  const currencyIsoCodesRef = new ReferenceExpression(currencyCodeInstance.elemID, currencyCodeInstance)

  delete element.fields.CurrencyIsoCode.annotations.valueSet
  element.fields.CurrencyIsoCode.annotations.valueSetName = currencyIsoCodesRef
}

const createCurrencyCodesInstance = (supportedCurrencies?: ValueSet): InstanceElement =>
  new InstanceElement(ElemID.CONFIG_NAME, currencyCodeType, { [FIELD_ANNOTATIONS.VALUE_SET]: supportedCurrencies }, [
    SALESFORCE,
    RECORDS_PATH,
    SETTINGS_PATH,
    currencyCodeType.elemID.name,
  ])

/**
 * Build a global list of available currency code, and a replace all the explicit ValueSets
 * with ValueSetName which points to it
 */
const filterCreator: FilterCreator = ({ config }) => ({
  name: 'currencyIsoCodeFilter',
  onFetch: async (elements: Element[]) => {
    const affectedElements = elements.filter(isObjectType).filter(isTypeWithCurrencyIsoCode)
    if (affectedElements.length === 0) {
      return
    }

    const currencyCodeInstance = createCurrencyCodesInstance(
      affectedElements[0].fields.CurrencyIsoCode.annotations.valueSet,
    )

    elements.push(currencyCodeType, currencyCodeInstance)
    affectedElements.forEach(element => transformCurrencyIsoCodes(element, currencyCodeInstance))
  },
  preDeploy: async changes => {
    const objectTypesWithIsoCodeFields = changes
      .filter(isAdditionChange)
      .filter(isObjectTypeChange)
      .map(getChangeData)
      .filter(objType => objType.fields?.CurrencyIsoCode?.annotations.valueSetName !== undefined)

    objectTypesWithIsoCodeFields.forEach(objType => {
      delete objType.fields.CurrencyIsoCode?.annotations.valueSetName
    })
  },
  onDeploy: async changes => {
    const currencyCodeInstance = await config.elementsSource.get(
      currencyCodeType.elemID.createNestedID('instance', ElemID.CONFIG_NAME),
    )
    const objectTypesWithIsoCodeFields = changes
      .filter(isAdditionChange)
      .filter(isObjectTypeChange)
      .map(getChangeData)
      .filter(objType => objType.fields[CURRENCY_ISO_CODE] !== undefined)

    objectTypesWithIsoCodeFields.forEach(objType =>
      transformCurrencyIsoCodes(objType as CurrencyIsoCodeType, currencyCodeInstance),
    )
  },
})

export default filterCreator
