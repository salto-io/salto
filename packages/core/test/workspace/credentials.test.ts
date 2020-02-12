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
import { ElemID, ObjectType, Field, BuiltinTypes, InstanceElement } from '@salto-io/adapter-api'
import { DirectoryStore } from '../../src/workspace/dir_store'
import { dumpElements } from '../../src/parser/dump'
import { adapterCredentials } from '../../src/workspace/credentials'

jest.mock('../../../src/workspace/local/dir_store')
describe('credentials', () => {
  const adapter = 'mockadapter'
  const configID = new ElemID(adapter)
  const configType = new ObjectType({
    elemID: configID,
    fields: {
      username: new Field(configID, 'username', BuiltinTypes.STRING),
      password: new Field(configID, 'password', BuiltinTypes.STRING),
    },
  })
  const creds = new InstanceElement(ElemID.CONFIG_NAME, configType, {
    username: 'test@test',
    password: 'test',
  })

  const mockSet = jest.fn()
  const mockGet = jest.fn()
  const mockFlush = jest.fn()
  const dumpedCredentials = { filename: `${adapter}.bp`, buffer: dumpElements([creds]) }
  const mockedDirStore = {
    get: mockGet,
    set: mockSet,
    flush: mockFlush,
  } as unknown as DirectoryStore

  it('should set new credentials', async () => {
    mockSet.mockResolvedValueOnce(true)
    mockFlush.mockResolvedValue(true)
    await adapterCredentials(mockedDirStore).set(adapter, creds)
    expect(mockSet).toHaveBeenCalledWith(dumpedCredentials)
    expect(mockFlush).toHaveBeenCalledTimes(1)
  })

  it('should get credentials if exists', async () => {
    mockGet.mockResolvedValueOnce(dumpedCredentials)
    const fromCredsStore = await adapterCredentials(mockedDirStore).get(adapter)
    expect(fromCredsStore?.value).toEqual(creds.value)
  })

  it('shouldnt fail if credentials not exists', async () => {
    mockGet.mockResolvedValueOnce(undefined)
    const fromCredsStore = await adapterCredentials(mockedDirStore).get(adapter)
    expect(fromCredsStore).toBeUndefined()
  })
})
