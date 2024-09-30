/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import fs from 'fs'
import readdirp from 'readdirp'
import { ObjectType, InstanceElement, ConfigCreator, ElemID, FetchResult } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements, createDefaultInstanceFromType } from '@salto-io/adapter-utils'
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

const mockedFs = fs as jest.Mocked<typeof fs>
const mockedReaddirp = readdirp as jest.Mocked<typeof readdirp>

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
  describe('loadElementsFromFolder', () => {
    let loadedElements: FetchResult | undefined
    describe('When the path exists and contains a valid NaCl file', () => {
      let remoteNaclDir: string
      const naclFileContents = `
      type dummy.SomeType {
        annotations {
        }        
      }
      `
      beforeEach(async () => {
        const originalReadFileSync = jest.requireActual('fs').readFileSync
        mockedFs.readFileSync
          .mockImplementationOnce((path): string => {
            remoteNaclDir = path as string
            return naclFileContents
          })
          .mockImplementation((path, encoding) => originalReadFileSync(path, encoding))
        mockedReaddirp.promise.mockImplementation(
          async (dir): Promise<readdirp.EntryInfo[]> =>
            Promise.resolve([
              {
                path: 'some_type.nacl',
                fullPath: `${dir}/some_type.nacl`,
                basename: 'some_type.nacl',
              },
            ]),
        )
        loadedElements = await adapter.loadElementsFromFolder?.({
          baseDir: 'some_path',
          elementsSource: buildElementsSourceFromElements([]),
        })
      })
      afterEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
      })
      it('should fetch elements from the correct dir', () => {
        expect(remoteNaclDir).toEqual('some_path/some_type.nacl')
      })
      it('should load the NaCl file from the provided dir', () => {
        expect(loadedElements?.elements).toHaveLength(1)
        expect(loadedElements?.elements[0]).toHaveProperty('elemID', new ElemID(DUMMY_ADAPTER, 'SomeType'))
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
