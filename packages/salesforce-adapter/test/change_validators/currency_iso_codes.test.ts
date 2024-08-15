/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeError,
  ElemID,
  InstanceElement,
  ListType,
  ObjectType,
  ReadOnlyElementsSource,
  toChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import {
  CURRENCY_CODE_TYPE_NAME,
  CURRENCY_ISO_CODE,
  FIELD_ANNOTATIONS,
  INSTANCE_FULL_NAME_FIELD,
  SALESFORCE,
} from '../../src/constants'
import { Types } from '../../src/transformers/transformer'
import changeValidator from '../../src/change_validators/currency_iso_codes'

const { awu } = collections.asynciterable

describe('currencyIsoCodes ChangeValidator', () => {
  let instances: InstanceElement[]
  let changeErrors: readonly ChangeError[]

  const createInstanceWithCurrencyIsoCode = (instanceName: string, currencyIsoCode: string): InstanceElement =>
    new InstanceElement(
      instanceName,
      new ObjectType({
        elemID: new ElemID(SALESFORCE, 'TestObject__c'),
        fields: {
          [CURRENCY_ISO_CODE]: { refType: Types.primitiveDataTypes.Picklist },
        },
      }),
      {
        [INSTANCE_FULL_NAME_FIELD]: instanceName,
        [CURRENCY_ISO_CODE]: currencyIsoCode,
      },
    )

  const createCurrencyIsoCodesInstance = (supportedIsoCodes: string[]): InstanceElement =>
    new InstanceElement(
      CURRENCY_CODE_TYPE_NAME,
      new ObjectType({
        elemID: new ElemID(SALESFORCE, CURRENCY_CODE_TYPE_NAME),
        fields: {
          [FIELD_ANNOTATIONS.VALUE_SET]: {
            refType: new ListType(Types.valueSetType),
          },
        },
      }),
      {
        [FIELD_ANNOTATIONS.VALUE_SET]: supportedIsoCodes.map(isoCode => ({
          [INSTANCE_FULL_NAME_FIELD]: isoCode,
        })),
      },
    )

  const createElementsSource = (currencyIsoCodesInstance?: InstanceElement): ReadOnlyElementsSource => ({
    getAll: async () => awu([]),
    list: async () => awu([]),
    has: async (_elemID: ElemID) => true,
    get: async (_elemID: ElemID) => currencyIsoCodesInstance,
  })

  describe('when destination org does not have multi currency enabled', () => {
    beforeEach(async () => {
      instances = [
        createInstanceWithCurrencyIsoCode('instance1', 'ILS'),
        createInstanceWithCurrencyIsoCode('instance2', 'EUR'),
        createInstanceWithCurrencyIsoCode('instance3', 'EUR'),
      ]
      changeErrors = await changeValidator(
        instances.map(instance => toChange({ after: instance })),
        createElementsSource(),
      )
    })
    it('should create change errors', () => {
      expect(changeErrors.map(err => err.elemID)).toEqual(instances.map(instance => instance.elemID))
    })
  })

  describe('when destination org has multi currency enabled', () => {
    describe('when all currencies are supported', () => {
      beforeEach(async () => {
        instances = [
          createInstanceWithCurrencyIsoCode('instance1', 'ILS'),
          createInstanceWithCurrencyIsoCode('instance2', 'EUR'),
          createInstanceWithCurrencyIsoCode('instance3', 'EUR'),
        ]
        changeErrors = await changeValidator(
          instances.map(instance => toChange({ after: instance })),
          createElementsSource(createCurrencyIsoCodesInstance(['ILS', 'EUR'])),
        )
      })
      it('should not create change errors', () => {
        expect(changeErrors).toBeEmpty()
      })
    })
    describe('when some currencies are not supported', () => {
      let unsupportedInstances: InstanceElement[]
      beforeEach(async () => {
        unsupportedInstances = [createInstanceWithCurrencyIsoCode('instance1', 'ILS')]
        instances = [
          createInstanceWithCurrencyIsoCode('instance2', 'EUR'),
          createInstanceWithCurrencyIsoCode('instance3', 'EUR'),
        ]
        changeErrors = await changeValidator(
          instances.concat(unsupportedInstances).map(instance => toChange({ after: instance })),
          createElementsSource(createCurrencyIsoCodesInstance(['EUR'])),
        )
      })
      it('should create change errors', () => {
        expect(changeErrors).not.toBeEmpty()
        expect(changeErrors.map(err => err.elemID)).toEqual(unsupportedInstances.map(instance => instance.elemID))
      })
    })
  })
})
