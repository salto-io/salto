/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ODATA_TYPE_FIELD } from '../../../src/constants'
import { adjustEntitiesWithExpandedMembers } from '../../../src/definitions/fetch/utils'
import { contextMock } from '../../mocks'

describe(`${adjustEntitiesWithExpandedMembers.name}`, () => {
  it('should throw an error when value is not an object', async () => {
    await expect(
      adjustEntitiesWithExpandedMembers({ value: 'not an object', typeName: 'typeName', context: contextMock }),
    ).rejects.toThrow()
  })

  it('should throw an error when members is not an array', async () => {
    await expect(
      adjustEntitiesWithExpandedMembers({
        value: { members: 'not an array' },
        typeName: 'typeName',
        context: contextMock,
      }),
    ).rejects.toThrow()
  })

  it('should not throw an error when members field is missing', async () => {
    await expect(
      adjustEntitiesWithExpandedMembers({ value: {}, typeName: 'typeName', context: contextMock }),
    ).resolves.not.toThrow()
  })

  it('should throw an error when members contains non-object elements', async () => {
    await expect(
      adjustEntitiesWithExpandedMembers({
        value: { members: ['not an object'] },
        typeName: 'typeName',
        context: contextMock,
      }),
    ).rejects.toThrow()
  })

  it('should select only id and ODATA_TYPE_FIELD fields from members', async () => {
    const members = [
      { id: 'id1', [ODATA_TYPE_FIELD]: '#microsoft.graph.group', otherField: 'other1' },
      { id: 'id2', [ODATA_TYPE_FIELD]: '#microsoft.graph.group', otherField: 'other2' },
    ]
    const { value } = await adjustEntitiesWithExpandedMembers({
      value: { members },
      typeName: 'typeName',
      context: contextMock,
    })
    expect(value.members).toEqual([
      { id: 'id1', [ODATA_TYPE_FIELD]: '#microsoft.graph.group' },
      { id: 'id2', [ODATA_TYPE_FIELD]: '#microsoft.graph.group' },
    ])
  })

  it('should filter out members with unsupported ODATA_TYPE_FIELD', async () => {
    const members = [
      { id: 'id1', [ODATA_TYPE_FIELD]: '#microsoft.graph.group' },
      { id: 'id2', [ODATA_TYPE_FIELD]: '#microsoft.graph.group' },
      { id: 'id3', [ODATA_TYPE_FIELD]: '#microsoft.graph.user' },
    ]
    const { value } = await adjustEntitiesWithExpandedMembers({
      value: { members },
      typeName: 'typeName',
      context: contextMock,
    })
    expect(value.members).toEqual([
      { id: 'id1', [ODATA_TYPE_FIELD]: '#microsoft.graph.group' },
      { id: 'id2', [ODATA_TYPE_FIELD]: '#microsoft.graph.group' },
    ])
  })
})
