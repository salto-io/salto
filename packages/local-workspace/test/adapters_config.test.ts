/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { MockInterface } from '@salto-io/test-utils'
import { remoteMap, nacl } from '@salto-io/workspace'
import { localDirectoryStore, createExtensionFileFilter } from '../src/dir_store'
import { buildLocalAdaptersConfigSource } from '../src/adapters_config'
import { createMockNaclFileSource } from './common/nacl_file_source'

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
jest.mock('../src/dir_store')
describe('adapters local config', () => {
  let mockNaclFilesSource: MockInterface<nacl.NaclFilesSource>

  beforeEach(async () => {
    jest.resetAllMocks()
    mockNaclFilesSource = createMockNaclFileSource()
    ;(nacl.naclFilesSource as jest.Mock).mockResolvedValue(mockNaclFilesSource)
    mockNaclFilesSource.load.mockResolvedValue({ changes: [], cacheValid: true })

    await buildLocalAdaptersConfigSource({
      baseDir: 'baseDir',
      remoteMapCreator: remoteMap.inMemRemoteMapCreator(),
      persistent: true,
      configTypes: [],
      configOverrides: [],
      envs: [],
      adapterCreators: {},
    })
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
