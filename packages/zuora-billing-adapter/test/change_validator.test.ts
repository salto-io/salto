/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { toChange, ObjectType, ElemID } from '@salto-io/adapter-api'
import changeValidator from '../src/change_validator'
import { ZUORA_BILLING } from '../src/constants'

describe('change validator creator', () => {
  describe('deployNotSupportedValidator', () => {
    it('should not fail if there are no deploy changes', async () => {
      expect(await changeValidator([])).toEqual([])
    })

    it('should fail each change individually', async () => {
      expect(
        await changeValidator([
          toChange({ after: new ObjectType({ elemID: new ElemID(ZUORA_BILLING, 'obj') }) }),
          toChange({ before: new ObjectType({ elemID: new ElemID(ZUORA_BILLING, 'obj2') }) }),
        ]),
      ).toEqual([
        {
          elemID: new ElemID(ZUORA_BILLING, 'obj'),
          severity: 'Error',
          message: 'Salto does not support zuora_billing deployments.',
          detailedMessage:
            'Salto does not support zuora_billing deployments. Please see https://help.salto.io/en/articles/6927118-supported-business-applications for more details.',
        },
        {
          elemID: new ElemID(ZUORA_BILLING, 'obj2'),
          severity: 'Error',
          message: 'Salto does not support zuora_billing deployments.',
          detailedMessage:
            'Salto does not support zuora_billing deployments. Please see https://help.salto.io/en/articles/6927118-supported-business-applications for more details.',
        },
      ])
    })
  })
})
