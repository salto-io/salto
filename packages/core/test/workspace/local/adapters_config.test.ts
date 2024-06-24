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
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { nacl, remoteMap, validator } from '@salto-io/workspace'
import { localDirectoryStore, createExtensionFileFilter } from '../../../src/local-workspace/dir_store'
import { buildLocalAdaptersConfigSource } from '../../../src/local-workspace/adapters_config'
import { createMockNaclFileSource } from '../../common/nacl_file_source'

jest.mock('@salto-io/workspace', () => {
  const actual = jest.requireActual('@salto-io/workspace')
  return {
    ...actual,
    staticFiles: {
      ...actual.staticFiles,
      buildStaticFilesSource: jest.fn(),
    },
    nacl: {
      ...actual.nacl,
      naclFilesSource: jest.fn(),
    },
  }
})
jest.mock('../../../src/local-workspace/dir_store')
describe('adapters local config', () => {
  let mockNaclFilesSource: MockInterface<nacl.NaclFilesSource>
  let validationErrorsMap: MockInterface<remoteMap.RemoteMap<validator.ValidationError[]>>

  beforeEach(async () => {
    jest.resetAllMocks()
    mockNaclFilesSource = createMockNaclFileSource()
    ;(nacl.naclFilesSource as jest.Mock).mockResolvedValue(mockNaclFilesSource)
    mockNaclFilesSource.load.mockResolvedValue({ changes: [], cacheValid: true })

    validationErrorsMap = {
      delete: mockFunction<remoteMap.RemoteMap<validator.ValidationError[]>['delete']>(),
      get: mockFunction<remoteMap.RemoteMap<validator.ValidationError[]>['get']>(),
      getMany: mockFunction<remoteMap.RemoteMap<validator.ValidationError[]>['getMany']>(),
      has: mockFunction<remoteMap.RemoteMap<validator.ValidationError[]>['has']>(),
      set: mockFunction<remoteMap.RemoteMap<validator.ValidationError[]>['set']>(),
      setAll: mockFunction<remoteMap.RemoteMap<validator.ValidationError[]>['setAll']>(),
      deleteAll: mockFunction<remoteMap.RemoteMap<validator.ValidationError[]>['deleteAll']>(),
      entries: mockFunction<remoteMap.RemoteMap<validator.ValidationError[]>['entries']>(),
      keys: mockFunction<remoteMap.RemoteMap<validator.ValidationError[]>['keys']>(),
      values: mockFunction<remoteMap.RemoteMap<validator.ValidationError[]>['values']>(),
      flush: mockFunction<remoteMap.RemoteMap<validator.ValidationError[]>['flush']>(),
      revert: mockFunction<remoteMap.RemoteMap<validator.ValidationError[]>['revert']>(),
      clear: mockFunction<remoteMap.RemoteMap<validator.ValidationError[]>['clear']>(),
      close: mockFunction<remoteMap.RemoteMap<validator.ValidationError[]>['close']>(),
      isEmpty: mockFunction<remoteMap.RemoteMap<validator.ValidationError[]>['isEmpty']>(),
    }

    await buildLocalAdaptersConfigSource(
      'baseDir',
      mockFunction<remoteMap.RemoteMapCreator>().mockResolvedValue(validationErrorsMap),
      true,
      [],
      [],
    )
  })

  describe('initialization', () => {
    it('should initialize the dirstore to look only under salto.config/adapters', () => {
      expect(localDirectoryStore).toHaveBeenCalledWith({
        baseDir: 'baseDir',
        accessiblePath: 'salto.config/adapters',
        encoding: 'utf8',
      })
      expect(createExtensionFileFilter).toHaveBeenCalledWith('.nacl')
    })
  })
})
