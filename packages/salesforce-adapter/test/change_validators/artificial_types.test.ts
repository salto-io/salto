/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ElemID, InstanceElement, ObjectType, ChangeError, toChange } from '@salto-io/adapter-api'
import {
  CURRENCY_CODE_TYPE_NAME,
  CURRENCY_ISO_CODE,
  INSTANCE_FULL_NAME_FIELD,
  METADATA_TYPE,
  SALESFORCE,
} from '../../src/constants'
import validator from '../../src/change_validators/artificial_types'

describe('artificialTypes', () => {
  let errors: ReadonlyArray<ChangeError>
  describe('when modifying artificial types', () => {
    describe('when modifying CurrencyIsoCode', () => {
      const currencyIsoCodeType = new ObjectType({
        elemID: new ElemID(SALESFORCE, CURRENCY_CODE_TYPE_NAME),
        annotations: {
          [METADATA_TYPE]: CURRENCY_CODE_TYPE_NAME,
        },
      })
      describe('when modifying the type', () => {
        beforeEach(async () => {
          errors = await validator([
            toChange({
              before: currencyIsoCodeType,
              after: currencyIsoCodeType,
            }),
          ])
        })
        it('should fail to deploy', () => {
          expect(errors).toHaveLength(1)
          expect(errors[0]).toSatisfy(
            error =>
              error.elemID.isEqual(currencyIsoCodeType.elemID) &&
              error.message === "The list of currency codes can't be changed via Salto." &&
              error.severity === 'Error',
          )
        })
      })
      describe('when modifying the instance', () => {
        const currencyIsoCodeInstance = new InstanceElement('currencyIsoCodeInstance', currencyIsoCodeType, {
          [INSTANCE_FULL_NAME_FIELD]: CURRENCY_ISO_CODE,
        })
        beforeEach(async () => {
          errors = await validator([
            toChange({
              before: currencyIsoCodeInstance,
              after: currencyIsoCodeInstance,
            }),
          ])
        })

        it('should fail to deploy', () => {
          expect(errors).toHaveLength(1)
          expect(errors[0]).toSatisfy(
            error =>
              error.elemID.isEqual(currencyIsoCodeInstance.elemID) &&
              error.message === "The list of currency codes can't be changed via Salto." &&
              error.severity === 'Error',
          )
        })
      })
    })
  })
})
