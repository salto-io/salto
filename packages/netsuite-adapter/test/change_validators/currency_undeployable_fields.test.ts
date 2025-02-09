/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, BuiltinTypes, toChange } from '@salto-io/adapter-api'
import { NETSUITE } from '../../src/constants'
import currencyFieldValidator from '../../src/change_validators/currency_undeployable_fields'
import { mockChangeValidatorParams } from '../utils'

export const currencyType = new ObjectType({
  elemID: new ElemID(NETSUITE, 'currency'),
  fields: {
    name: {
      refType: BuiltinTypes.STRING,
    },
    symbol: {
      refType: BuiltinTypes.STRING,
    },
    isBaseCurrency: {
      refType: BuiltinTypes.BOOLEAN,
    },
    isInactive: {
      refType: BuiltinTypes.BOOLEAN,
    },
    overrideCurrencyFormat: {
      refType: BuiltinTypes.BOOLEAN,
    },
    displaySymbol: {
      refType: BuiltinTypes.STRING,
    },
    symbolPlacement: {
      refType: BuiltinTypes.STRING,
    },
    locale: {
      refType: BuiltinTypes.STRING,
    },
    formatSample: {
      refType: BuiltinTypes.STRING,
    },
    exchangeRate: {
      refType: BuiltinTypes.NUMBER,
    },
    currencyPrecision: {
      refType: BuiltinTypes.STRING,
    },
  },
  annotations: { source: 'soap' },
})

describe('Currency changes change  validator', () => {
  let instance: InstanceElement
  beforeEach(async () => {
    instance = new InstanceElement('instance', currencyType, {
      name: 'instance',
      symbol: 'ILS',
      isBaseCurrency: false,
      isInactive: false,
      overrideCurrencyFormat: false,
      displaySymbol: '₪',
      symbolPlacement: '_beforeNumber',
      locale: '_israelHebrew',
      formatSample: '₪1234.56',
      exchangeRate: 2.365,
      currencyPrecision: '_two',
    })
  })
  describe('Additon changes to currency', () => {
    it("should have changeError when deploying a new currency with 'overrideCurrencyFormat' disabled.", async () => {
      const after = instance.clone()
      const changeErrors = await currencyFieldValidator([toChange({ after })], mockChangeValidatorParams())
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
      expect(changeErrors[0].detailedMessage).toContain(
        'Cannot deploy currency - override currency format is disabled. Please see https://help.salto.io/en/articles/6845062-deploying-a-currency-between-environments for instructions',
      )
    })

    it("shoud have changeError when deploying a new currency with 'overrideCurrencyFormat' enabled.", async () => {
      const after = instance.clone()
      after.value.overrideCurrencyFormat = true
      const changeErrors = await currencyFieldValidator([toChange({ after })], mockChangeValidatorParams())
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
      expect(changeErrors[0].detailedMessage).toContain(
        "Unable to deploy 'locale' field. Once the deployment is completed, set the 'locale' of the newly created currency to the desired value in the target environment.",
      )
    })
  })

  describe('Modification changes to currency', () => {
    it("should not have changeError when editing a field which isn't currencyPrecision, displaySymbol or symbolPlacement", async () => {
      const after = instance.clone()
      after.value.symbol = 'UYU'
      const changeErrors = await currencyFieldValidator(
        [toChange({ before: instance, after })],
        mockChangeValidatorParams(),
      )
      expect(changeErrors).toHaveLength(0)
    })

    it('should not have changeError when editing displaySymbol or symbolPlacement with overrideCurrencyFormat', async () => {
      instance.value.overrideCurrencyFormat = true
      const after = instance.clone()
      after.value.displaySymbol = '@'
      const changeErrors = await currencyFieldValidator(
        [toChange({ before: instance, after })],
        mockChangeValidatorParams(),
      )
      expect(changeErrors).toHaveLength(0)
    })

    it('should have changeError when editing displaySymbol or symbolPlacement with overrideCurrencyFormat disabled', async () => {
      const after = instance.clone()
      after.value.displaySymbol = '@'
      const changeErrors = await currencyFieldValidator(
        [toChange({ before: instance, after })],
        mockChangeValidatorParams(),
      )
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
      expect(changeErrors[0].detailedMessage).toContain(
        'Cannot deploy currency - field display symbol cannot be edited. To enable editing this field, enable override currency format and try again. Please see https://help.salto.io/en/articles/6845062-deploying-a-currency-between-environments for instructions',
      )
    })

    it('should have changeError when modifying currencyPrecision', async () => {
      const after = instance.clone()
      after.value.currencyPrecision = '_zero'
      const changeErrors = await currencyFieldValidator(
        [toChange({ before: instance, after })],
        mockChangeValidatorParams(),
      )
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
      expect(changeErrors[0].detailedMessage).toContain(
        'Cannot deploy currency - currency precision is a read-only field in NetSuite. Please see https://help.salto.io/en/articles/6845062-deploying-a-currency-between-environments for instructions',
      )
    })
  })
})
