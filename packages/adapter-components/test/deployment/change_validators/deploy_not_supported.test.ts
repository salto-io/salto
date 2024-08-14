/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, ObjectType, toChange } from '@salto-io/adapter-api'
import { createChangeValidator } from '../../../src/deployment/change_validators'
import { deployNotSupportedValidator } from '../../../src/deployment/change_validators/deploy_not_supported'

describe('change validator creator', () => {
  describe('deployNotSupportedValidator', () => {
    const validators = {
      deployNotSupported: deployNotSupportedValidator,
    }
    it('should not fail if there are no deploy changes', async () => {
      expect(await createChangeValidator({ validators })([])).toEqual([])
    })

    it('should fail each change individually', async () => {
      expect(
        await createChangeValidator({ validators })([
          toChange({ after: new ObjectType({ elemID: new ElemID('myAdapter', 'obj') }) }),
          toChange({ before: new ObjectType({ elemID: new ElemID('myAdapter', 'obj2') }) }),
        ]),
      ).toEqual([
        {
          elemID: new ElemID('myAdapter', 'obj'),
          severity: 'Error',
          message: 'Salto does not support myAdapter deployments.',
          detailedMessage:
            'Salto does not support myAdapter deployments. Please see https://help.salto.io/en/articles/6927118-supported-business-applications for more details.',
        },
        {
          elemID: new ElemID('myAdapter', 'obj2'),
          severity: 'Error',
          message: 'Salto does not support myAdapter deployments.',
          detailedMessage:
            'Salto does not support myAdapter deployments. Please see https://help.salto.io/en/articles/6927118-supported-business-applications for more details.',
        },
      ])
    })
  })
})
