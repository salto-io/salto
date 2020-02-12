
/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { BuiltinTypes } from '@salto-io/adapter-api'
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
    expect(iRes).toBe('number')
    expect(bRes).toBe('confirm')
    expect(stRes).toBe('input')
    expect(passRes).toBe('password')
  })

  describe('getApprovedChanges', () => {
    const fetchChanges = dummyChanges.map(c => ({ change: c, serviceChange: c }))
    it('should return all non conflict changes interactive=false', async () => {
      const approved = await getApprovedChanges(fetchChanges, false)
      expect(approved).toHaveLength(fetchChanges.length)
    })

    it('should return only approved changes interactive=true', async () => {
      const approved = await getApprovedChanges(fetchChanges, true)
      expect(approved).toHaveLength(1)
    })

    it('should ask for conflicts return only approved changes interactive=true', async () => {
      const approved = await getApprovedChanges(fetchChanges
        .map(c => ({ ...c, pendingChange: c.change })), false)
      expect(approved).toHaveLength(1)
    })
  })
})
