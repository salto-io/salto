/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import path from 'path'
import _ from 'lodash'
import { Readable } from 'stream'
import { createGzip } from 'zlib'
import getStream from 'get-stream'
import { chain } from 'stream-chain'
import { ObjectType, ElemID, isObjectType, Element, toChange, InstanceElement, StaticFile } from '@salto-io/adapter-api'
import { getDetailedChanges, safeJsonStringify } from '@salto-io/adapter-utils'
import {
  state as wsState,
  pathIndex,
  remoteMap,
  staticFiles,
  serialization,
  StateConfig,
  ProviderOptionsS3,
} from '@salto-io/workspace'
import { hash, collections } from '@salto-io/lowerdash'
import { mockFunction, setupTmpDir } from '@salto-io/test-utils'
import { getStateContentProvider, loadState, localState, parseStateContent } from '../../src/state/state'
import * as stateFunctions from '../../src/state/state'
import { getTopLevelElements } from '../common/elements'
import { mockStaticFilesSource } from '../common/state'
import { getHashFromHashes, StateContentProvider } from '../../src/state/content_providers'
import * as contentProviders from '../../src/state/content_providers'
import { getLocalStoragePath } from '../../src/app_config'

const { awu } = collections.asynciterable
const { toMD5 } = hash

type MockStateContentArgs = {
  format: 'new' | 'old'
  elements: Element[]
  pathIndexLine?: string
  extraLine?: string
}
const mockStateContent = async ({
  format,
  elements,
  pathIndexLine = '[]',
  extraLine,
}: MockStateContentArgs): Promise<Buffer> => {
  const accountName = elements[0].elemID.adapter
  const stateContentLines = {
    old: async (): Promise<string[]> => {
      const dateLine = safeJsonStringify({ [accountName]: accountName })
      const elementsLine = await serialization.serialize(elements)
      return [elementsLine, dateLine, pathIndexLine]
    },
    new: async (): Promise<string[]> => {
      const deprecatedLines = ['[]', '{}', '[]', '""']
      const accountNameLine = safeJsonStringify({ accounts: [accountName] })
      const elementsLines = await Promise.all(
        _.chunk(elements, elements.length / 2).map(
          async chunk => `{"elements":${await serialization.serialize(chunk)}}`,
        ),
      )
      const pathIndicesLine = `{"pathIndices":${pathIndexLine}}`
      return deprecatedLines.concat(accountNameLine).concat(elementsLines).concat(pathIndicesLine)
    },
  }
  const lines = await stateContentLines[format]()
  if (extraLine !== undefined) {
    lines.push(extraLine)
  }
  return getStream.buffer(chain([Readable.from(lines.join('\n')), createGzip()]))
}

describe('localState', () => {
  const mockElement = getTopLevelElements().find(isObjectType) as ObjectType

  const mockContentProvider = (fileContents: Record<string, Buffer>): jest.Mocked<StateContentProvider> => {
    let currentContent = fileContents
    return {
      findStateFiles: mockFunction<StateContentProvider['findStateFiles']>().mockImplementation(async () =>
        Object.keys(currentContent),
      ),
      clear: mockFunction<StateContentProvider['clear']>(),
      rename: mockFunction<StateContentProvider['rename']>(),
      getHash: mockFunction<StateContentProvider['getHash']>().mockImplementation(async filePaths =>
        getHashFromHashes(Object.values(_.pick(currentContent, filePaths)).map(content => toMD5(content.toString()))),
      ),
      readContents: mockFunction<StateContentProvider['readContents']>().mockImplementation(filePaths =>
        awu(Object.entries(filePaths.length > 0 ? _.pick(currentContent, filePaths) : currentContent)).map(
          ([name, content]) => ({
            name,
            stream: Readable.from(content),
          }),
        ),
      ),
      writeContents: mockFunction<StateContentProvider['writeContents']>().mockImplementation(
        async (prefix, newContents) => {
          currentContent = Object.fromEntries(
            newContents.map(({ account, content }) => [`${prefix}/${account}`, content]),
          )
        },
      ),
      staticFilesSource: mockStaticFilesSource(),
    }
  }

  describe.each(['old', 'new'] as const)('multiple state files - %s state format', stateFormat => {
    let state: wsState.State
    let contentProvider: jest.Mocked<StateContentProvider>
    let sfElements: Element[]
    let nsElements: Element[]
    let initialStateHash: string | undefined
    const pathPrefix = 'multiple_files'
    let mapCreator: remoteMap.RemoteMapCreator
    beforeEach(async () => {
      process.env.SALTO_DUMP_STATE_WITH_LEGACY_FORMAT = stateFormat === 'new' ? '0' : '1'
      nsElements = getTopLevelElements('netsuite')
      sfElements = getTopLevelElements('salesforce')
      contentProvider = mockContentProvider({
        [`${pathPrefix}/netsuite`]: await mockStateContent({
          format: stateFormat,
          elements: nsElements,
        }),
        [`${pathPrefix}/salesforce`]: await mockStateContent({
          format: stateFormat,
          elements: sfElements,
        }),
      })
      mapCreator = remoteMap.inMemRemoteMapCreator()
      state = localState(pathPrefix, 'env', mapCreator, contentProvider)
      initialStateHash = await state.getHash()
    })
    afterEach(() => {
      delete process.env.SALTO_DUMP_STATE_WITH_LEGACY_FORMAT
    })

    it('should read elements from both state files', async () => {
      const elements = await awu(await state.getAll()).toArray()
      expect(elements).toHaveLength(nsElements.length + sfElements.length)
    })

    describe('existingAccounts', () => {
      it('should return both accounts', async () => {
        await expect(state.existingAccounts()).resolves.toHaveLength(2)
      })
    })
    describe('flush when nothing changed', () => {
      it('should not write new content', async () => {
        await state.flush()
        expect(contentProvider.writeContents).not.toHaveBeenCalled()
      })
    })
    describe('flush after setting a value', () => {
      beforeEach(async () => {
        await state.set(mockElement)
        await state.flush()
      })
      it('should write updated content', async () => {
        expect(contentProvider.writeContents).toHaveBeenCalledWith(
          pathPrefix,
          expect.arrayContaining(
            ['netsuite', 'salesforce', 'salto'].map(account => ({
              account,
              content: expect.any(Buffer),
              contentHash: expect.any(String),
            })),
          ),
        )
      })
      it('should set new hash value', async () => {
        await expect(state.getHash()).resolves.not.toEqual(initialStateHash)
      })
      it('should write state file correctly', async () => {
        const res = await parseStateContent(contentProvider.readContents([]))
        expect(new Set(Object.keys(res))).toEqual(new Set(['accounts', 'pathIndices', 'elements']))
        expect(res.pathIndices).toEqual([])
        expect(res.accounts).toEqual(['netsuite', 'salesforce', 'salto'])
        const originalElements = nsElements.concat(sfElements).concat(mockElement)
        expect(res.elements).toHaveLength(originalElements.length)
        res.elements.forEach(resElement => {
          expect(originalElements.find(elem => elem.isEqual(resElement))).toBeDefined()
        })
      })
    })

    describe('flush after updateStateFromChanges', () => {
      it('should write new contents', async () => {
        await state.updateStateFromChanges({
          changes: getDetailedChanges(toChange({ after: mockElement })),
          unmergedElements: [mockElement],
        })
        await state.flush()
        expect(contentProvider.writeContents).toHaveBeenCalled()
      })
    })

    it('should rename files', async () => {
      await state.rename('new')
      expect(contentProvider.rename).toHaveBeenCalledWith(pathPrefix, 'new')
    })

    it('should clear contents when clear is called', async () => {
      await state.clear()
      expect(contentProvider.clear).toHaveBeenCalled()
    })

    it('should update path index when asked to', async () => {
      // This doesn't fully test the update functionality. That should be tested in path index test.
      // This just tests that we reach the function.
      await state.updateStateFromChanges({ changes: [], unmergedElements: [mockElement] })
      const entries = await awu((await state.getPathIndex()).entries()).toArray()
      expect(entries).toEqual(pathIndex.getElementsPathHints([mockElement]))
    })

    describe('when cache does not match state file', () => {
      describe('flush', () => {
        beforeEach(async () => {
          // Force loading the state so it detects the cache is outdated
          await state.getHash()
          await state.flush()
        })
        it('should update the cache remote maps', async () => {
          const cachedMetadata = await mapCreator.create<string>({
            namespace: 'state-env-salto_metadata',
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
      it('should set the hash to be according to the un-flushed current data', async () => {
        const hashBeforeSet = await state.getHash()
        await state.set(getTopLevelElements('new')[0])
        const hashBeforeCalc = await state.getHash()
        await state.calculateHash()
        const hashAfterCalc = await state.getHash()
        expect(hashBeforeSet).toEqual(hashBeforeCalc)
        expect(hashBeforeCalc).not.toEqual(hashAfterCalc)
      })
    })

    describe('when flushing multiple times', () => {
      beforeEach(async () => {
        await state.set(getTopLevelElements('newAccount')[0])
        await state.flush()
        await state.set(getTopLevelElements('newerAccount')[0])
        await state.flush()
      })
      it('should write the content of the final data', () => {
        expect(contentProvider.writeContents).toHaveBeenLastCalledWith(
          pathPrefix,
          expect.arrayContaining(
            ['netsuite', 'salesforce', 'newAccount', 'newerAccount'].map(account => ({
              account,
              content: expect.any(Buffer),
              contentHash: expect.any(String),
            })),
          ),
        )
      })
    })

    describe('updateConfig', () => {
      let getStateContentProviderSpy: jest.SpiedFunction<typeof getStateContentProvider>
      let newContentProvider: jest.Mocked<StateContentProvider>
      beforeEach(async () => {
        getStateContentProviderSpy = jest.spyOn(stateFunctions, 'getStateContentProvider')
        newContentProvider = mockContentProvider({})
        getStateContentProviderSpy.mockReturnValue(newContentProvider)
      })
      afterEach(() => {
        getStateContentProviderSpy.mockRestore()
      })
      describe('when writing to the new provider works', () => {
        beforeEach(async () => {
          await state.updateConfig({ workspaceId: 'wsId', stateConfig: undefined })
        })
        it('should write the contents of the current provider to the new provider', () => {
          expect(newContentProvider.writeContents).toHaveBeenLastCalledWith(
            expect.any(String),
            expect.arrayContaining(
              ['netsuite', 'salesforce'].map(account => ({
                account,
                content: expect.any(Buffer),
                contentHash: expect.any(String),
              })),
            ),
          )
        })
        it('should clear the old content provider', () => {
          expect(contentProvider.clear).toHaveBeenCalled()
        })
        it('should end with the new provider having state files in the correct prefix', async () => {
          expect(await newContentProvider.findStateFiles(pathPrefix)).toHaveLength(2)
        })
      })
      describe('when writing to the new provider fails', () => {
        let result: Promise<void>
        beforeEach(() => {
          newContentProvider.writeContents.mockRejectedValue(new Error('failed to write content'))
          result = state.updateConfig({ workspaceId: 'wsId', stateConfig: undefined })
        })
        it('should fail', async () => {
          await expect(result).rejects.toThrow()
        })
        it('should not clear the old provider', async () => {
          try {
            await result
          } catch {
            // We expect this to fail
          }
          expect(contentProvider.clear).not.toHaveBeenCalled()
        })
      })
    })
  })

  describe('empty state', () => {
    let state: wsState.State
    let contentProvider: jest.Mocked<StateContentProvider>
    beforeEach(() => {
      contentProvider = mockContentProvider({})
      state = localState('empty', '', remoteMap.inMemRemoteMapCreator(), contentProvider)
    })

    it('should return an undefined hash', async () => {
      const stateHash = await state.getHash()
      expect(stateHash).toBeUndefined()
    })

    it('existingAccounts should be an empty list', async () => {
      await expect(state.existingAccounts()).resolves.toHaveLength(0)
    })

    it('should return an empty array if there is no saved state', async () => {
      const result = await awu(await state.getAll()).toArray()
      expect(result.length).toBe(0)
    })

    it('should update state successfully, retrieve it and get the updated result', async () => {
      const newElem = new ObjectType({ elemID: new ElemID('mock_adapter', 'new') })
      await state.set(newElem)
      await state.updateStateFromChanges({
        changes: [{ action: 'add', data: { after: mockElement }, id: mockElement.elemID }],
      })
      const retrievedState = await awu(await state.getAll()).toArray()
      expect(retrievedState.length).toBe(2)
      const retrievedState1ObjectType = retrievedState[0] as ObjectType
      const retrievedState2ObjectType = retrievedState[1] as ObjectType
      expect(retrievedState1ObjectType.isEqual(newElem)).toBe(true)
      expect(retrievedState2ObjectType.isEqual(mockElement)).toBe(true)
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
      clone.fields.newField = newField
      await state.set(clone)

      const fromState = (await state.get(mockElement.elemID)) as ObjectType
      expect(fromState.fields.newField).toBeDefined()
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

    describe('calculateHash', () => {
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

  describe.each(['old', 'new'] as const)('malformed state data - %s state format', stateFormat => {
    let state: wsState.State
    let contentProvider: jest.Mocked<StateContentProvider>

    beforeEach(async () => {
      process.env.SALTO_DUMP_STATE_WITH_LEGACY_FORMAT = stateFormat === 'new' ? '0' : '1'
      contentProvider = mockContentProvider({
        'env/noVersion': await mockStateContent({
          format: stateFormat,
          elements: getTopLevelElements(),
        }),
        'env/extraLine': await mockStateContent({
          format: stateFormat,
          elements: getTopLevelElements('extra'),
          extraLine: '"more data?"',
        }),
        'env/emptyVersion': await mockStateContent({
          format: stateFormat,
          elements: getTopLevelElements('noVersion'),
        }),
      })
      state = localState('malformed', '', remoteMap.inMemRemoteMapCreator(), contentProvider)
    })

    afterEach(() => {
      delete process.env.SALTO_DUMP_STATE_WITH_LEGACY_FORMAT
    })

    it('should still read elements successfully', async () => {
      await expect(state.getAll()).resolves.toBeDefined()
      const elements = await awu(await state.getAll()).toArray()
      expect(elements).toHaveLength(getTopLevelElements().length * 3)
    })
    it('should write state file correctly', async () => {
      await state.set(mockElement)
      await state.flush()

      expect(contentProvider.writeContents).toHaveBeenCalled()
      const res = await parseStateContent(contentProvider.readContents([]))
      expect(new Set(Object.keys(res))).toEqual(new Set(['accounts', 'pathIndices', 'elements']))
      expect(res.pathIndices).toEqual([])
      expect(res.accounts).toEqual(['extra', 'noVersion', 'salto'])
      const originalElements = getTopLevelElements()
        .concat(getTopLevelElements('extra'))
        .concat(getTopLevelElements('noVersion'))
      expect(res.elements).toHaveLength(originalElements.length)
      res.elements.forEach(resElement => {
        expect(originalElements.find(elem => elem.isEqual(resElement))).toBeDefined()
      })
    })
  })

  describe('when given an overriding static files source', () => {
    let state: wsState.State
    let contentProvider: jest.Mocked<StateContentProvider>
    let overridingStateFilesSource: staticFiles.StateStaticFilesSource
    let instanceWithStaticFile: InstanceElement

    const testDir = setupTmpDir()

    beforeEach(() => {
      instanceWithStaticFile = new InstanceElement('inst', mockElement, {
        content: new StaticFile({ filepath: 'path', content: Buffer.from('asd') }),
      })
      overridingStateFilesSource = mockStaticFilesSource([])
      contentProvider = mockContentProvider({})
      state = localState(
        path.join(testDir.name(), 'empty'),
        '',
        remoteMap.inMemRemoteMapCreator(),
        contentProvider,
        overridingStateFilesSource,
      )
    })
    it('should use the overriding files source and not the one from the content provider', async () => {
      await state.set(instanceWithStaticFile)
      await state.flush()
      expect(overridingStateFilesSource.flush).toHaveBeenCalledTimes(1)
      expect(contentProvider.staticFilesSource.flush).not.toHaveBeenCalled()
    })
    it('should keep the overriding static file source after config update', async () => {
      await state.updateConfig({ workspaceId: 'wsId', stateConfig: undefined })
      await state.set(instanceWithStaticFile)
      await state.flush()
      expect(overridingStateFilesSource.flush).toHaveBeenCalledTimes(1)
      expect(contentProvider.staticFilesSource.flush).not.toHaveBeenCalled()
    })
  })
})

describe('getStateContentProvider', () => {
  describe('when called with empty state config', () => {
    it('should return a file content provider', () => {
      const createFileStateContentProvider = jest.spyOn(contentProviders, 'createFileStateContentProvider')
      getStateContentProvider('workspaceId')
      expect(createFileStateContentProvider).toHaveBeenCalled()
    })
  })
  describe('when state config says file provider', () => {
    it('should return a file content provider', () => {
      const createFileStateContentProvider = jest.spyOn(contentProviders, 'createFileStateContentProvider')
      getStateContentProvider('workspaceId', { provider: 'file' })
      expect(createFileStateContentProvider).toHaveBeenCalledWith(getLocalStoragePath('workspaceId'))
    })
    describe('when local storage is provided in the config', () => {
      it('should use the local storage from the config', () => {
        const createFileStateContentProvider = jest.spyOn(contentProviders, 'createFileStateContentProvider')
        getStateContentProvider('workspaceId', {
          provider: 'file',
          options: { file: { localStorageDir: 'myLocalStorage' } },
        })
        expect(createFileStateContentProvider).toHaveBeenCalledWith('myLocalStorage')
      })
    })
  })
  describe('when state config says s3 provider', () => {
    describe('when the config is valid', () => {
      it('should return a s3 content provider', () => {
        const createS3StateContentProvider = jest.spyOn(contentProviders, 'createS3StateContentProvider')
        const s3Options: ProviderOptionsS3 = { bucket: 'my_bucket', prefix: 'my_prefix' }
        getStateContentProvider('workspaceId', { provider: 's3', options: { s3: s3Options } })
        expect(createS3StateContentProvider).toHaveBeenCalledWith({ workspaceId: 'workspaceId', options: s3Options })
      })
    })
    describe('when the config is missing the bucket', () => {
      it('should fail', () => {
        expect(() => getStateContentProvider('workspaceId', { provider: 's3' })).toThrow()
        expect(() => getStateContentProvider('workspaceId', { provider: 's3', options: {} })).toThrow()
        expect(() =>
          getStateContentProvider('workspaceId', {
            provider: 's3',
            options: { s3: {} as unknown as ProviderOptionsS3 },
          }),
        ).toThrow()
      })
    })
  })
  describe('when state config says unknown provider', () => {
    it('should fail', () => {
      expect(() =>
        getStateContentProvider('workspaceId', { provider: 'something' } as unknown as StateConfig),
      ).toThrow()
    })
  })
})

describe('loadState', () => {
  describe('when called with an empty state config', () => {
    it('should create a file content provider by default', () => {
      const createFileStateContentProvider = jest.spyOn(contentProviders, 'createFileStateContentProvider')
      loadState({
        workspaceId: 'workspaceId',
        baseDir: 'baseDir',
        envName: 'env',
        remoteMapCreator: remoteMap.inMemRemoteMapCreator(),
        staticFilesSource: mockStaticFilesSource(),
        persistent: false,
      })
      expect(createFileStateContentProvider).toHaveBeenCalled()
    })
  })
})
