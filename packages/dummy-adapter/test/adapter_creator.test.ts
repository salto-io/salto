/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  InstanceElement,
  ConfigCreator,
  ElemID,
  FetchResult,
  DumpElementsResult,
  toChange,
  InitFolderResult,
  IsInitializedFolderResult,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements, createDefaultInstanceFromType } from '@salto-io/adapter-utils'
import * as loadLocalWorkspaceModule from '@salto-io/local-workspace'
import { Workspace } from '@salto-io/workspace'
import { adapter } from '../src/adapter_creator'
import { defaultParams, DUMMY_ADAPTER } from '../src/generator'
import DummyAdapter from '../src/adapter'

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(),
}))

jest.mock('readdirp', () => ({
  ...jest.requireActual('readdirp'),
  promise: jest.fn(),
}))

jest.mock('@salto-io/local-workspace', () => {
  const actual = jest.requireActual('@salto-io/local-workspace')
  return {
    ...actual,
    loadLocalWorkspace: jest.fn().mockImplementation(actual.loadLocalWorkspace),
    initLocalWorkspace: jest.fn().mockImplementation(actual.initLocalWorkspace),
  }
})

const mockedLocalWorkspace = jest.mocked(loadLocalWorkspaceModule)

describe('adapter creator', () => {
  it('should return a config containing all of the generator params', () => {
    const config = adapter.configType as ObjectType
    expect(Object.keys(config?.fields)).toEqual([
      ...Object.keys(defaultParams),
      'changeErrors',
      'extraNaclPaths',
      'generateEnvName',
      'fieldsToOmitOnDeploy',
      'elementsToExclude',
      'fetchErrors',
    ])
  })
  it('should return an empty creds type', () => {
    expect(Object.keys(adapter.authenticationMethods.basic.credentialsType.fields)).toHaveLength(0)
  })
  it('should have a credential validator that does nothing and return an empty id', async () => {
    expect(
      await adapter.validateCredentials(
        new InstanceElement(DUMMY_ADAPTER, adapter.authenticationMethods.basic.credentialsType),
      ),
    ).toEqual({ accountId: '' })
  })
  it('should return the dummy adapter', () => {
    expect(
      adapter.operations({
        credentials: new InstanceElement(DUMMY_ADAPTER, adapter.authenticationMethods.basic.credentialsType),
        config: new InstanceElement(DUMMY_ADAPTER, adapter.configType as ObjectType, defaultParams),
        elementsSource: buildElementsSourceFromElements([]),
      }),
    ).toBeInstanceOf(DummyAdapter)
  })
  describe('adapter format', () => {
    let dummyObject: ObjectType
    describe('loadElementsFromFolder', () => {
      let fetchResult: FetchResult
      beforeEach(async () => {
        dummyObject = new ObjectType({ elemID: new ElemID('dummy', 'test') })
        mockedLocalWorkspace.loadLocalWorkspace.mockResolvedValue({
          elements: () => buildElementsSourceFromElements([dummyObject]),
        } as unknown as Workspace)
        fetchResult = (await adapter.adapterFormat?.loadElementsFromFolder?.({
          baseDir: 'some_path',
          elementsSource: buildElementsSourceFromElements([]),
        })) as FetchResult
      })
      it('should load the elements from the workspace', () => {
        expect(fetchResult.elements).toEqual([dummyObject])
      })
    })
    describe('dumpElementsToFolder', () => {
      let dumpElementsToFolderResult: DumpElementsResult
      const mockUpdateNaclFiles = jest.fn()
      const mockFlush = jest.fn()
      beforeEach(async () => {
        jest.clearAllMocks()
        mockedLocalWorkspace.loadLocalWorkspace.mockResolvedValue({
          elements: () => buildElementsSourceFromElements([dummyObject]),
          updateNaclFiles: mockUpdateNaclFiles,
          flush: mockFlush,
        } as unknown as Workspace)
        dumpElementsToFolderResult = (await adapter.adapterFormat?.dumpElementsToFolder?.({
          changes: [toChange({ before: dummyObject })],
          baseDir: 'some_path',
          elementsSource: buildElementsSourceFromElements([]),
        })) as DumpElementsResult
      })
      it('should return no errors, and no unapplied changes', () => {
        expect(dumpElementsToFolderResult.errors).toEqual([])
        expect(dumpElementsToFolderResult.unappliedChanges).toEqual([])
      })
      it('should call updateNaclFiles, and flush', () => {
        expect(mockUpdateNaclFiles).toHaveBeenCalledTimes(1)
        expect(mockFlush).toHaveBeenCalledTimes(1)
      })
    })
    describe('initFolder', () => {
      let initFolderResult: InitFolderResult
      beforeEach(async () => {
        dummyObject = new ObjectType({ elemID: new ElemID('dummy', 'test') })
        mockedLocalWorkspace.initLocalWorkspace.mockResolvedValue({} as unknown as Workspace)
        initFolderResult = (await adapter.adapterFormat?.initFolder?.({
          baseDir: 'some_path',
        })) as InitFolderResult
      })
      it('should init the local workspace', () => {
        expect(mockedLocalWorkspace.initLocalWorkspace).toHaveBeenCalledWith(
          'some_path',
          'dummy',
          [],
          expect.any(Function),
        )
      })
      it('should return no errors', () => {
        expect(initFolderResult.errors).toEqual([])
      })
    })
    describe('isInitializedFolder', () => {
      let isInitializedFolderResult: IsInitializedFolderResult
      it('should return true if loadWorkspace succeeds', async () => {
        mockedLocalWorkspace.loadLocalWorkspace.mockResolvedValue({
          elements: () => buildElementsSourceFromElements([dummyObject]),
        } as unknown as Workspace)
        isInitializedFolderResult = (await adapter.adapterFormat?.isInitializedFolder?.({
          baseDir: 'some_path',
        })) as IsInitializedFolderResult
        expect(isInitializedFolderResult.result).toEqual(true)
      })
      it('should return true if loadWorkspace fails', async () => {
        mockedLocalWorkspace.loadLocalWorkspace.mockRejectedValue(new Error())
        isInitializedFolderResult = (await adapter.adapterFormat?.isInitializedFolder?.({
          baseDir: 'some_path',
        })) as IsInitializedFolderResult
        expect(isInitializedFolderResult.result).toEqual(false)
        expect(isInitializedFolderResult.errors).toEqual([])
      })
    })
  })

  describe('configCreator', () => {
    it('should return the default config regardless of input', async () => {
      const creator = adapter.configCreator as ConfigCreator
      expect(creator).toBeDefined()
      const defaultConfig = await createDefaultInstanceFromType(ElemID.CONFIG_NAME, adapter.configType as ObjectType)
      const createdConfig = await creator.getConfig(new InstanceElement('input', creator.optionsType, {}))
      expect(createdConfig).toEqual(defaultConfig)
    })
  })
})
