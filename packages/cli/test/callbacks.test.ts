/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { BuiltinTypes, ObjectType, ElemID } from '@salto-io/adapter-api'
import { getFieldInputType, getApprovedChanges } from '../src/callbacks'
import { dummyChanges } from './mocks'

jest.mock('inquirer', () => ({
  prompt: jest.fn().mockImplementation(() => Promise.resolve({ 0: 'yes', 1: 'no' })),
}))
describe('callbacks', () => {
  it('should create proper inquirer field', () => {
    const stRes = getFieldInputType(BuiltinTypes.STRING, 'st')
    const iRes = getFieldInputType(BuiltinTypes.NUMBER, 'i')
    const bRes = getFieldInputType(BuiltinTypes.BOOLEAN, 'b')
    const passRes = getFieldInputType(BuiltinTypes.STRING, 'password')
    const tokenRes = getFieldInputType(BuiltinTypes.STRING, 'token')
    const tokenIdRes = getFieldInputType(BuiltinTypes.STRING, 'tokenId')
    const tokenSecretRes = getFieldInputType(BuiltinTypes.STRING, 'tokenSecret')
    expect(iRes).toBe('number')
    expect(bRes).toBe('confirm')
    expect(stRes).toBe('input')
    expect(passRes).toBe('password')
    expect(tokenRes).toBe('password')
    expect(tokenIdRes).toBe('password')
    expect(tokenSecretRes).toBe('password')
    expect(() => getFieldInputType(new ObjectType({ elemID: new ElemID('salto', 'nonPrim') }), 'unknown')).toThrow()
    expect(() => getFieldInputType(BuiltinTypes.UNKNOWN, 'unknown')).toThrow()
  })

  describe('getApprovedChanges', () => {
    const fetchChanges = dummyChanges.map(c => ({ change: c, serviceChanges: [c] }))
    it('should return all non conflict changes', async () => {
      const approved = await getApprovedChanges(fetchChanges)
      expect(approved).toHaveLength(fetchChanges.length)
    })
  })
})
