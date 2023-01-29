/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { Readable } from 'stream'
import { gzip as zlibGzip } from 'zlib'
import getStream from 'get-stream'
import { replaceContents, exists, createGZipReadStream, rm, rename, readOldFormatGZipFile, createGZipWriteStream } from '@salto-io/file'
import { ObjectType, ElemID, isObjectType, BuiltinTypes } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { state as wsState, serialization, pathIndex, remoteMap, staticFiles } from '@salto-io/workspace'
import { hash, collections } from '@salto-io/lowerdash'
import { promisify } from 'util'
import { localState, filePathGlob, ZIPPED_STATE_EXTENSION } from '../../../src/local-workspace/state'
import { getAllElements } from '../../common/elements'
import { version } from '../../../src/generated/version.json'
import { mockStaticFilesSource } from '../../common/state'
import { inMemRemoteMapCreator } from '../../common/helpers'

const { awu } = collections.asynciterable
const { serialize } = serialization
const { toMD5 } = hash
jest.mock('glob', () => (query: string, f: (_err: Error | null, files: string[]) => void) => {
  if (query.includes('deprecated_file') || query.includes('empty')) {
    // deprecated file would not be found by this schema
    f(null, [])
  } else if (query.includes('@(.jsonl')) {
    f(null, [`${query.substring(0, query.indexOf('@'))}.jsonl.zip`])
  } else if (query.includes('*(.jsonl')) {
    f(null, [`${query.substring(0, query.indexOf('*'))}.jsonl.zip`])
  } else if (query.includes('multiple_files')) {
    f(null, ['multiple_files.salesforce.jsonl.zip', 'multiple_files.netsuite.jsonl.zip'])
  } else {
    f(null, [`${query.substring(0, query.indexOf('*'))}jsonl.zip`])
  }
})
jest.mock('@salto-io/file', () => ({
  ...jest.requireActual<{}>('@salto-io/file'),
  replaceContents: jest.fn().mockImplementation(() => Promise.resolve()),
  readTextFile: jest.fn().mockImplementation((filename: string) => {
    if (filename === 'error') {
      return Promise.resolve('blabl{,.')
    }
    if (filename === 'full' || filename.startsWith('deprecated_file')) {
      return Promise.resolve('[{"elemID":{"adapter":"salesforce","nameParts":["_config"]},"refType":{"annotationRefTypes":{},"annotations":{},"elemID":{"adapter":"salesforce","nameParts":[]},"fields":{},"isSettings":false,"_salto_class":"ObjectType"},"value":{"token":"token","sandbox":false,"username":"test@test","password":"pass"},"_salto_class":"InstanceElement"},{"annotationRefTypes":{},"annotations":{"LeadConvertSettings":{"account":[{"input":"bla","output":"foo"}]}},"elemID":{"adapter":"salesforce","nameParts":["test"]},"fields":{"name":{"parentID":{"adapter":"salesforce","nameParts":["test"]},"name":"name","refType":{"annotationRefTypes":{},"annotations":{},"elemID":{"adapter":"","nameParts":["string"]},"fields":{},"isSettings":false,"_salto_class":"ObjectType"},"annotations":{"label":"Name","_required":true},"isList":false,"elemID":{"adapter":"salesforce","nameParts":["test","name"]},"_salto_class":"Field"}},"isSettings":false,"_salto_class":"ObjectType"},{"annotationRefTypes":{},"annotations":{"metadataType":"Settings"},"elemID":{"adapter":"salesforce","nameParts":["settings"]},"fields":{},"isSettings":true,"_salto_class":"ObjectType"}]')
    }
    if (filename === 'multiple_adapters') {
      return Promise.resolve('[{"annotationRefTypes":{},"annotations":{"LeadConvertSettings":{"account":[{"input":"bla","output":"foo"}]}},"elemID":{"adapter":"salesforce","nameParts":["test"]},"fields":{"name":{"parentID":{"adapter":"salesforce","nameParts":["test"]},"name":"name","refType":{"annotationRefTypes":{},"annotations":{},"elemID":{"adapter":"","nameParts":["string"]},"fields":{},"isSettings":false,"_salto_class":"ObjectType"},"annotations":{"label":"Name","_required":true},"isList":false,"elemID":{"adapter":"salesforce","nameParts":["test","name"]},"_salto_class":"Field"}},"isSettings":false,"_salto_class":"ObjectType"},{"annotationRefTypes":{},"annotations":{},"elemID":{"adapter":"netsuite","nameParts":["foo"]},"fields":{},"isSettings":false,"_salto_class":"ObjectType"}]\n{ "salto" :"2020-04-21T09:44:20.824Z", "netsuite":"2020-04-21T09:44:20.824Z"}')
    }
    if (filename === 'on-delete') {
      return '[]\n[{ "salto" :"2020-04-21T09:44:20.824Z"}]'
    }
    return Promise.resolve('[]')
  }),
  readOldFormatGZipFile: jest.fn().mockImplementation((filename: string) => {
    if (filename === 'error.jsonl.zip') {
      return Promise.resolve('blabl{,.')
    }
    if (['full.jsonl.zip', 'multiple_files.salesforce.jsonl.zip', 'multiple_files_extra.salesforce.jsonl.zip', 'deprecated_file_zip.jsonl.zip'].includes(filename)) {
      return Promise.resolve('[{"elemID":{"adapter":"salesforce","nameParts":["_config"]},"refType":{"annotationRefTypes":{},"annotations":{},"elemID":{"adapter":"salesforce","nameParts":[]},"fields":{},"isSettings":false,"_salto_class":"ObjectType"},"value":{"token":"token","sandbox":false,"username":"test@test","password":"pass"},"_salto_class":"InstanceElement"},{"annotationRefTypes":{},"annotations":{"LeadConvertSettings":{"account":[{"input":"bla","output":"foo"}]}},"elemID":{"adapter":"salesforce","nameParts":["test"]},"fields":{"name":{"parentID":{"adapter":"salesforce","nameParts":["test"]},"name":"name","refType":{"annotationRefTypes":{},"annotations":{},"elemID":{"adapter":"","nameParts":["string"]},"fields":{},"isSettings":false,"_salto_class":"ObjectType"},"annotations":{"label":"Name","_required":true},"isList":false,"elemID":{"adapter":"salesforce","nameParts":["test","name"]},"_salto_class":"Field"}},"isSettings":false,"_salto_class":"ObjectType"},{"annotationRefTypes":{},"annotations":{"metadataType":"Settings"},"elemID":{"adapter":"salesforce","nameParts":["settings"]},"fields":{},"isSettings":true,"_salto_class":"ObjectType"}]\n{ "salesforce" :"2020-04-21T09:44:20.824Z"}\n[]\n0.0.1')
    }
    if (filename === 'multiple_files.netsuite.jsonl.zip') {
      return Promise.resolve('[{"elemID":{"adapter":"netsuite","nameParts":["_config"]},"refType":{"annotationRefTypes":{},"annotations":{},"elemID":{"adapter":"netsuite","nameParts":[]},"fields":{},"isSettings":false,"_salto_class":"ObjectType"},"value":{"token":"token","sandbox":false,"username":"test@test","password":"pass"},"_salto_class":"InstanceElement"},{"annotationRefTypes":{},"annotations":{"LeadConvertSettings":{"account":[{"input":"bla","output":"foo"}]}},"elemID":{"adapter":"netsuite","nameParts":["test"]},"fields":{"name":{"parentID":{"adapter":"netsuite","nameParts":["test"]},"name":"name","refType":{"annotationRefTypes":{},"annotations":{},"elemID":{"adapter":"","nameParts":["string"]},"fields":{},"isSettings":false,"_salto_class":"ObjectType"},"annotations":{"label":"Name","_required":true},"isList":false,"elemID":{"adapter":"netsuite","nameParts":["test","name"]},"_salto_class":"Field"}},"isSettings":false,"_salto_class":"ObjectType"},{"annotationRefTypes":{},"annotations":{"metadataType":"Settings"},"elemID":{"adapter":"netsuite","nameParts":["settings"]},"fields":{},"isSettings":true,"_salto_class":"ObjectType"}]\n{ "netsuite" :"2020-04-21T09:44:20.824Z"}')
    }
    if (filename === 'multiple_adapters.jsonl.zip') {
      return Promise.resolve('[{"annotationRefTypes":{},"annotations":{"LeadConvertSettings":{"account":[{"input":"bla","output":"foo"}]}},"elemID":{"adapter":"salesforce","nameParts":["test"]},"fields":{"name":{"parentID":{"adapter":"salesforce","nameParts":["test"]},"name":"name","refType":{"annotationRefTypes":{},"annotations":{},"elemID":{"adapter":"","nameParts":["string"]},"fields":{},"isSettings":false,"_salto_class":"ObjectType"},"annotations":{"label":"Name","_required":true},"isList":false,"elemID":{"adapter":"salesforce","nameParts":["test","name"]},"_salto_class":"Field"}},"isSettings":false,"_salto_class":"ObjectType"},{"annotationRefTypes":{},"annotations":{},"elemID":{"adapter":"netsuite","nameParts":["foo"]},"fields":{},"isSettings":false,"_salto_class":"ObjectType"}]\n{ "salto" :"2020-04-21T09:44:20.824Z", "netsuite":"2020-04-21T09:44:20.824Z"}')
    }
    if (filename === 'on-delete.jsonl.zip') {
      return '[]\n{ "salto" :"2020-04-21T09:44:20.824Z"}'
    }
    return Promise.resolve('[]')
  }),
  createGZipReadStream: jest.fn().mockImplementation((filename: string) => {
    if (filename === 'error.jsonl.zip') {
      return Readable.from('blabl{,.')
    }
    if (['full.jsonl.zip', 'multiple_files.salesforce.jsonl.zip', 'multiple_files_extra.salesforce.jsonl.zip', 'deprecated_file_zip.jsonl.zip'].includes(filename)) {
      return Readable.from('[{"elemID":{"adapter":"salesforce","nameParts":["_config"]},"refType":{"annotationRefTypes":{},"annotations":{},"elemID":{"adapter":"salesforce","nameParts":[]},"fields":{},"isSettings":false,"_salto_class":"ObjectType"},"value":{"token":"token","sandbox":false,"username":"test@test","password":"pass"},"_salto_class":"InstanceElement"},{"annotationRefTypes":{},"annotations":{"LeadConvertSettings":{"account":[{"input":"bla","output":"foo"}]}},"elemID":{"adapter":"salesforce","nameParts":["test"]},"fields":{"name":{"parentID":{"adapter":"salesforce","nameParts":["test"]},"name":"name","refType":{"annotationRefTypes":{},"annotations":{},"elemID":{"adapter":"","nameParts":["string"]},"fields":{},"isSettings":false,"_salto_class":"ObjectType"},"annotations":{"label":"Name","_required":true},"isList":false,"elemID":{"adapter":"salesforce","nameParts":["test","name"]},"_salto_class":"Field"}},"isSettings":false,"_salto_class":"ObjectType"},{"annotationRefTypes":{},"annotations":{"metadataType":"Settings"},"elemID":{"adapter":"salesforce","nameParts":["settings"]},"fields":{},"isSettings":true,"_salto_class":"ObjectType"}]\n{ "salesforce" :"2020-04-21T09:44:20.824Z"}\n[]\n"0.0.1"')
    }
    if (filename === 'multiple_files.netsuite.jsonl.zip') {
      return Readable.from('[{"elemID":{"adapter":"netsuite","nameParts":["_config"]},"refType":{"annotationRefTypes":{},"annotations":{},"elemID":{"adapter":"netsuite","nameParts":[]},"fields":{},"isSettings":false,"_salto_class":"ObjectType"},"value":{"token":"token","sandbox":false,"username":"test@test","password":"pass"},"_salto_class":"InstanceElement"},{"annotationRefTypes":{},"annotations":{"LeadConvertSettings":{"account":[{"input":"bla","output":"foo"}]}},"elemID":{"adapter":"netsuite","nameParts":["test"]},"fields":{"name":{"parentID":{"adapter":"netsuite","nameParts":["test"]},"name":"name","refType":{"annotationRefTypes":{},"annotations":{},"elemID":{"adapter":"","nameParts":["string"]},"fields":{},"isSettings":false,"_salto_class":"ObjectType"},"annotations":{"label":"Name","_required":true},"isList":false,"elemID":{"adapter":"netsuite","nameParts":["test","name"]},"_salto_class":"Field"}},"isSettings":false,"_salto_class":"ObjectType"},{"annotationRefTypes":{},"annotations":{"metadataType":"Settings"},"elemID":{"adapter":"netsuite","nameParts":["settings"]},"fields":{},"isSettings":true,"_salto_class":"ObjectType"}]\n{ "netsuite" :"2020-04-21T09:44:20.824Z"}')
    }
    if (filename === 'multiple_adapters.jsonl.zip') {
      return Readable.from('[{"annotationRefTypes":{},"annotations":{"LeadConvertSettings":{"account":[{"input":"bla","output":"foo"}]}},"elemID":{"adapter":"salesforce","nameParts":["test"]},"fields":{"name":{"parentID":{"adapter":"salesforce","nameParts":["test"]},"name":"name","refType":{"annotationRefTypes":{},"annotations":{},"elemID":{"adapter":"","nameParts":["string"]},"fields":{},"isSettings":false,"_salto_class":"ObjectType"},"annotations":{"label":"Name","_required":true},"isList":false,"elemID":{"adapter":"salesforce","nameParts":["test","name"]},"_salto_class":"Field"}},"isSettings":false,"_salto_class":"ObjectType"},{"annotationRefTypes":{},"annotations":{},"elemID":{"adapter":"netsuite","nameParts":["foo"]},"fields":{},"isSettings":false,"_salto_class":"ObjectType"}]\n{ "salto" :"2020-04-21T09:44:20.824Z", "netsuite":"2020-04-21T09:44:20.824Z"}')
    }
    if (filename === 'on-delete.jsonl.zip') {
      return Readable.from('[]\n{ "salto" :"2020-04-21T09:44:20.824Z"}')
    }
    if (filename === 'too_long.jsonl.zip') {
      return Readable.from('[{"elemID":{"adapter":"salesforce","nameParts":["_config"]},"refType":{"annotationRefTypes":{},"annotations":{},"elemID":{"adapter":"salesforce","nameParts":[]},"fields":{},"isSettings":false,"_salto_class":"ObjectType"},"value":{"token":"token","sandbox":false,"username":"test@test","password":"pass"},"_salto_class":"InstanceElement"}]\n{ "salto" :"2020-04-21T09:44:20.824Z"}\n[]\n"0.1.2"\n"extra"\n')
    }
    return Readable.from('[]')
  }),
  // keep one file in the old format for testing
  isOldFormatStateZipFile: jest.fn().mockImplementation((filename: string) => filename === 'multiple_files.salesforce.jsonl.zip'),
  rm: jest.fn().mockImplementation(),
  rename: jest.fn().mockImplementation(),
  mkdirp: jest.fn().mockImplementation(),
  exists: jest.fn().mockImplementation((filename: string) => {
    if (filename === 'deprecated_file_zip.jsonl.zip') {
      return Promise.resolve(true)
    }
    if (filename.startsWith('deprecated_file')) {
      return Promise.resolve(filename.endsWith('jsonl'))
    }
    if (filename.endsWith('zip') && !filename.startsWith('empty')) {
      return Promise.resolve(true)
    }
    return Promise.resolve(false)
  }),
}))

describe('local state', () => {
  const mockElement = getAllElements().find(isObjectType) as ObjectType
  const replaceContentMock = replaceContents as jest.Mock
  const createGZipReadStreamMock = createGZipReadStream as unknown as jest.Mock
  const readOldFormatGZipFileMock = readOldFormatGZipFile as unknown as jest.Mock

  const findReplaceContentCall = (filename: string): unknown[] =>
    replaceContentMock.mock.calls.find(c => c[0] === filename)

  const findCreateGZipReadStreamCall = (filename: string): unknown[] =>
    createGZipReadStreamMock.mock.calls.find(c => c[0] === filename)

  const findReadOldFormatGZipFileCall = (filename: string): unknown[] =>
    readOldFormatGZipFileMock.mock.calls.find(c => c[0] === filename)

  const remoteMapCreator = async <T, K extends string = string>():
    Promise<remoteMap.RemoteMap<T, K>> => new remoteMap.InMemoryRemoteMap<T, K>()

  describe('multiple state files', () => {
    let state: wsState.State
    let stateStaticFilesSource: staticFiles.StateStaticFilesSource
    beforeEach(() => {
      stateStaticFilesSource = mockStaticFilesSource()
      state = localState('multiple_files', '', remoteMapCreator, stateStaticFilesSource)
    })

    it('reads all from both files but not from files with an additional suffix', async () => {
      const elements = await awu(await state.getAll()).toArray()
      expect(elements).toHaveLength(4)
      const salesforceState = findReadOldFormatGZipFileCall('multiple_files.salesforce.jsonl.zip') // using old format
      const netsuiteState = findCreateGZipReadStreamCall('multiple_files.netsuite.jsonl.zip')
      const multiExtra = findCreateGZipReadStreamCall('multiple_files_extra.salesforce.jsonl.zip')
      expect(salesforceState).toBeDefined()
      expect(netsuiteState).toBeDefined()
      expect(multiExtra).toBeUndefined()
    })

    it('should have two items in account update list', async () => {
      expect(Object.keys(await (state.getAccountsUpdateDates()))).toEqual(['netsuite', 'salesforce'])
    })

    it('should write two files', async () => {
      await state.set(mockElement)
      await state.flush()
      const salesforceState = findReplaceContentCall('multiple_files.salesforce.jsonl.zip')
      const netsuiteState = findReplaceContentCall('multiple_files.netsuite.jsonl.zip')
      expect(salesforceState).toBeDefined()
      expect(netsuiteState).toBeDefined()
    })

    const mockRename = rename as unknown as jest.Mock
    it('should rename files in new and old format', async () => {
      await state.rename('new')
      expect(mockRename).toHaveBeenCalledTimes(3)
      expect(mockRename).toHaveBeenCalledWith(`multiple_files.salesforce${ZIPPED_STATE_EXTENSION}`,
        `new.salesforce${ZIPPED_STATE_EXTENSION}`)
      expect(mockRename).toHaveBeenCalledWith(`multiple_files.netsuite${ZIPPED_STATE_EXTENSION}`,
        `new.netsuite${ZIPPED_STATE_EXTENSION}`)
      expect(mockRename).toHaveBeenCalledWith(`multiple_files${ZIPPED_STATE_EXTENSION}`,
        `new${ZIPPED_STATE_EXTENSION}`)

      expect(stateStaticFilesSource.rename).toHaveBeenCalledWith('new')
      mockRename.mockClear()
    })

    describe('clear', () => {
      it('should delete two state files', async () => {
        const mockRm = rm as jest.Mock
        mockRm.mockClear()
        await state.clear()
        expect(mockRm).toHaveBeenCalledTimes(3)
        expect(mockRm).toHaveBeenCalledWith(`multiple_files.salesforce${ZIPPED_STATE_EXTENSION}`)
        expect(mockRm).toHaveBeenCalledWith(`multiple_files.netsuite${ZIPPED_STATE_EXTENSION}`)
        expect(mockRm).toHaveBeenCalledWith(`multiple_files${ZIPPED_STATE_EXTENSION}`)
      })
    })
  })

  describe('empty state', () => {
    let state: wsState.State
    beforeEach(() => {
      state = localState('empty', '', remoteMapCreator, mockStaticFilesSource())
    })

    it('should return an undefined hash', async () => {
      const stateHash = await state.getHash()
      expect(stateHash).toBeUndefined()
    })

    it('should return an empty array if there is no saved state', async () => {
      const result = await awu(await state.getAll()).toArray()
      expect(result.length).toBe(0)
    })

    it('should override state successfully, retrieve it and get the same result', async () => {
      const newElem = new ObjectType({ elemID: new ElemID('mock_adapter', 'new') })
      await state.set(newElem)
      await state.override(awu([mockElement]))
      const retrievedState = await awu(await state.getAll()).toArray()
      expect(retrievedState.length).toBe(1)
      const retrievedStateObjectType = retrievedState[0] as ObjectType
      expect(retrievedStateObjectType.isEqual(mockElement)).toBe(true)
    })

    it('should set state successfully, retrieve it and get the same result', async () => {
      await state.set(mockElement)
      const retrievedState = await awu(await state.getAll()).toArray()
      expect(retrievedState.length).toBe(1)
      const retrievedStateObjectType = retrievedState[0] as ObjectType
      expect(retrievedStateObjectType.isEqual(mockElement)).toBe(true)
    })

    it('should update state', async () => {
      await state.set(mockElement)
      const clone = mockElement.clone()
      const newField = Object.values(mockElement.fields)[0]
      newField.name = 'new_field'
      clone.fields.newfield = newField
      await state.set(clone)

      const fromState = await state.get(mockElement.elemID) as ObjectType
      expect(fromState.fields.newfield).toBeDefined()
    })

    it('should add to state', async () => {
      await state.set(mockElement)
      const newElem = new ObjectType({ elemID: new ElemID('mock_adapter', 'new') })
      await state.set(newElem)

      const fromState = await awu(await state.getAll()).toArray()
      expect(fromState.length).toBe(2)
      expect(fromState[0].elemID.name).toBe('new')
    })

    it('should remove from state', async () => {
      await state.set(mockElement)
      let fromState = await awu(await state.getAll()).toArray()
      expect(fromState.length).toBe(1)

      await state.remove(mockElement.elemID)
      fromState = await awu(await state.getAll()).toArray()
      expect(fromState.length).toBe(0)
    })
  })

  it('should read valid state file', async () => {
    const state = localState('full', '', remoteMapCreator, mockStaticFilesSource())
    const elements = await awu(await state.getAll()).toArray()
    expect(elements).toHaveLength(2)
    expect(await state.getStateSaltoVersion()).toBe('0.0.1')
  })

  it('should ignore extra lines', async () => {
    const state = localState('too_long', '', remoteMapCreator, mockStaticFilesSource())
    const elements = await awu(await state.getAll()).toArray()
    expect(elements).toHaveLength(1)
    expect(await state.getStateSaltoVersion()).toBe('0.1.2')
  })

  it('should override path index when asked to', async () => {
    const state = localState('full', '', remoteMapCreator, mockStaticFilesSource())
    await state.overridePathIndex([mockElement])
    const entries = await awu((await state.getPathIndex()).entries()).toArray()
    expect(entries).toEqual(pathIndex.getElementsPathHints([mockElement]))
  })

  it('should update path index when asked to', async () => {
    const state = localState('full', '', remoteMapCreator, mockStaticFilesSource())
    // This doesn't fully test the update functionality. That should be tested in path index test.
    // This just tests that we reach the function.
    await state.updatePathIndex([mockElement], [])
    const entries = await awu((await state.getPathIndex()).entries()).toArray()
    expect(entries).toEqual(pathIndex.getElementsPathHints([mockElement]))
  })

  it('should throw an error if the state nacl file is not valid', async () => {
    const state = localState('error', '', remoteMapCreator, mockStaticFilesSource())
    await expect(state.getAll()).rejects.toThrow()
  })

  it('should write file on flush and update version', async () => {
    const state = localState('on-flush', '', remoteMapCreator, mockStaticFilesSource())
    await state.set(mockElement)
    await state.flush()
    const onFlush = findReplaceContentCall('on-flush.salto.jsonl.zip')
    expect(onFlush).toBeDefined()
    expect(onFlush[1]).toEqual(await promisify(zlibGzip)([
      await serialize([mockElement]),
      safeJsonStringify({}),
      safeJsonStringify([]),
      `"${version}"`,
      '',
    ].join(EOL)))
  })

  it('should return undefined version if the version was not provided in the state file', async () => {
    const state = localState('multiple_adapters', '', remoteMapCreator, mockStaticFilesSource())
    expect(await state.getStateSaltoVersion()).not.toBeDefined()
  })

  describe('deprecated zip state file', () => {
    let state: wsState.State

    beforeEach(async () => {
      state = localState('deprecated_file_zip', '', remoteMapCreator, mockStaticFilesSource())
      await state.getAll() // force read file
    })

    it('should read deprecated file and delete it on write', async () => {
      const mockRm = rm as jest.Mock
      mockRm.mockClear()
      await state.flush()
      const onFlush = findReplaceContentCall('deprecated_file_zip.salesforce.jsonl.zip')
      expect(onFlush).toBeDefined()
      expect(mockRm).toHaveBeenCalledTimes(1)
      expect(mockRm).toHaveBeenCalledWith('deprecated_file_zip.jsonl.zip')
    })
  })

  it('shouldn\'t write file if state was not loaded on flush', async () => {
    const state = localState('not-flush', '', remoteMapCreator, mockStaticFilesSource())
    await state.flush()
    expect(findReplaceContentCall('not-flush')).toBeUndefined()
  })

  describe('getUpdateDate', () => {
    const mockExists = exists as jest.Mock
    const saltoModificationDate = new Date(2010, 10, 10)
    const netsuiteModificationDate = new Date(2011, 10, 10)
    const mockStateStr = [
      safeJsonStringify([]),
      safeJsonStringify({ salto: saltoModificationDate, netsuite: netsuiteModificationDate }),
      safeJsonStringify([]),
    ].join(EOL)

    it('should return an empty object when the state does not exist', async () => {
      mockExists.mockResolvedValueOnce(false)
      const state = localState('filename', '', remoteMapCreator, mockStaticFilesSource())
      const date = await state.getAccountsUpdateDates()
      expect(date).toEqual({})
    })
    it('should return empty object when the updated date is not set', async () => {
      mockExists.mockResolvedValueOnce(true)
      const state = localState('filename', '', remoteMapCreator, mockStaticFilesSource())
      const date = await state.getAccountsUpdateDates()
      expect(date).toEqual({})
    })
    it('should return the modification date of the state', async () => {
      mockExists.mockResolvedValueOnce(true)
      createGZipReadStreamMock.mockResolvedValueOnce(Readable.from(mockStateStr))
      const state = localState('filename', '', remoteMapCreator, mockStaticFilesSource())
      const date = await state.getAccountsUpdateDates()
      expect(date.salto).toEqual(saltoModificationDate)
      expect(date.netsuite).toEqual(netsuiteModificationDate)
    })
    it('should update modification date on override', async () => {
      mockExists.mockResolvedValueOnce(true)
      createGZipReadStreamMock.mockResolvedValueOnce(Readable.from(mockStateStr))
      const now = new Date(2013, 6, 4).getTime()
      jest.spyOn(Date, 'now').mockImplementation(() => now)
      const state = localState('filename', '', remoteMapCreator, mockStaticFilesSource())

      const beforeOverrideDate = await state.getAccountsUpdateDates()
      expect(beforeOverrideDate.salto).toEqual(saltoModificationDate)
      expect(beforeOverrideDate.netsuite).toEqual(netsuiteModificationDate)
      await state.override(awu([mockElement]))
      const overrideDate = await state.getAccountsUpdateDates()
      expect(overrideDate.salto.getTime()).toBe(now)
      expect(beforeOverrideDate.netsuite).toEqual(netsuiteModificationDate)
    })
    it('should not update modification date on set/remove', async () => {
      mockExists.mockResolvedValueOnce(true)
      createGZipReadStreamMock.mockResolvedValueOnce(Readable.from(mockStateStr))
      const state = localState('filename', '', remoteMapCreator, mockStaticFilesSource())

      await state.set(mockElement)
      const overrideDate = await state.getAccountsUpdateDates()
      expect(overrideDate.salto).toEqual(saltoModificationDate)
      expect(overrideDate.netsuite).toEqual(netsuiteModificationDate)
      await state.remove(mockElement.elemID)
      expect(overrideDate.salto).toEqual(saltoModificationDate)
      expect(overrideDate.netsuite).toEqual(netsuiteModificationDate)
    })
    it('should ignore built in types in set ops', async () => {
      mockExists.mockResolvedValueOnce(true)
      const state = localState('empty', '', remoteMapCreator, mockStaticFilesSource())
      await state.set(BuiltinTypes.STRING)
      const overrideDate = await state.getAccountsUpdateDates()
      expect(overrideDate).toEqual({})
    })
  })

  describe('exsitingAdapters', () => {
    it('should return empty list on empty state', async () => {
      const state = localState('empty', '', remoteMapCreator, mockStaticFilesSource())
      const adapters = await state.existingAccounts()
      expect(adapters).toHaveLength(0)
    })
    it('should return all adapters in a full state', async () => {
      const state = localState('multiple_adapters', '', remoteMapCreator, mockStaticFilesSource())
      const adapters = await state.existingAccounts()
      expect(adapters).toEqual(['netsuite', 'salto'])
    })
  })

  describe('getHash', () => {
    it('should call toMd5', async () => {
      const state = localState('empty-state', '', remoteMapCreator, mockStaticFilesSource())
      await state.set(mockElement)
      await state.flush()
      const stateHash = await state.getHash()
      const val = [
        await serialize([mockElement]),
        safeJsonStringify({}),
        safeJsonStringify([]),
        `"${version}"`,
        '',
      ].join(EOL)
      const inner = safeJsonStringify(
        [
          toMD5((await getStream.buffer(createGZipWriteStream(Readable.from(val)))).toString()),
        ]
      )
      expect(stateHash)
        .toEqual(toMD5(inner))
    })
  })

  describe('glob test', () => {
    const glob = promisify(jest.requireActual('glob'))
    const globString = filePathGlob('/tmp/env1')
    it('should match files with correct adapter file name like env1.someadapter.jsonl.zip', async () => {
      const goodFiles = [`env1.someadapter${ZIPPED_STATE_EXTENSION}`,
        `env1.anotheradapter${ZIPPED_STATE_EXTENSION}`]
      const results = await glob(globString, { cache: {
        '/tmp': goodFiles,
      } })
      expect(results.sort()).toEqual(goodFiles.map(file => `/tmp/${file}`).sort())
    })
    it('should not match files with less or more that two seperating dots', async () => {
      const badFiles = [`env1${ZIPPED_STATE_EXTENSION}`,
        `env1.one.two${ZIPPED_STATE_EXTENSION}`]
      const results = await glob(globString, { cache: {
        '/tmp': badFiles,
      } })
      expect(results).toEqual([])
    })
  })
  describe('when cache does not match state file', () => {
    let state: wsState.State
    let mapCreator: remoteMap.RemoteMapCreator
    beforeEach(() => {
      mapCreator = inMemRemoteMapCreator()
      state = localState('multiple_files', '', mapCreator, mockStaticFilesSource())
    })
    describe('flush', () => {
      beforeEach(async () => {
        // Force loading the state so it detects the cache is outdated
        await state.getHash()
        await state.flush()
      })
      it('should update the cache remote maps', async () => {
        const cachedMetadata = await mapCreator<string>({
          namespace: 'state--salto_metadata',
          serialize: async x => x,
          deserialize: async x => x,
          persistent: false,
        })
        const currentStateHash = await state.getHash()
        const cachedHash = await cachedMetadata.get('hash')
        expect(cachedHash).toEqual(currentStateHash)
        expect(cachedHash).toBeDefined()
      })
    })
  })
  describe('calculateHash', () => {
    let state: wsState.State
    let mapCreator: remoteMap.RemoteMapCreator
    beforeEach(() => {
      mapCreator = inMemRemoteMapCreator()
      state = localState('multiple_files', '', mapCreator, mockStaticFilesSource())
    })
    describe('when cache is changed in memory', () => {
      let origHash: string | undefined
      let calculatedHash: string | undefined
      beforeEach(async () => {
        origHash = await state.getHash()
        await state.set(new ObjectType({ elemID: new ElemID('salesforce', 'dummy') }))
        await state.calculateHash()
        calculatedHash = await state.getHash()
      })
      it('should calculate a new hash', () => {
        expect(calculatedHash).not.toEqual(origHash)
      })
    })
    describe('when cache is not changed in memory', () => {
      let origHash: string | undefined
      let calculatedHash: string | undefined
      beforeEach(async () => {
        origHash = await state.getHash()
        await state.calculateHash()
        calculatedHash = await state.getHash()
      })
      it('should return the original hash', () => {
        expect(calculatedHash).toEqual(origHash)
      })
    })
  })
})
