/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { addParentIdToStandaloneFields } from '../../../../../src/definitions/fetch/shared/utils'
import { PARENT_ID_FIELD_NAME } from '../../../../../src/constants'

describe(`${addParentIdToStandaloneFields.name}`, () => {
  const FIELD_NAME = 'someField'
  it('should throw an error when the field is not an array', async () => {
    expect(() =>
      addParentIdToStandaloneFields({
        fieldPath: [FIELD_NAME],
        value: { [FIELD_NAME]: 'not an array' },
      }),
    ).toThrow(new Error("Expected someField to be an array, but got 'not an array'"))
  })

  it('should throw an error when the field contains non-object elements', async () => {
    expect(() =>
      addParentIdToStandaloneFields({
        fieldPath: [FIELD_NAME],
        value: { [FIELD_NAME]: ['not an object'] },
      }),
    ).toThrow(new Error("Expected someField[0] to be a plain object, but got 'not an object'"))
  })

  it('should return undefined when the field does not exist', async () => {
    const value = { topLevel: { otherField: 'other' } }
    expect(addParentIdToStandaloneFields({ fieldPath: [FIELD_NAME], value })).toBeUndefined()
  })

  it('should add the parent id to each of the field objects', async () => {
    const fieldValue = [
      { id: 'id1', otherField: 'other1' },
      { id: 'id2', otherField: 'other2' },
    ]
    const value = { id: 'parentId', topLevel: { [FIELD_NAME]: fieldValue } }
    const result = addParentIdToStandaloneFields({ fieldPath: ['topLevel', FIELD_NAME], value })
    expect(_.get(result?.[0], PARENT_ID_FIELD_NAME)).toEqual('parentId')
    expect(_.get(result?.[1], PARENT_ID_FIELD_NAME)).toEqual('parentId')
  })
})
