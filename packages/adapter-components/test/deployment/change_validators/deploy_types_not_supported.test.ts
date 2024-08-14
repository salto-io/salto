/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, ObjectType, toChange } from '@salto-io/adapter-api'
import { deployTypesNotSupportedValidator } from '../../../src/deployment/change_validators/deploy_types_not_supported'

describe('deployTypesNotSupportedValidator', () => {
  it('should return an error when the changed element is not an instance', async () => {
    const type = new ObjectType({ elemID: new ElemID('adapter', 'test') })

    const errors = await deployTypesNotSupportedValidator([toChange({ after: type })])
    expect(errors).toEqual([
      {
        elemID: type.elemID,
        severity: 'Error',
        message: `Deployment of non-instance elements is not supported in adapter ${type.elemID.adapter}`,
        detailedMessage: `Deployment of non-instance elements is not supported in adapter ${type.elemID.adapter}. Please see your business app FAQ at https://help.salto.io/en/articles/6927118-supported-business-applications for a list of supported elements.`,
      },
    ])
  })
})
