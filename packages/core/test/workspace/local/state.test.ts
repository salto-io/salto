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
import { EOL } from 'os'
import { ObjectType, ElemID, isObjectType } from '@salto-io/adapter-api'
import State from '../../../src/workspace/state'
import { localState } from '../../../src/workspace/local/state'
import { getAllElements } from '../../common/elements'
import { expectTypesToMatch } from '../../common/helpers'
import { serialize } from '../../../src/serializer/elements'
import { replaceContents, exists, readTextFile } from '../../../src/file'

jest.mock('../../../src/file', () => ({
  replaceContents: jest.fn().mockImplementation(() => Promise.resolve()),
  readTextFile: jest.fn().mockImplementation((filename: string) => {
    if (filename === 'error') {
      return Promise.resolve('blabl{,.')
    }
    if (filename === 'full') {
      return Promise.resolve('[{"elemID":{"adapter":"salesforce","nameParts":["_config"]},"type":{"annotationTypes":{},"annotations":{},"elemID":{"adapter":"salesforce","nameParts":[]},"fields":{},"isSettings":false,"_salto_class":"ObjectType"},"value":{"token":"token","sandbox":false,"username":"test@test","password":"pass"},"_salto_class":"InstanceElement"},{"annotationTypes":{},"annotations":{"LeadConvertSettings":{"account":[{"input":"bla","output":"foo"}]}},"elemID":{"adapter":"salesforce","nameParts":["test"]},"fields":{"name":{"parentID":{"adapter":"salesforce","nameParts":["test"]},"name":"name","type":{"annotationTypes":{},"annotations":{},"elemID":{"adapter":"","nameParts":["string"]},"fields":{},"isSettings":false,"_salto_class":"ObjectType"},"annotations":{"label":"Name","_required":true},"isList":false,"elemID":{"adapter":"salesforce","nameParts":["test","name"]},"_salto_class":"Field"}},"isSettings":false,"_salto_class":"ObjectType"},{"annotationTypes":{},"annotations":{"metadataType":"Settings"},"elemID":{"adapter":"salesforce","nameParts":["settings"]},"fields":{},"isSettings":true,"_salto_class":"ObjectType"}]')
    }
    if (filename === 'mutiple_adapters') {
      return Promise.resolve('[{"annotationTypes":{},"annotations":{"LeadConvertSettings":{"account":[{"input":"bla","output":"foo"}]}},"elemID":{"adapter":"salesforce","nameParts":["test"]},"fields":{"name":{"parentID":{"adapter":"salesforce","nameParts":["test"]},"name":"name","type":{"annotationTypes":{},"annotations":{},"elemID":{"adapter":"","nameParts":["string"]},"fields":{},"isSettings":false,"_salto_class":"ObjectType"},"annotations":{"label":"Name","_required":true},"isList":false,"elemID":{"adapter":"salesforce","nameParts":["test","name"]},"_salto_class":"Field"}},"isSettings":false,"_salto_class":"ObjectType"},{"annotationTypes":{},"annotations":{},"elemID":{"adapter":"hubspot","nameParts":["foo"]},"fields":{},"isSettings":false,"_salto_class":"ObjectType"}]')
    }
    return Promise.resolve('[]')
  }),
  mkdirp: jest.fn().mockImplementation(),
  exists: jest.fn().mockImplementation(((filename: string) => Promise.resolve(filename !== 'empty'))),
}))

describe('local state', () => {
  const mockElement = getAllElements().find(isObjectType) as ObjectType
  const replaceContentMock = replaceContents as jest.Mock
  const readTextFileMock = readTextFile as unknown as jest.Mock

  describe('empty state', () => {
    let state: State
    beforeEach(() => {
      state = localState('empty')
    })
    it('should return an empty array if there is no saved state', async () => {
      const result = await state.getAll()
      expect(result.length).toBe(0)
    })

    it('should override state successfully, retrieve it and get the same result', async () => {
      const newElem = new ObjectType({ elemID: new ElemID('mock_adapter', 'new') })
      state.set([newElem])
      await state.override([mockElement])
      const retrievedState = await state.getAll()
      expect(retrievedState.length).toBe(1)
      const retrievedStateObjectType = retrievedState[0] as ObjectType
      expectTypesToMatch(retrievedStateObjectType, mockElement)
    })

    it('should set state successfully, retrieve it and get the same result', async () => {
      await state.set([mockElement])
      const retrievedState = await state.getAll()
      expect(retrievedState.length).toBe(1)
      const retrievedStateObjectType = retrievedState[0] as ObjectType
      expectTypesToMatch(retrievedStateObjectType, mockElement)
    })

    it('should update state', async () => {
      await state.set([mockElement])
      const clone = mockElement.clone()
      const newField = Object.values(mockElement.fields)[0]
      newField.name = 'new_field'
      clone.fields.newfield = newField
      state.set([clone])

      const fromState = await state.get(mockElement.elemID) as ObjectType
      expect(fromState.fields.newfield).toBeDefined()
    })

    it('should add to state', async () => {
      await state.set([mockElement])
      const newElem = new ObjectType({ elemID: new ElemID('mock_adapter', 'new') })
      state.set([newElem])

      const fromState = await state.getAll()
      expect(fromState.length).toBe(2)
      expect(fromState[1].elemID.name).toBe('new')
    })

    it('should remove from state', async () => {
      await state.set([mockElement])
      let fromState = await state.getAll()
      expect(fromState.length).toBe(1)

      await state.remove(mockElement.elemID)
      fromState = await state.getAll()
      expect(fromState.length).toBe(0)
    })
  })

  it('should read valid state file', async () => {
    const state = localState('full')
    const elements = await state.getAll()
    expect(elements).toHaveLength(2)
  })

  it('should throw an error if the state bp is not valid', async () => {
    const state = localState('error')
    await expect(state.getAll()).rejects.toThrow()
  })

  const findReplaceContentCall = (filename: string): unknown[] =>
    replaceContentMock.mock.calls.find(c => c[0] === filename)

  it('should write file on flush', async () => {
    const state = localState('on-flush')
    await state.set([mockElement])
    await state.flush()
    const onFlush = findReplaceContentCall('on-flush')
    expect(onFlush).toBeDefined()
    expect(onFlush[1]).toEqual(serialize([mockElement]))
  })

  it('shouldn\'t write file if state was not loaded on flush', async () => {
    const state = localState('not-flush')
    await state.flush()
    expect(findReplaceContentCall('not-flush')).toBeUndefined()
  })

  describe('getUpdateDate', () => {
    const mockExists = exists as jest.Mock
    it('should return undefined when the state does not exist', async () => {
      mockExists.mockResolvedValueOnce(false)
      const state = localState('filename')
      const date = await state.getUpdateDate()
      expect(date).toBe(undefined)
    })
    it('should return undefined when the updated date is not set', async () => {
      mockExists.mockResolvedValueOnce(true)
      const state = localState('filename')
      const date = await state.getUpdateDate()
      expect(date).toBe(undefined)
    })
    it('should return the modification date of the state', async () => {
      mockExists.mockResolvedValueOnce(true)
      const modificationDate = new Date(2010, 10, 10)
      readTextFileMock.mockResolvedValueOnce(`[]${EOL}${modificationDate.toISOString()}`)
      const state = localState('filename')
      const date = await state.getUpdateDate()
      expect(date).toEqual(modificationDate)
    })
    it('should update modification date on override', async () => {
      mockExists.mockResolvedValueOnce(true)
      const modificationDate = new Date(2010, 10, 10)
      readTextFileMock.mockResolvedValueOnce(`[]${EOL}${modificationDate.toISOString()}`)
      const now = new Date(2013, 6, 4).getTime()
      jest.spyOn(Date, 'now').mockImplementationOnce(() => now)
      const state = localState('filename')

      const beforeOverrideDate = await state.getUpdateDate()
      expect(beforeOverrideDate?.getTime()).not.toBe(now)
      await state.override([mockElement])
      const overrideDate = await state.getUpdateDate()
      expect(overrideDate?.getTime()).toBe(now)
    })
    it('should not update modification date on set/remove', async () => {
      mockExists.mockResolvedValueOnce(true)
      const modificationDate = new Date(2010, 10, 10)
      readTextFileMock.mockResolvedValueOnce(`[]${EOL}${modificationDate.toISOString()}`)
      const state = localState('filename')

      await state.set([mockElement])
      const overrideDate = await state.getUpdateDate()
      expect(overrideDate).toEqual(modificationDate)
      await state.remove([mockElement.elemID])
      expect(overrideDate).toEqual(modificationDate)
    })
  })

  describe('exsitingAdapters', () => {
    it('should return empty list on empty state', async () => {
      const state = localState('empty')
      const adapters = await state.existingServices()
      expect(adapters).toHaveLength(0)
    })
    it('should return all adapters in a full state', async () => {
      const state = localState('mutiple_adapters')
      const adapters = await state.existingServices()
      expect(adapters).toEqual(['salesforce', 'hubspot'])
    })
  })
})
