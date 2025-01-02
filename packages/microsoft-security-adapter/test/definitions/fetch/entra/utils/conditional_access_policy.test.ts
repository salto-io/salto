/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { entraConstants } from '../../../../../src/constants'
import { adjustConditionalAccessPolicy } from '../../../../../src/definitions/fetch/entra/utils'

const { CONDITIONAL_ACCESS_POLICY_TYPE_NAME } = entraConstants

describe(adjustConditionalAccessPolicy.name, () => {
  it('should retain only the id field in the authenticationStrength object', async () => {
    const value = {
      id: 'id',
      grantControls: {
        authenticationStrength: {
          id: 'id',
          name: 'name',
          someField: 'someField',
        },
      },
    }
    const result = await adjustConditionalAccessPolicy({
      value,
      typeName: CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
      context: {},
    })
    expect(result.value).toEqual({
      id: 'id',
      grantControls: {
        authenticationStrength: {
          id: 'id',
        },
      },
    })
  })

  it('should do nothing if the authenticationStrength does not exist', async () => {
    const value = {
      id: 'id',
      grantControls: { authenticationStrength: null },
    }
    const result = await adjustConditionalAccessPolicy({
      value,
      typeName: CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
      context: {},
    })
    expect(result.value).toEqual(value)
  })

  it('should do nothing if grantControls does not exist', async () => {
    const value = {
      id: 'id',
    }
    const result = await adjustConditionalAccessPolicy({
      value,
      typeName: CONDITIONAL_ACCESS_POLICY_TYPE_NAME,
      context: {},
    })
    expect(result.value).toEqual(value)
  })

  it('should throw an error when value is not an object', async () => {
    await expect(
      adjustConditionalAccessPolicy({ value: 'not an object', typeName: 'typeName', context: {} }),
    ).rejects.toThrow(new Error("Expected EntraConditionalAccessPolicy to be a plain object, but got 'not an object'"))
  })
})
