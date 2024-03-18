/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import fs from 'fs'
import { logger } from '@salto-io/logging'
import { ObjectType, InstanceElement } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements, safeJsonStringify } from '@salto-io/adapter-utils'
import { adapter } from '../src/adapter_creator'
import { defaultParams, DUMMY_ADAPTER } from '../src/generator'
import DummyAdapter from '../src/adapter'

const log = logger(module)

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(),
}))

const mockedFs = fs as jest.Mocked<typeof fs>

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
    describe('When the path does not exist', () => {
      it('should throw', async () => {
        await expect(async () => {
          await adapter.loadElementsFromFolder?.({
            baseDir: 'this_path_does_not_exist',
            elementsSource: buildElementsSourceFromElements([]),
          })
        }).rejects.toThrow()
      })
    })
    describe('When the path exists and contains a valid config', () => {
      let configFilePath: string
      const adapterOpsFetchSpy = jest.spyOn(DummyAdapter.prototype, 'fetch')
      beforeEach(async () => {
        const originalReadFileSync = jest.requireActual('fs').readFileSync
        mockedFs.readFileSync
          .mockImplementationOnce((path): string => {
            configFilePath = path as string
            return safeJsonStringify({
              seed: 0,
              numOfPrimitiveTypes: 1,
              numOfTypes: 1,
              numOfObjs: 1,
              numOfRecords: 1,
              fakeConfig: true,
            })
          })
          .mockImplementation((path, encoding) => {
            log.debug('Redirecting %s', path)
            return originalReadFileSync(path, encoding)
          })
        await adapter.loadElementsFromFolder?.({
          baseDir: 'some_path',
          elementsSource: buildElementsSourceFromElements([]),
        })
      })
      afterEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
      })
      it('should fetch elements from the correct dir', () => {
        expect(configFilePath).toEqual('some_path/dummy.nacl')
      })
      it('should call fetch for the provided dir', () => {
        expect(adapterOpsFetchSpy).toHaveBeenCalled()
      })
    })
  })
})
