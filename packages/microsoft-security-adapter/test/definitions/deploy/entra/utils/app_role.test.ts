/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { PARENT_ID_FIELD_NAME } from '../../../../../src/constants'
import { omitParentIdFromPathAdjustCreator } from '../../../../../src/definitions/deploy/shared/utils'
import { contextMock } from '../../../../mocks'

const PARENT_TYPE_NAME = 'parentTypeName'

describe(`${omitParentIdFromPathAdjustCreator.name}`, () => {
  it('should throw an error if the value is not an object', async () => {
    const value = 'not an object'
    const adjust = omitParentIdFromPathAdjustCreator('someField')
    await expect(
      adjust({
        value,
        typeName: PARENT_TYPE_NAME,
        context: contextMock,
      }),
    ).rejects.toThrow()
  })

  it('should remove the parent_id field from each object in the specified path', async () => {
    const value = {
      firstLevel: {
        secondLevel: [
          {
            id: 'id1',
            name: 'name1',
            [PARENT_ID_FIELD_NAME]: 'parentId',
          },
          {
            id: 'id2',
            name: 'name2',
          },
        ],
      },
    }
    const adjust = omitParentIdFromPathAdjustCreator('firstLevel', 'secondLevel')
    const result = await adjust({
      value,
      typeName: PARENT_TYPE_NAME,
      context: contextMock,
    })
    expect(result.value).toEqual({
      firstLevel: {
        secondLevel: [
          {
            id: 'id1',
            name: 'name1',
          },
          {
            id: 'id2',
            name: 'name2',
          },
        ],
      },
    })
  })
})
