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
import _ from 'lodash'
import { readFile, writeFile, mkdirp, rm, rename } from '@salto-io/file'
import osPath from 'path'
import { buildNetsuiteQuery, notQuery } from '../../src/config/query'
import mockClient, { DUMMY_CREDENTIALS } from './sdf_client'
import { APPLICATION_ID, CONFIG_FEATURES, FILE_CABINET_PATH_SEPARATOR } from '../../src/constants'
import SdfClient, { COMMANDS, MINUTE_IN_MILLISECONDS } from '../../src/client/sdf_client'
import {
  CustomizationInfo,
  CustomTypeInfo,
  FileCustomizationInfo,
  FolderCustomizationInfo,
  SdfDeployParams,
  SDFObjectNode,
  TemplateCustomTypeInfo,
} from '../../src/client/types'
import { fileCabinetTopLevelFolders } from '../../src/client/constants'
import { DEFAULT_COMMAND_TIMEOUT_IN_MINUTES } from '../../src/config/constants'
import {
  FeaturesDeployError,
  ManifestValidationError,
  MissingManifestFeaturesError,
  ObjectsDeployError,
  SettingsDeployError,
} from '../../src/client/errors'
import { Graph, GraphNode } from '../../src/client/graph_utils'
import { ATTRIBUTES_FOLDER_NAME } from '../../src/client/sdf_parser'
import {
  MOCK_FEATURES_XML,
  MOCK_FILE_ATTRS_PATH,
  MOCK_FILE_PATH,
  MOCK_FOLDER_ATTRS_PATH,
  MOCK_FOLDER_PATH,
  MOCK_MANIFEST_VALID_DEPENDENCIES,
  MOCK_TEMPLATE_CONTENT,
  OBJECTS_DIR_FILES,
  readFileMockFunction,
  statMockFunction,
} from './mocks'
import { largeFoldersToExclude } from '../../src/client/file_cabinet_utils'

const DEFAULT_DEPLOY_PARAMS: [undefined, SdfDeployParams, Graph<SDFObjectNode>] = [
  undefined,
  {
    manifestDependencies: {
      optionalFeatures: [],
      requiredFeatures: [],
      excludedFeatures: [],
      includedObjects: [],
      excludedObjects: [],
      includedFiles: [],
      excludedFiles: [],
    },
  },
  new Graph(),
]

jest.mock('readdirp', () => ({
  promise: jest.fn().mockImplementation(() => OBJECTS_DIR_FILES.map(path => ({ path }))),
}))

jest.mock('@salto-io/file', () => ({
  readFile: jest.fn().mockImplementation(path => readFileMockFunction(path)),
  writeFile: jest.fn(),
  rename: jest.fn(),
  mkdirp: jest.fn(),
  rm: jest.fn(),
  stat: jest.fn().mockImplementation(path => statMockFunction(path)),
  exists: jest.fn().mockResolvedValue(true),
}))
const readFileMock = readFile as unknown as jest.Mock
const writeFileMock = writeFile as jest.Mock
const renameMock = rename as unknown as jest.Mock
const mkdirpMock = mkdirp as jest.Mock
const rmMock = rm as jest.Mock

jest.mock('@salto-io/lowerdash', () => ({
  ...jest.requireActual<{}>('@salto-io/lowerdash'),
  hash: {
    toMD5: jest.fn().mockImplementation(input => input),
  },
}))

const mockExecuteAction = jest.fn()
const mockSetCommandTimeout = jest.fn()

jest.mock('@salto-io/suitecloud-cli', () => ({
  ActionResultUtils: {
    getErrorMessagesString: jest.fn().mockReturnValue('Error message'),
  },
  CLIConfigurationService: jest.fn(),
  NodeConsoleLogger: jest.fn(),
  CommandsMetadataService: jest.fn().mockImplementation(() => ({
    initializeCommandsMetadata: jest.fn(),
  })),
  CommandActionExecutor: jest.fn().mockImplementation(() => ({
    executeAction: mockExecuteAction,
  })),
  SdkProperties: {
    setCommandTimeout: jest.fn((...args) => mockSetCommandTimeout(...args)),
  },
}))

jest.mock('../../src/client/file_cabinet_utils', () => ({
  ...jest.requireActual<{}>('../../src/client/file_cabinet_utils'),
  largeFoldersToExclude: jest.fn().mockReturnValue([]),
}))
const mockLargeFoldersToExclude = largeFoldersToExclude as jest.Mock

describe('sdf client', () => {
  const createProjectCommandMatcher = expect.objectContaining({ commandName: COMMANDS.CREATE_PROJECT })
  const saveTokenCommandMatcher = expect.objectContaining({
    commandName: COMMANDS.SAVE_TOKEN,
    arguments: expect.objectContaining({
      account: DUMMY_CREDENTIALS.accountId,
      tokenid: DUMMY_CREDENTIALS.tokenId,
      tokensecret: DUMMY_CREDENTIALS.tokenSecret,
      authid: expect.anything(),
    }),
  })

  const instancesIds = [
    { type: 'addressForm', scriptId: 'IdA' },
    { type: 'advancedpdftemplate', scriptId: 'IdB' },
  ]

  const typeNames = instancesIds.map(instance => instance.type)

  const typeNamesQuery = buildNetsuiteQuery({
    types: [
      ...instancesIds.map(instance => ({ name: instance.type, ids: ['.*'] })),
      { name: CONFIG_FEATURES, ids: ['.*'] },
    ],
  })
  const typeNamesQueries = { originFetchQuery: typeNamesQuery, updatedFetchQuery: typeNamesQuery }

  const importObjectsCommandMatcher = expect.objectContaining({ commandName: COMMANDS.IMPORT_OBJECTS })
  const importConfigurationCommandMatcher = expect.objectContaining({ commandName: COMMANDS.IMPORT_CONFIGURATION })
  const listObjectsCommandMatcher = expect.objectContaining({ commandName: COMMANDS.LIST_OBJECTS })
  const listFilesCommandMatcher = expect.objectContaining({ commandName: COMMANDS.LIST_FILES })
  const importFilesCommandMatcher = expect.objectContaining({ commandName: COMMANDS.IMPORT_FILES })
  const addDependenciesCommandMatcher = expect.objectContaining({ commandName: COMMANDS.ADD_PROJECT_DEPENDENCIES })
  const deployProjectCommandMatcher = expect.objectContaining({
    commandName: COMMANDS.DEPLOY_PROJECT,
    arguments: { accountspecificvalues: 'WARNING' },
  })
  const deploySuiteAppProjectCommandMatcher = expect.objectContaining({
    commandName: COMMANDS.DEPLOY_PROJECT,
    arguments: {},
  })
  const validateProjectCommandMatcher = expect.objectContaining({
    commandName: COMMANDS.VALIDATE_PROJECT,
    arguments: {
      accountspecificvalues: 'WARNING',
      server: true,
    },
  })
  const deleteAuthIdCommandMatcher = expect.objectContaining({
    commandName: COMMANDS.MANAGE_AUTH,
    arguments: expect.objectContaining({
      remove: expect.anything(),
    }),
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should set command timeout when initializing client', () => {
    mockClient()
    expect(mockSetCommandTimeout).toHaveBeenCalledWith(DEFAULT_COMMAND_TIMEOUT_IN_MINUTES * MINUTE_IN_MILLISECONDS)
  })

  describe('validateCredentials', () => {
    it('should fail when SETUP_ACCOUNT has failed', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.SAVE_TOKEN) {
          return Promise.resolve({ isSuccess: () => false })
        }
        return Promise.resolve({ isSuccess: () => true })
      })
      await expect(SdfClient.validateCredentials(DUMMY_CREDENTIALS)).rejects.toThrow()
      expect(mockExecuteAction).toHaveBeenCalledWith(createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(saveTokenCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(importObjectsCommandMatcher)
    })

    it('should succeed', async () => {
      mockExecuteAction.mockResolvedValue({ isSuccess: () => true })
      const { accountId } = await SdfClient.validateCredentials(DUMMY_CREDENTIALS)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
      expect(accountId).toEqual(DUMMY_CREDENTIALS.accountId)
    })

    it('should quote strings with space', async () => {
      const credentialsWithSpaces = expect.objectContaining({
        commandName: COMMANDS.SAVE_TOKEN,
        arguments: expect.objectContaining({
          account: "'account with space'",
          tokenid: DUMMY_CREDENTIALS.tokenId,
          tokensecret: DUMMY_CREDENTIALS.tokenSecret,
          authid: expect.anything(),
        }),
      })
      mockExecuteAction.mockResolvedValue({ isSuccess: () => true })
      const { accountId } = await SdfClient.validateCredentials({
        ...DUMMY_CREDENTIALS,
        accountId: 'account with space',
      })
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, credentialsWithSpaces)
      expect(accountId).toEqual('account with space')
    })
  })

  describe('getCustomObjects', () => {
    it('should fail when CREATE_PROJECT has failed', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.CREATE_PROJECT) {
          return Promise.resolve({ isSuccess: () => false })
        }
        return Promise.resolve({ isSuccess: () => true })
      })
      await expect(mockClient().getCustomObjects(typeNames, typeNamesQueries)).rejects.toThrow()
      expect(mockExecuteAction).toHaveBeenCalledWith(createProjectCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(saveTokenCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(importObjectsCommandMatcher)
    })

    it('should fail when SETUP_ACCOUNT has failed', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.SAVE_TOKEN) {
          return Promise.resolve({ isSuccess: () => false })
        }
        return Promise.resolve({ isSuccess: () => true })
      })
      await expect(mockClient().getCustomObjects(typeNames, typeNamesQueries)).rejects.toThrow()
      expect(mockExecuteAction).toHaveBeenCalledWith(createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(saveTokenCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(importObjectsCommandMatcher)
    })

    it('should retry to authenticate when SETUP_ACCOUNT has failed', async () => {
      let isFirstSetupTry = true
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.SAVE_TOKEN && isFirstSetupTry) {
          isFirstSetupTry = false
          return Promise.resolve({ isSuccess: () => false })
        }
        if (context.commandName === COMMANDS.LIST_OBJECTS) {
          return Promise.resolve({
            isSuccess: () => true,
            data: instancesIds,
          })
        }
        if (context.commandName === COMMANDS.IMPORT_OBJECTS) {
          return Promise.resolve({
            isSuccess: () => true,
            data: { failedImports: [] },
          })
        }
        return Promise.resolve({ isSuccess: () => true })
      })

      await mockClient().getCustomObjects(typeNames, typeNamesQueries)
      expect(mockExecuteAction).toHaveBeenCalledWith(createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(importObjectsCommandMatcher)
    })

    it('should return true failedToFetchAllAtOnce when IMPORT_OBJECTS has failed with fetchAllAtOnce', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.LIST_OBJECTS) {
          return Promise.resolve({
            isSuccess: () => true,
            data: instancesIds,
          })
        }
        if (context.commandName === COMMANDS.IMPORT_OBJECTS) {
          if (context.arguments.type === 'ALL') {
            return Promise.resolve({
              isSuccess: () => false,
              data: { failedImports: [] },
            })
          }
          return Promise.resolve({
            isSuccess: () => true,
            data: { failedImports: [] },
          })
        }
        return Promise.resolve({ isSuccess: () => true })
      })
      const client = mockClient({ fetchAllTypesAtOnce: true })
      const getCustomObjectsResult = await client.getCustomObjects(typeNames, typeNamesQueries)
      expect(mockExecuteAction).toHaveBeenCalledTimes(8)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, listObjectsCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, importObjectsCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(5, importObjectsCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(6, importObjectsCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(7, importConfigurationCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(8, deleteAuthIdCommandMatcher)
      expect(getCustomObjectsResult.failedToFetchAllAtOnce).toEqual(true)
      expect(getCustomObjectsResult.failedTypes).toEqual({ lockedError: {}, unexpectedError: {}, excludedTypes: [] })
    })

    it('should fail when IMPORT_OBJECTS has failed without fetchAllAtOnce', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.LIST_OBJECTS) {
          return Promise.resolve({
            isSuccess: () => true,
            data: instancesIds,
          })
        }
        if (context.commandName === COMMANDS.IMPORT_OBJECTS) {
          if (context.arguments.type === 'addressForm') {
            return Promise.resolve({
              isSuccess: () => false,
              data: { failedImports: [] },
            })
          }
          return Promise.resolve({
            isSuccess: () => true,
            data: { failedImports: [] },
          })
        }
        return Promise.resolve({ isSuccess: () => true })
      })
      const client = mockClient({ fetchAllTypesAtOnce: false })
      await expect(client.getCustomObjects(typeNames, typeNamesQueries)).rejects.toThrow()
    })

    it('should split to smaller chunks and retry when IMPORT_OBJECTS has failed for a certain chunk', async () => {
      const ids = [
        { type: 'addressForm', scriptId: 'a' },
        { type: 'addressForm', scriptId: 'b' },
      ]
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.LIST_OBJECTS) {
          return Promise.resolve({
            isSuccess: () => true,
            data: ids,
          })
        }
        if (context.commandName === COMMANDS.IMPORT_OBJECTS) {
          if (context.arguments.scriptid.length > 1) {
            return Promise.resolve({
              isSuccess: () => false,
              data: { failedImports: [] },
            })
          }
          return Promise.resolve({
            isSuccess: () => true,
            data: { failedImports: [] },
          })
        }
        return Promise.resolve({ isSuccess: () => true })
      })
      const client = mockClient({ fetchAllTypesAtOnce: false })
      await client.getCustomObjects(typeNames, typeNamesQueries)
      // createProject & setupAccount & listObjects & 3*importObjects & deleteAuthId
      const numberOfExecuteActions = 8
      expect(mockExecuteAction).toHaveBeenCalledTimes(numberOfExecuteActions)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, listObjectsCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, importObjectsCommandMatcher)
      expect(mockExecuteAction.mock.calls[3][0].arguments).toEqual(
        expect.objectContaining({
          type: 'addressForm',
          scriptid: 'a b',
        }),
      )

      expect(mockExecuteAction).toHaveBeenNthCalledWith(5, importObjectsCommandMatcher)
      expect(mockExecuteAction.mock.calls[4][0].arguments).toEqual(
        expect.objectContaining({
          type: 'addressForm',
          scriptid: 'a',
        }),
      )

      expect(mockExecuteAction).toHaveBeenNthCalledWith(6, importObjectsCommandMatcher)
      expect(mockExecuteAction.mock.calls[5][0].arguments).toEqual(
        expect.objectContaining({
          type: 'addressForm',
          scriptid: 'b',
        }),
      )

      expect(mockExecuteAction).toHaveBeenNthCalledWith(7, importConfigurationCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(numberOfExecuteActions, deleteAuthIdCommandMatcher)
    })

    it('should retry chunks with size 1 when IMPORT_OBJECTS has failed', async () => {
      const ids = [{ type: 'addressForm', scriptId: 'a' }]
      let numberOfTries = 0
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.LIST_OBJECTS) {
          return Promise.resolve({
            isSuccess: () => true,
            data: ids,
          })
        }
        if (context.commandName === COMMANDS.IMPORT_OBJECTS) {
          if (numberOfTries < 2) {
            numberOfTries += 1
            return Promise.resolve({
              isSuccess: () => false,
              data: { failedImports: [] },
            })
          }
          return Promise.resolve({
            isSuccess: () => true,
            data: { failedImports: [] },
          })
        }
        return Promise.resolve({ isSuccess: () => true })
      })
      const client = mockClient({ fetchAllTypesAtOnce: false })
      await client.getCustomObjects(typeNames, typeNamesQueries)
      // createProject & setupAccount & listObjects & 3*importObjects & deleteAuthId
      const numberOfExecuteActions = 8
      expect(mockExecuteAction).toHaveBeenCalledTimes(numberOfExecuteActions)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, listObjectsCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, importObjectsCommandMatcher)
      expect(mockExecuteAction.mock.calls[3][0].arguments).toEqual(
        expect.objectContaining({
          type: 'addressForm',
          scriptid: 'a',
        }),
      )

      expect(mockExecuteAction).toHaveBeenNthCalledWith(5, importObjectsCommandMatcher)
      expect(mockExecuteAction.mock.calls[4][0].arguments).toEqual(
        expect.objectContaining({
          type: 'addressForm',
          scriptid: 'a',
        }),
      )

      expect(mockExecuteAction).toHaveBeenNthCalledWith(6, importObjectsCommandMatcher)
      expect(mockExecuteAction.mock.calls[5][0].arguments).toEqual(
        expect.objectContaining({
          type: 'addressForm',
          scriptid: 'a',
        }),
      )

      expect(mockExecuteAction).toHaveBeenNthCalledWith(7, importConfigurationCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(numberOfExecuteActions, deleteAuthIdCommandMatcher)
    })

    it('should split to chunks without mixing different types in the same chunk', async () => {
      const ids = [
        { type: 'addressForm', scriptId: 'a' },
        { type: 'addressForm', scriptId: 'b' },
        { type: 'addressForm', scriptId: 'c' },
        { type: 'advancedpdftemplate', scriptId: 'd' },
      ]
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.LIST_OBJECTS) {
          return Promise.resolve({
            isSuccess: () => true,
            data: ids,
          })
        }
        if (context.commandName === COMMANDS.IMPORT_OBJECTS) {
          return Promise.resolve({
            isSuccess: () => true,
            data: { failedImports: [] },
          })
        }
        return Promise.resolve({ isSuccess: () => true })
      })

      const client = mockClient({ fetchAllTypesAtOnce: false, maxItemsInImportObjectsRequest: 2 })
      await client.getCustomObjects(typeNames, typeNamesQueries)
      // createProject & setupAccount & listObjects & 3*importObjects & deleteAuthId
      const numberOfExecuteActions = 8
      expect(mockExecuteAction).toHaveBeenCalledTimes(numberOfExecuteActions)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, listObjectsCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, importObjectsCommandMatcher)
      expect(mockExecuteAction.mock.calls[3][0].arguments).toEqual(
        expect.objectContaining({
          type: 'addressForm',
          scriptid: 'a b',
        }),
      )

      expect(mockExecuteAction).toHaveBeenNthCalledWith(5, importObjectsCommandMatcher)
      expect(mockExecuteAction.mock.calls[4][0].arguments).toEqual(
        expect.objectContaining({
          type: 'addressForm',
          scriptid: 'c',
        }),
      )

      expect(mockExecuteAction).toHaveBeenNthCalledWith(6, importObjectsCommandMatcher)
      expect(mockExecuteAction.mock.calls[5][0].arguments).toEqual(
        expect.objectContaining({
          type: 'advancedpdftemplate',
          scriptid: 'd',
        }),
      )

      expect(mockExecuteAction).toHaveBeenNthCalledWith(7, importConfigurationCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(numberOfExecuteActions, deleteAuthIdCommandMatcher)
    })

    it('should exclude types with too many instances', async () => {
      mockExecuteAction.mockImplementation(context => {
        const ids = [
          { type: 'addressForm', scriptId: 'a' },
          { type: 'addressForm', scriptId: 'b' },
          { type: 'addressForm', scriptId: 'c' },
          { type: 'addressForm', scriptId: 'd' },
          { type: 'advancedpdftemplate', scriptId: 'd' },
        ]
        if (context.commandName === COMMANDS.LIST_OBJECTS) {
          return Promise.resolve({
            isSuccess: () => true,
            data: ids,
          })
        }
        if (context.commandName === COMMANDS.IMPORT_OBJECTS) {
          return Promise.resolve({
            isSuccess: () => true,
            data: { failedImports: [] },
          })
        }
        return Promise.resolve({ isSuccess: () => true })
      })

      const client = mockClient({}, (_type: string, count: number) => count > 3)
      await client.getCustomObjects(typeNames, typeNamesQueries)
      // createProject & setupAccount & listObjects & 1*importObjects & deleteAuthId
      const numberOfExecuteActions = 6
      expect(mockExecuteAction).toHaveBeenCalledTimes(numberOfExecuteActions)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, listObjectsCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, importObjectsCommandMatcher)
      expect(mockExecuteAction.mock.calls[3][0].arguments).toEqual(
        expect.objectContaining({
          type: 'advancedpdftemplate',
          scriptid: 'd',
        }),
      )

      expect(mockExecuteAction).toHaveBeenNthCalledWith(5, importConfigurationCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(numberOfExecuteActions, deleteAuthIdCommandMatcher)
    })

    it('should succeed', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.LIST_OBJECTS) {
          return Promise.resolve({
            isSuccess: () => true,
            data: [{ type: 'addressForm', scriptId: 'a' }],
          })
        }
        if (context.commandName === COMMANDS.IMPORT_OBJECTS) {
          return Promise.resolve({
            isSuccess: () => true,
            data: { failedImports: [] },
          })
        }
        return Promise.resolve({ isSuccess: () => true })
      })

      const {
        elements: customizationInfos,
        failedToFetchAllAtOnce,
        failedTypes,
        instancesIds: currentInstanceIds,
      } = await mockClient().getCustomObjects(typeNames, typeNamesQueries)
      expect(failedToFetchAllAtOnce).toBe(false)
      expect(failedTypes).toEqual({ lockedError: {}, unexpectedError: {}, excludedTypes: [] })
      expect(currentInstanceIds).toEqual([{ type: 'addressForm', instanceId: 'a' }])
      expect(readFileMock).toHaveBeenCalledTimes(4)
      expect(rmMock).toHaveBeenCalledTimes(1)
      expect(customizationInfos).toHaveLength(3)
      expect(customizationInfos).toEqual([
        {
          typeName: 'addressForm',
          scriptId: 'a',
          values: {
            '@_filename': 'a.xml',
          },
          fileContent: MOCK_TEMPLATE_CONTENT,
          fileExtension: 'html',
        },
        {
          typeName: 'addressForm',
          scriptId: 'b',
          values: {
            '@_filename': 'b.xml',
          },
        },
        {
          scriptId: CONFIG_FEATURES,
          typeName: CONFIG_FEATURES,
          values: {
            feature: [
              {
                id: 'SUITEAPPCONTROLCENTER',
                status: 'ENABLED',
              },
            ],
          },
        },
      ])

      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, listObjectsCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, importObjectsCommandMatcher)
    })

    it('should return custom record type with matching custom segment in instancesIds', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.LIST_OBJECTS) {
          return Promise.resolve({
            isSuccess: () => true,
            data: [{ type: 'customsegment', scriptId: 'cseg123' }],
          })
        }
        if (context.commandName === COMMANDS.IMPORT_OBJECTS) {
          return Promise.resolve({
            isSuccess: () => true,
            data: { failedImports: [] },
          })
        }
        return Promise.resolve({ isSuccess: () => true })
      })

      const { instancesIds: currentInstanceIds } = await mockClient().getCustomObjects(typeNames, typeNamesQueries)
      expect(currentInstanceIds).toEqual([
        { type: 'customsegment', instanceId: 'cseg123' },
        { type: 'customrecordtype', instanceId: 'customrecord_cseg123' },
      ])
    })

    it('should pass fetch configured suite apps', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.LIST_OBJECTS) {
          if (context.appid === undefined) {
            return Promise.resolve({
              isSuccess: () => true,
              data: [{ type: 'addressForm', scriptId: 'a' }],
            })
          }

          if (context.appid === 'a.b.c') {
            return Promise.resolve({
              isSuccess: () => true,
              data: [{ type: 'addressForm', scriptId: 'b' }],
            })
          }
        }
        if (context.commandName === COMMANDS.IMPORT_OBJECTS) {
          return Promise.resolve({
            isSuccess: () => true,
            data: { failedImports: [] },
          })
        }
        return Promise.resolve({ isSuccess: () => true })
      })

      const {
        elements: customizationInfos,
        failedToFetchAllAtOnce,
        failedTypes,
      } = await mockClient({ installedSuiteApps: ['a.b.c'] }).getCustomObjects(typeNames, typeNamesQueries)
      expect(failedToFetchAllAtOnce).toBe(false)
      expect(failedTypes).toEqual({ lockedError: {}, unexpectedError: {}, excludedTypes: [] })
      expect(readFileMock).toHaveBeenCalledTimes(7)
      expect(rmMock).toHaveBeenCalledTimes(2)
      expect(customizationInfos).toEqual([
        {
          typeName: 'addressForm',
          scriptId: 'a',
          values: {
            '@_filename': 'a.xml',
          },
          fileContent: MOCK_TEMPLATE_CONTENT,
          fileExtension: 'html',
        },
        {
          typeName: 'addressForm',
          scriptId: 'b',
          values: {
            '@_filename': 'b.xml',
          },
        },
        {
          scriptId: CONFIG_FEATURES,
          typeName: CONFIG_FEATURES,
          values: {
            feature: [
              {
                id: 'SUITEAPPCONTROLCENTER',
                status: 'ENABLED',
              },
            ],
          },
        },
        {
          typeName: 'addressForm',
          scriptId: 'a',
          values: {
            '@_filename': 'a.xml',
            [APPLICATION_ID]: 'a.b.c',
          },
          fileContent: MOCK_TEMPLATE_CONTENT,
          fileExtension: 'html',
        },
        {
          typeName: 'addressForm',
          scriptId: 'b',
          values: {
            '@_filename': 'b.xml',
            [APPLICATION_ID]: 'a.b.c',
          },
        },
      ])

      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(5, listObjectsCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(6, listObjectsCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(7, importObjectsCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(8, importObjectsCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(9, deleteAuthIdCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(10, importConfigurationCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(11, deleteAuthIdCommandMatcher)
    })

    it('should succeed and return failedTypeToInstances that failed also after retry', async () => {
      let isFirstFetchAddressFormTry = true
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.LIST_OBJECTS) {
          return Promise.resolve({
            isSuccess: () => true,
            data: [
              { type: 'savedcsvimport', scriptId: 'a' },
              { type: 'savedcsvimport', scriptId: 'b' },
              { type: 'savedcsvimport', scriptId: 'c' },
              { type: 'savedcsvimport', scriptId: 'd' },
              { type: 'advancedpdftemplate', scriptId: 'a' },
            ],
          })
        }
        if (context.commandName === COMMANDS.IMPORT_OBJECTS) {
          if (context.arguments.type === 'savedcsvimport') {
            const conditionalFailedForm = {
              customObject: {
                id: 'b',
                type: 'csvimport',
                result: {
                  code: 'FAILED',
                  message: 'An unexpected error has occurred',
                },
              },
            }
            const failedImports = [
              ...(isFirstFetchAddressFormTry ? [conditionalFailedForm] : []),
              {
                customObject: {
                  id: 'c',
                  type: 'csvimport',
                  result: {
                    code: 'FAILED',
                    message: "Une erreur inattendue s'est produite.",
                  },
                },
              },
              {
                customObject: {
                  id: 'd',
                  type: 'csvimport',
                  result: {
                    code: 'FAILED',
                    message: 'You cannot download the XML file for this object because it is locked.',
                  },
                },
              },
            ]
            isFirstFetchAddressFormTry = false
            return Promise.resolve({
              isSuccess: () => true,
              data: { failedImports },
            })
          }
          if (context.arguments.type === 'advancedpdftemplate') {
            return Promise.resolve({
              isSuccess: () => true,
              data: {
                failedImports: [
                  {
                    customObject: {
                      id: 'a',
                      type: 'advancedpdftemplate',
                      result: {
                        code: 'FAILED',
                        message: 'An unexpected error has occurred',
                      },
                    },
                  },
                ],
              },
            })
          }
          return Promise.resolve({
            isSuccess: () => true,
            data: { failedImports: [] },
          })
        }
        return Promise.resolve({ isSuccess: () => true })
      })

      const query = buildNetsuiteQuery({
        types: [{ name: 'savedcsvimport' }, { name: 'advancedpdftemplate' }],
      })
      const { failedTypes } = await mockClient().getCustomObjects(typeNames, {
        originFetchQuery: query,
        updatedFetchQuery: query,
      })
      expect(failedTypes).toEqual({
        lockedError: {
          savedcsvimport: ['d'],
        },
        unexpectedError: {
          savedcsvimport: ['c'],
          advancedpdftemplate: ['a'],
        },
        excludedTypes: [],
      })
    })

    it('should succeed and return merged failedTypeToInstances when split to smaller chunks', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.LIST_OBJECTS) {
          return Promise.resolve({
            isSuccess: () => true,
            data: [
              { type: 'addressForm', scriptId: 'a' },
              { type: 'addressForm', scriptId: 'b' },
            ],
          })
        }
        if (context.commandName === COMMANDS.IMPORT_OBJECTS) {
          if (context.arguments.scriptid.length > 1) {
            return Promise.resolve({
              isSuccess: () => false,
              data: { failedImports: [] },
            })
          }
          if (context.arguments.type === 'addressForm') {
            return Promise.resolve({
              isSuccess: () => true,
              data: {
                failedImports: [
                  {
                    customObject: {
                      id: context.arguments.scriptid,
                      type: 'addressForm',
                      result: {
                        code: 'FAILED',
                        message: 'An unexpected error has occurred',
                      },
                    },
                  },
                ],
              },
            })
          }
          return Promise.resolve({
            isSuccess: () => true,
            data: { failedImports: [] },
          })
        }
        return Promise.resolve({ isSuccess: () => true })
      })

      const { failedTypes } = await mockClient().getCustomObjects(typeNames, typeNamesQueries)
      expect(failedTypes).toEqual({
        lockedError: {},
        unexpectedError: {
          addressForm: ['a', 'b'],
        },
        excludedTypes: [],
      })
    })

    it('should list and import only objects that match the query', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.LIST_OBJECTS) {
          return Promise.resolve({
            isSuccess: () => true,
            data: [
              { type: 'addressForm', scriptId: 'a' },
              { type: 'addressForm', scriptId: 'b' },
            ],
          })
        }
        if (context.commandName === COMMANDS.IMPORT_OBJECTS) {
          return Promise.resolve({
            isSuccess: () => true,
            data: {
              failedImports: [],
            },
          })
        }
        return Promise.resolve({ isSuccess: () => true })
      })

      const query = buildNetsuiteQuery({
        types: [{ name: 'addressForm', ids: ['a'] }],
      })
      await mockClient().getCustomObjects(typeNames, { originFetchQuery: query, updatedFetchQuery: query })
      expect(mockExecuteAction).toHaveBeenCalledWith(
        expect.objectContaining({
          commandName: COMMANDS.LIST_OBJECTS,
          arguments: {
            type: 'addressForm',
          },
        }),
      )

      expect(mockExecuteAction).toHaveBeenCalledWith(
        expect.objectContaining({
          commandName: COMMANDS.IMPORT_OBJECTS,
          arguments: expect.objectContaining({
            type: 'addressForm',
            scriptid: 'a',
          }),
        }),
      )

      expect(mockExecuteAction).not.toHaveBeenCalledWith(
        expect.objectContaining({
          commandName: COMMANDS.IMPORT_OBJECTS,
          arguments: expect.objectContaining({
            type: 'addressForm',
            scriptid: 'b',
          }),
        }),
      )
    })

    it('should do nothing of no files are matched', async () => {
      const netsuiteQuery = buildNetsuiteQuery({ types: [] })
      const { elements, failedToFetchAllAtOnce } = await mockClient().getCustomObjects(typeNames, {
        originFetchQuery: netsuiteQuery,
        updatedFetchQuery: netsuiteQuery,
      })
      expect(elements).toHaveLength(0)
      expect(failedToFetchAllAtOnce).toBeFalsy()
      expect(mockExecuteAction).not.toHaveBeenCalledWith()
    })
  })

  describe('importFileCabinetContent', () => {
    const allFilesQuery = buildNetsuiteQuery({
      fileCabinet: ['.*'],
    })
    const maxFileCabinetSizeInGB = 1

    let client: SdfClient
    beforeEach(() => {
      client = mockClient()
    })

    it('should fail when CREATE_PROJECT has failed', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.CREATE_PROJECT) {
          return Promise.resolve({ isSuccess: () => false })
        }
        return Promise.resolve({ isSuccess: () => true })
      })
      await expect(client.importFileCabinetContent(allFilesQuery, maxFileCabinetSizeInGB)).rejects.toThrow()
      expect(rmMock).toHaveBeenCalledTimes(0)
    })

    it('should return failed paths when LIST_FILES has failed', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.LIST_FILES) {
          return Promise.resolve({ isSuccess: () => false })
        }
        return Promise.resolve({ isSuccess: () => true })
      })
      const { elements, failedPaths } = await client.importFileCabinetContent(allFilesQuery, maxFileCabinetSizeInGB)
      expect(elements).toHaveLength(0)
      expect(failedPaths).toEqual({
        lockedError: [],
        largeFolderError: [],
        otherError: fileCabinetTopLevelFolders.map(folderPath => `^${folderPath}.*`),
      })
    })

    it('should fail when SETUP_ACCOUNT has failed', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.SAVE_TOKEN) {
          return Promise.resolve({ isSuccess: () => false })
        }
        return Promise.resolve({ isSuccess: () => true })
      })
      await expect(client.importFileCabinetContent(allFilesQuery, maxFileCabinetSizeInGB)).rejects.toThrow()
    })

    it('should succeed when having no files', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.LIST_FILES) {
          return Promise.resolve({
            isSuccess: () => true,
            data: [],
          })
        }
        if (context.commandName === COMMANDS.IMPORT_FILES) {
          return Promise.resolve({
            isSuccess: () => true,
            data: {
              results: [],
            },
          })
        }
        return Promise.resolve({ isSuccess: () => true })
      })
      const { elements, failedPaths } = await client.importFileCabinetContent(allFilesQuery, maxFileCabinetSizeInGB)
      expect(mockExecuteAction).toHaveBeenCalledTimes(6)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(5, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(6, deleteAuthIdCommandMatcher)
      expect(elements).toHaveLength(0)
      expect(failedPaths).toEqual({ lockedError: [], largeFolderError: [], otherError: [] })
    })

    it('should fail to importFiles when failing to import a certain file', async () => {
      const failedPath = 'error'
      const filesPathResult = [MOCK_FILE_PATH, failedPath]
      mockExecuteAction.mockImplementation(context => {
        if (
          context.commandName === COMMANDS.LIST_FILES &&
          context.arguments.folder === `${FILE_CABINET_PATH_SEPARATOR}Templates`
        ) {
          return Promise.resolve({
            isSuccess: () => true,
            data: filesPathResult,
          })
        }
        if (context.commandName === COMMANDS.IMPORT_FILES) {
          if (context.arguments.paths.includes(failedPath)) {
            return Promise.resolve({
              isSuccess: () => false,
              data: {
                results: [],
              },
            })
          }
          return Promise.resolve({
            isSuccess: () => true,
            data: {
              results: [
                {
                  path: MOCK_FILE_PATH,
                  loaded: true,
                },
                {
                  path: MOCK_FILE_ATTRS_PATH,
                  loaded: true,
                },
                {
                  path: MOCK_FOLDER_ATTRS_PATH,
                  loaded: true,
                },
                {
                  path: MOCK_FOLDER_ATTRS_PATH,
                  loaded: true,
                },
              ],
            },
          })
        }
        return Promise.resolve({ isSuccess: () => true })
      })
      await expect(client.importFileCabinetContent(allFilesQuery, maxFileCabinetSizeInGB)).rejects.toThrow()
      expect(mockExecuteAction).toHaveBeenCalledTimes(8)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(5, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(6, importFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(7, importFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(8, importFilesCommandMatcher)
    })

    it('should succeed when having duplicated paths', async () => {
      mockExecuteAction.mockImplementation(context => {
        const filesPathResult = [MOCK_FILE_PATH]
        if (
          context.commandName === COMMANDS.LIST_FILES &&
          context.arguments.folder === `${FILE_CABINET_PATH_SEPARATOR}Templates`
        ) {
          return Promise.resolve({
            isSuccess: () => true,
            data: filesPathResult,
          })
        }
        if (context.commandName === COMMANDS.IMPORT_FILES && _.isEqual(context.arguments.paths, filesPathResult)) {
          return Promise.resolve({
            isSuccess: () => true,
            data: {
              results: [
                {
                  path: MOCK_FILE_PATH,
                  loaded: true,
                },
                {
                  path: MOCK_FILE_ATTRS_PATH,
                  loaded: true,
                },
                {
                  path: MOCK_FOLDER_ATTRS_PATH,
                  loaded: true,
                },
                {
                  path: MOCK_FOLDER_ATTRS_PATH,
                  loaded: true,
                },
              ],
            },
          })
        }
        return Promise.resolve({ isSuccess: () => true })
      })
      const { elements, failedPaths } = await client.importFileCabinetContent(allFilesQuery, maxFileCabinetSizeInGB)
      expect(readFileMock).toHaveBeenCalledTimes(3)
      expect(elements).toHaveLength(4)
      expect(elements).toEqual([
        {
          typeName: 'file',
          values: {
            description: 'file description',
          },
          path: ['Templates', 'E-mail Templates', 'InnerFolder', 'content.html'],
          fileContent: 'dummy file content',
        },
        {
          typeName: 'folder',
          values: {
            description: 'folder description',
          },
          path: ['Templates', 'E-mail Templates', 'InnerFolder'],
        },
        {
          typeName: 'folder',
          values: {
            bundleable: 'F',
            description: '',
            isinactive: 'F',
            isprivate: 'F',
          },
          path: ['Templates'],
        },
        {
          typeName: 'folder',
          values: {
            bundleable: 'F',
            description: '',
            isinactive: 'F',
            isprivate: 'F',
          },
          path: ['Templates', 'E-mail Templates'],
        },
      ])
      expect(failedPaths).toEqual({ lockedError: [], largeFolderError: [], otherError: [] })
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(5, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(6, importFilesCommandMatcher)
    })

    it('should filter out paths that do not match the query', async () => {
      mockExecuteAction.mockImplementation(context => {
        const filesPathResult = [MOCK_FILE_PATH]
        if (
          context.commandName === COMMANDS.LIST_FILES &&
          context.arguments.folder === `${FILE_CABINET_PATH_SEPARATOR}Templates`
        ) {
          return Promise.resolve({
            isSuccess: () => true,
            data: filesPathResult,
          })
        }
        return Promise.resolve({ isSuccess: () => true })
      })
      const query = notQuery(
        buildNetsuiteQuery({
          fileCabinet: [MOCK_FILE_PATH],
        }),
      )
      const { elements, failedPaths } = await client.importFileCabinetContent(query, maxFileCabinetSizeInGB)
      expect(readFileMock).toHaveBeenCalledTimes(0)
      expect(elements).toHaveLength(0)
      expect(failedPaths).toEqual({ lockedError: [], largeFolderError: [], otherError: [] })
      expect(mockExecuteAction).toHaveBeenCalledTimes(6)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(5, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(6, deleteAuthIdCommandMatcher)
    })

    it('should do nothing of no files are matched', async () => {
      const { elements, failedPaths } = await client.importFileCabinetContent(
        buildNetsuiteQuery({
          fileCabinet: [],
        }),
        maxFileCabinetSizeInGB,
      )

      expect(elements).toHaveLength(0)
      expect(failedPaths).toEqual({ lockedError: [], otherError: [], largeFolderError: [] })
      expect(mockExecuteAction).not.toHaveBeenCalled()
    })

    it('should return only loaded files', async () => {
      mockExecuteAction.mockImplementation(context => {
        const filesPathResult = [MOCK_FILE_PATH]
        if (
          context.commandName === COMMANDS.LIST_FILES &&
          context.arguments.folder === `${FILE_CABINET_PATH_SEPARATOR}Templates`
        ) {
          return Promise.resolve({
            isSuccess: () => true,
            data: filesPathResult,
          })
        }
        if (context.commandName === COMMANDS.IMPORT_FILES && _.isEqual(context.arguments.paths, filesPathResult)) {
          return Promise.resolve({
            isSuccess: () => true,
            data: {
              results: [
                {
                  path: MOCK_FILE_PATH,
                  loaded: false,
                },
                {
                  path: MOCK_FILE_ATTRS_PATH,
                  loaded: false,
                },
                {
                  path: MOCK_FOLDER_ATTRS_PATH,
                  loaded: true,
                },
              ],
            },
          })
        }
        return Promise.resolve({ isSuccess: () => true })
      })
      const { elements, failedPaths } = await client.importFileCabinetContent(allFilesQuery, maxFileCabinetSizeInGB)
      expect(readFileMock).toHaveBeenCalledTimes(1)
      expect(elements).toHaveLength(1)
      expect(elements).toEqual([
        {
          typeName: 'folder',
          values: {
            description: 'folder description',
          },
          path: ['Templates', 'E-mail Templates', 'InnerFolder'],
        },
      ])
      expect(failedPaths).toEqual({ lockedError: [], largeFolderError: [], otherError: [] })
      expect(rmMock).toHaveBeenCalledTimes(1)
    })

    it('should filter out paths under excluded large folders', async () => {
      mockExecuteAction.mockImplementation(context => {
        const filesPathResult = [MOCK_FILE_PATH]
        if (
          context.commandName === COMMANDS.LIST_FILES &&
          context.arguments.folder === `${FILE_CABINET_PATH_SEPARATOR}Templates`
        ) {
          return Promise.resolve({
            isSuccess: () => true,
            data: filesPathResult,
          })
        }
        if (context.commandName === COMMANDS.IMPORT_FILES && _.isEqual(context.arguments.paths, filesPathResult)) {
          return Promise.resolve({
            isSuccess: () => true,
            data: {
              results: [
                {
                  path: MOCK_FILE_PATH,
                  loaded: true,
                },
                {
                  path: MOCK_FILE_ATTRS_PATH,
                  loaded: true,
                },
                {
                  path: MOCK_FOLDER_ATTRS_PATH,
                  loaded: true,
                },
              ],
            },
          })
        }
        return Promise.resolve({ isSuccess: () => true })
      })
      mockLargeFoldersToExclude.mockReturnValue([MOCK_FOLDER_PATH])
      const { elements, failedPaths } = await client.importFileCabinetContent(allFilesQuery, maxFileCabinetSizeInGB)
      expect(mockLargeFoldersToExclude).toHaveBeenCalledWith(
        [
          { path: MOCK_FILE_PATH, size: 33 },
          { path: MOCK_FILE_ATTRS_PATH, size: 0 },
          { path: MOCK_FOLDER_ATTRS_PATH, size: 0 },
        ],
        maxFileCabinetSizeInGB,
      )
      expect(elements).toHaveLength(0)
      expect(failedPaths).toEqual({ lockedError: [], largeFolderError: [MOCK_FOLDER_PATH], otherError: [] })
    })
  })

  describe('deploy', () => {
    let client: SdfClient
    const testGraph = DEFAULT_DEPLOY_PARAMS[2]
    let customTypeInfo: CustomTypeInfo
    let testSDFNode: SDFObjectNode
    beforeEach(() => {
      client = mockClient()
      testGraph.nodes.clear()
      customTypeInfo = {
        typeName: 'typeName',
        values: {
          key: 'val',
        },
        scriptId: 'scriptId',
      } as CustomTypeInfo
      testSDFNode = {
        serviceid: 'scriptId',
        changeType: 'addition',
        customizationInfo: customTypeInfo,
      } as unknown as SDFObjectNode
    })
    describe('deployCustomObject', () => {
      it('should succeed for CustomTypeInfo', async () => {
        mockExecuteAction.mockResolvedValue({ isSuccess: () => true })
        const scriptId = 'filename'
        customTypeInfo.scriptId = scriptId
        testGraph.addNodes([
          new GraphNode<SDFObjectNode>('name', {
            serviceid: scriptId,
            changeType: 'addition',
            customizationInfo: customTypeInfo,
          } as unknown as SDFObjectNode),
        ])
        await client.deploy(...DEFAULT_DEPLOY_PARAMS)
        expect(writeFileMock).toHaveBeenCalledTimes(3)
        expect(writeFileMock).toHaveBeenCalledWith(
          expect.stringContaining(`${scriptId}.xml`),
          '<typeName><key>val</key></typeName>',
        )
        expect(writeFileMock).toHaveBeenCalledWith(
          expect.stringContaining('manifest.xml'),
          MOCK_MANIFEST_VALID_DEPENDENCIES,
        )
        expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(3, addDependenciesCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(4, deployProjectCommandMatcher)
      })

      it('should succeed for CustomTypeInfo With SuiteAppId', async () => {
        mockExecuteAction.mockClear()
        mockExecuteAction.mockResolvedValue({ isSuccess: () => true })
        const scriptId = 'filename'
        customTypeInfo.scriptId = scriptId
        testGraph.addNodes([
          new GraphNode<SDFObjectNode>(scriptId, {
            serviceid: scriptId,
            changeType: 'addition',
            customizationInfo: customTypeInfo,
          } as unknown as SDFObjectNode),
        ])
        await client.deploy('a.b.c', DEFAULT_DEPLOY_PARAMS[1], DEFAULT_DEPLOY_PARAMS[2])
        expect(renameMock).toHaveBeenCalled()
        expect(writeFileMock).toHaveBeenCalledTimes(3)
        expect(writeFileMock).toHaveBeenCalledWith(
          expect.stringContaining(`${scriptId}.xml`),
          '<typeName><key>val</key></typeName>',
        )
        expect(writeFileMock).toHaveBeenCalledWith(
          expect.stringContaining('manifest.xml'),
          MOCK_MANIFEST_VALID_DEPENDENCIES,
        )
        expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(3, addDependenciesCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(4, deploySuiteAppProjectCommandMatcher)
      })

      it('should succeed for TemplateCustomTypeInfo', async () => {
        mockExecuteAction.mockResolvedValue({ isSuccess: () => true })
        const scriptId = 'filename'
        const templateCustomTypeInfo = {
          typeName: 'typeName',
          values: {
            key: 'val',
          },
          scriptId,
          fileContent: MOCK_TEMPLATE_CONTENT,
          fileExtension: 'html',
        } as TemplateCustomTypeInfo
        testGraph.addNodes([
          new GraphNode<SDFObjectNode>(scriptId, {
            serviceid: scriptId,
            changeType: 'addition',
            customizationInfo: templateCustomTypeInfo,
          } as unknown as SDFObjectNode),
        ])
        await client.deploy(...DEFAULT_DEPLOY_PARAMS)
        expect(writeFileMock).toHaveBeenCalledTimes(4)
        expect(writeFileMock).toHaveBeenCalledWith(
          expect.stringContaining(`${scriptId}.xml`),
          '<typeName><key>val</key></typeName>',
        )
        expect(writeFileMock).toHaveBeenCalledWith(
          expect.stringContaining(`${scriptId}.template.html`),
          MOCK_TEMPLATE_CONTENT,
        )
        expect(writeFileMock).toHaveBeenCalledWith(
          expect.stringContaining('manifest.xml'),
          MOCK_MANIFEST_VALID_DEPENDENCIES,
        )
        expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(3, addDependenciesCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(4, deployProjectCommandMatcher)
      })

      it('should wrap the thrown string with Error object', async () => {
        const errorMessage = 'error message'
        mockExecuteAction.mockImplementation(() => {
          throw errorMessage
        })
        await expect(client.deploy(...DEFAULT_DEPLOY_PARAMS)).rejects.toThrow(new Error(errorMessage))
      })

      it('should throw Error object', async () => {
        const errorMessage = 'error message'
        mockExecuteAction.mockImplementation(() => {
          throw new Error(errorMessage)
        })
        await expect(client.deploy(...DEFAULT_DEPLOY_PARAMS)).rejects.toThrow(new Error(errorMessage))
      })
      it('should throw error when sdf result contain error in other language', async () => {
        const sdfResult = ['Starting deploy', '*** ERREUR ***', 'some error']
        mockExecuteAction.mockResolvedValue({ isSuccess: () => true, data: sdfResult })
        await expect(client.deploy(...DEFAULT_DEPLOY_PARAMS)).rejects.toThrow(
          new Error('Starting deploy\n*** ERREUR ***\nsome error'),
        )
      })
      it('should throw ObjectsDeployError when deploy failed on object validation', async () => {
        const errorMessage = `
The deployment process has encountered an error.
Deploying to TSTDRV2259448 - Salto Extended Dev - Administrator.
2022-03-31 05:36:02 (PST) Installation started
Info -- Account [(PRODUCTION) Salto Extended Dev]
Info -- Account Customization Project [TempSdfProject-5492f41d-307d-4fc9-bc78-ef0834e9a197]
Info -- Framework Version [1.0]
Validate manifest -- Success
Validate deploy file -- Success
Validate configuration -- Success
Validate objects -- Failed
Validate files -- Success
Validate folders -- Success
Validate translation imports -- Success
Validation of referenceability from custom objects to translations collection strings in progress. -- Success
Validate preferences -- Success
Validate flags -- Success
Validate for circular dependencies -- Success
*** ERROR ***
Validation failed.

An error occurred during custom object validation. (custform_114_t1441298_782)
File: ~/Objects/custform_114_t1441298_782.xml
        `
        mockExecuteAction.mockImplementation(({ commandName }) => {
          if (commandName === COMMANDS.DEPLOY_PROJECT) {
            throw errorMessage
          }
          return { isSuccess: () => true }
        })
        let isRejected: boolean
        testGraph.addNodes([new GraphNode('name', testSDFNode)])
        try {
          await client.deploy(...DEFAULT_DEPLOY_PARAMS)
          isRejected = false
        } catch (e) {
          isRejected = true
          expect(e instanceof ObjectsDeployError).toBeTruthy()
          expect(e instanceof ObjectsDeployError && e.failedObjects).toEqual(
            new Map([
              [
                'custform_114_t1441298_782',
                [
                  {
                    message: `An error occurred during custom object validation. (custform_114_t1441298_782)
File: ~/Objects/custform_114_t1441298_782.xml
        `,
                    scriptId: 'custform_114_t1441298_782',
                  },
                ],
              ],
            ]),
          )
        }
        expect(isRejected).toBe(true)
      })
      it('should throw ObjectsDeployError when deploy failed on object validation - in other language', async () => {
        const errorMessage = `
The deployment process has encountered an error.
Deploying to TSTDRV2259448 - Salto Extended Dev - Administrator.
2022-03-31 05:36:02 (PST) Installation started
Info -- Account [(PRODUCTION) Salto Extended Dev]
Info -- Account Customization Project [TempSdfProject-5492f41d-307d-4fc9-bc78-ef0834e9a197]
Info -- Framework Version [1.0]
Validate manifest -- Success
Validate deploy file -- Success
Validate configuration -- Success
Validate objects -- Failed
Validate files -- Success
Validate folders -- Success
Validate translation imports -- Success
Validation of referenceability from custom objects to translations collection strings in progress. -- Success
Validate preferences -- Success
Validate flags -- Success
Validate for circular dependencies -- Success
*** ERREUR ***
La validation a .chou..

Une erreur s'est produite lors de la validation de l'objet personnalis.. (custform_114_t1441298_782)
File: ~/Objects/custform_114_t1441298_782.xml
        `
        mockExecuteAction.mockResolvedValue({ isSuccess: () => true, data: errorMessage.split('\n') })
        let isRejected: boolean
        try {
          await client.deploy(...DEFAULT_DEPLOY_PARAMS)
          isRejected = false
        } catch (e) {
          isRejected = true
          expect(e instanceof ObjectsDeployError).toBeTruthy()
          expect(e instanceof ObjectsDeployError && e.failedObjects).toEqual(
            new Map([
              [
                'custform_114_t1441298_782',
                [
                  {
                    message: `Une erreur s'est produite lors de la validation de l'objet personnalis.. (custform_114_t1441298_782)
File: ~/Objects/custform_114_t1441298_782.xml
        `,
                    scriptId: 'custform_114_t1441298_782',
                  },
                ],
              ],
            ]),
          )
        }
        expect(isRejected).toBe(true)
      })

      it('should throw ObjectsDeployError when deploy failed with error object message', async () => {
        const errorMessage = `
The deployment process has encountered an error.
Deploying to TSTDRV2259448 - Salto Extended Dev - Administrator.
2022-03-30 23:55:26 (PST) Installation started
Info -- Account [(PRODUCTION) Salto Extended Dev]
Info -- Account Customization Project [TempSdfProject-e5a4eed4-e331-490f-9cfa-69cf84bd231b]
Info -- Framework Version [1.0]
Validate manifest -- Success
Validate deploy file -- Success
Validate configuration -- Success
Validate objects -- Success
Validate files -- Success
Validate folders -- Success
Validate translation imports -- Success
Validation of referenceability from custom objects to translations collection strings in progress. -- Success
Validate preferences -- Success
Validate flags -- Success
Validate for circular dependencies -- Success
Validate account settings -- Success
Validate Custom Objects against the Account -- Success
Validate file cabinet items against the account -- Success
Validate translation imports against the account -- Success
Validation of references to translation collection strings against account in progress. -- Success
Begin deployment
Update object -- custform_12_t1441298_782 (entryform)
*** ERROR ***

Validation failed.

An unexpected error has occurred. (custform_15_t1049933_143)
File: ~/Objects/custform_15_t1049933_143.xml
`
        mockExecuteAction.mockImplementation(({ commandName }) => {
          if (commandName === COMMANDS.DEPLOY_PROJECT) {
            throw errorMessage
          }
          return { isSuccess: () => true }
        })
        let isRejected: boolean
        testGraph.addNodes([new GraphNode('name', testSDFNode)])
        try {
          await client.deploy(...DEFAULT_DEPLOY_PARAMS)
          isRejected = false
        } catch (e) {
          isRejected = true
          expect(e instanceof ObjectsDeployError).toBeTruthy()
          expect(e instanceof ObjectsDeployError && e.failedObjects).toEqual(
            new Map([
              [
                'custform_15_t1049933_143',
                [
                  {
                    message: `An unexpected error has occurred. (custform_15_t1049933_143)
File: ~/Objects/custform_15_t1049933_143.xml
`,
                    scriptId: 'custform_15_t1049933_143',
                  },
                ],
              ],
            ]),
          )
        }
        expect(isRejected).toBe(true)
      })
      it('should throw ObjectsDeployError when deploy failed without any deployed objects', async () => {
        const errorMessage = `
The deployment process has encountered an error.
Deploying to TSTDRV2259448 - Salto Extended Dev - Administrator.
2022-03-30 23:55:26 (PST) Installation started
Info -- Account [(PRODUCTION) Salto Extended Dev]
Info -- Account Customization Project [TempSdfProject-e5a4eed4-e331-490f-9cfa-69cf84bd231b]
Info -- Framework Version [1.0]
Validate manifest -- Success
Validate deploy file -- Success
Validate configuration -- Success
Validate objects -- Success
Validate files -- Success
Validate folders -- Success
Validate translation imports -- Success
Validation of referenceability from custom objects to translations collection strings in progress. -- Success
Validate preferences -- Success
Validate flags -- Success
Validate for circular dependencies -- Success
Validate account settings -- Success
Validate Custom Objects against the Account -- Success
Validate file cabinet items against the account -- Success
Validate translation imports against the account -- Success
Validation of references to translation collection strings against account in progress. -- Success
Begin deployment
*** ERROR ***

Validation failed.

An unexpected error has occurred. (custform_15_t1049933_143)
File: ~/Objects/custform_15_t1049933_143.xml
`
        mockExecuteAction.mockImplementation(({ commandName }) => {
          if (commandName === COMMANDS.DEPLOY_PROJECT) {
            throw errorMessage
          }
          return { isSuccess: () => true }
        })
        let isRejected: boolean
        testGraph.addNodes([new GraphNode('name', testSDFNode)])
        try {
          await client.deploy(...DEFAULT_DEPLOY_PARAMS)
          isRejected = false
        } catch (e) {
          isRejected = true
          expect(e instanceof ObjectsDeployError).toBeTruthy()
          expect(e instanceof ObjectsDeployError && e.failedObjects).toEqual(
            new Map([
              [
                'custform_15_t1049933_143',
                [
                  {
                    message: `An unexpected error has occurred. (custform_15_t1049933_143)
File: ~/Objects/custform_15_t1049933_143.xml
`,
                    scriptId: 'custform_15_t1049933_143',
                  },
                ],
              ],
            ]),
          )
        }
        expect(isRejected).toBe(true)
      })
      it('should throw general error when deploy failed without failed objects', async () => {
        const errorMessage = `
The deployment process has encountered an error.
Deploying to TSTDRV2259448 - Salto Extended Dev - Administrator.
2022-03-30 23:55:26 (PST) Installation started
Info -- Account [(PRODUCTION) Salto Extended Dev]
Info -- Account Customization Project [TempSdfProject-e5a4eed4-e331-490f-9cfa-69cf84bd231b]
Info -- Framework Version [1.0]
Validate manifest -- Success
Validate deploy file -- Success
Validate configuration -- Success
Validate objects -- Success
Validate files -- Success
Validate folders -- Success
Validate translation imports -- Success
Validation of referenceability from custom objects to translations collection strings in progress. -- Success
Validate preferences -- Success
Validate flags -- Success
Validate for circular dependencies -- Success
Validate account settings -- Success
Validate Custom Objects against the Account -- Success
Validate file cabinet items against the account -- Success
Validate translation imports against the account -- Success
Validation of references to translation collection strings against account in progress. -- Success
Begin deployment
*** ERROR ***

Validation failed.

An error occurred during custom object update.
File: ~/Objects/customrecord_flo_customization.xml
Object: customrecord_flo_customization.custrecord_flo_custz_link (customrecordcustomfield)
`
        mockExecuteAction.mockImplementation(({ commandName }) => {
          if (commandName === COMMANDS.DEPLOY_PROJECT) {
            throw errorMessage
          }
          return { isSuccess: () => true }
        })
        let isRejected: boolean
        testGraph.addNodes([new GraphNode('name', testSDFNode)])
        try {
          await client.deploy(...DEFAULT_DEPLOY_PARAMS)
          isRejected = false
        } catch (e) {
          isRejected = true
          expect(e instanceof ObjectsDeployError).toBeFalsy()
          expect(e.message).toEqual(errorMessage)
        }
        expect(isRejected).toBe(true)
      })
      it('should throw shorten error', async () => {
        const errorMessage = `
The deployment process has encountered an error.
Deploying to TSTDRV2259448 - Salto Extended Dev - Administrator.
2022-03-30 23:55:26 (PST) Installation started
Info -- Account [(PRODUCTION) Salto Extended Dev]
Info -- Account Customization Project [TempSdfProject-e5a4eed4-e331-490f-9cfa-69cf84bd231b]
Info -- Framework Version [1.0]
Validate manifest -- Success
Validate deploy file -- Success
Validate configuration -- Success
Validate objects -- Success
Validate files -- Success
Validate folders -- Success
Validate translation imports -- Success
Validation of referenceability from custom objects to translations collection strings in progress. -- Success
Validate preferences -- Success
Validate flags -- Success
Validate for circular dependencies -- Success
Validate account settings -- Failed
*** ERROR ***

Validation of account settings failed.

An error occurred during account settings validation.
Details: To install this SuiteCloud project, the INVENTORYSTATUS(Inventory Status) feature must be enabled in the account.
Details: To install this SuiteCloud project, the CHARGEBASEDBILLING(Charge-Based Billing) feature must be enabled in the account.`
        mockExecuteAction.mockImplementation(({ commandName }) => {
          if (commandName === COMMANDS.DEPLOY_PROJECT) {
            throw errorMessage
          }
          return { isSuccess: () => true }
        })
        let isRejected: boolean
        testGraph.addNodes([new GraphNode('name', testSDFNode)])
        try {
          await client.deploy(...DEFAULT_DEPLOY_PARAMS)
          isRejected = false
        } catch (e) {
          isRejected = true
          expect(e instanceof ObjectsDeployError).toBeFalsy()
          expect(e.message).toEqual(`An error occurred during account settings validation.
Details: To install this SuiteCloud project, the INVENTORYSTATUS(Inventory Status) feature must be enabled in the account.
Details: To install this SuiteCloud project, the CHARGEBASEDBILLING(Charge-Based Billing) feature must be enabled in the account.`)
        }
        expect(isRejected).toBe(true)
      })
      it('should throw ObjectsDeployError when deploy failed without error object message', async () => {
        const errorMessage = `
The deployment process has encountered an error.
Deploying to TSTDRV2259448 - Salto Extended Dev - Administrator.
2022-03-31 05:27:04 (PST) Installation started
Info -- Account [(PRODUCTION) Salto Extended Dev]
Info -- Account Customization Project [TempSdfProject-5907cadf-1eea-40d2-9717-600ef164a3e7]
Info -- Framework Version [1.0]
Validate manifest -- Success
Validate deploy file -- Success
Validate configuration -- Success
Validate objects -- Success
Validate files -- Success
Validate folders -- Success
Validate translation imports -- Success
Validation of referenceability from custom objects to translations collection strings in progress. -- Success
Validate preferences -- Success
Validate flags -- Success
Validate for circular dependencies -- Success
Begin deployment
Update object -- cseg2 (customsegment)
Update object -- cseg3 (customsegment)
Update object -- customrecord_flo_customization.custrecord_flo_cust_type (customrecordcustomfield)
Update object -- customrecord_flo_customization.custrecord_flo_int_id (customrecordcustomfield)
Update object -- customrecord_flo_customization.custrecord_flo_cust_id (customrecordcustomfield)
Update object -- customrecord_flo_customization.custrecord_flo_description (customrecordcustomfield)
Update object -- customrecord_flo_customization.custrecord_sp_personal_data (customrecordcustomfield)
Update object -- customrecord_flo_customization.custrecord_flo_help (customrecordcustomfield)
Update object -- customrecord_flo_customization.custrecord_flo_custz_link (customrecordcustomfield)
*** ERROR ***

An error occurred during custom object update.
File: ~/Objects/customrecord_flo_customization.xml
Object: customrecord_flo_customization.custrecord_flo_custz_link (customrecordcustomfield)
`
        mockExecuteAction.mockImplementation(({ commandName }) => {
          if (commandName === COMMANDS.DEPLOY_PROJECT) {
            throw errorMessage
          }
          return { isSuccess: () => true }
        })
        let isRejected: boolean
        testGraph.addNodes([new GraphNode('name', testSDFNode)])
        try {
          await client.deploy(...DEFAULT_DEPLOY_PARAMS)
          isRejected = false
        } catch (e) {
          isRejected = true
          expect(e instanceof ObjectsDeployError).toBeTruthy()
          expect(e instanceof ObjectsDeployError && e.failedObjects).toEqual(
            new Map([
              [
                'customrecord_flo_customization',
                [
                  {
                    message: `An error occurred during custom object update.
File: ~/Objects/customrecord_flo_customization.xml
Object: customrecord_flo_customization.custrecord_flo_custz_link (customrecordcustomfield)
`,
                  },
                ],
              ],
            ]),
          )
        }
        expect(isRejected).toBe(true)
      })
      it('should throw SettingsDeployError when deploy failed on settings validation', async () => {
        const errorMessage = `
The deployment process has encountered an error.
Deploying to TSTDRV2259448 - Salto Extended Dev - Administrator.
2022-04-06 03:06:46 (PST) Installation started
Info -- Account [(PRODUCTION) Salto Extended Dev]
Info -- Account Customization Project [TempSdfProject-e1b95f15-077e-4b41-8a72-572492527886]
Info -- Framework Version [1.0]
Validate manifest -- Success
Validate deploy file -- Success
Validate configuration -- Success
Validate objects -- Success
Validate files -- Success
Validate folders -- Success
Validate translation imports -- Success
Validation of referenceability from custom objects to translations collection strings in progress. -- Success
Validate preferences -- Success
Validate flags -- Success
Validate for circular dependencies -- Success

WARNING -- One or more potential issues were found during custom object validation. (customrecord_flo_customization)
Details: Circular dependencies detected. The following custom objects reference each other in a way that creates direct dependencies: customrecord_flo_customization -> tab_281_t1049933_607 -> customrecord_flo_customization 
If deployment fails, ensure that each custom object does not reference any custom object that references it.
File: ~/Objects/customrecord_flo_customization.xml
Validate account settings -- Success
Validate Custom Objects against the Account -- Failed
Validate file cabinet items against the account -- Failed
Validate translation imports against the account -- Failed
Validation of references to translation collection strings against account in progress. -- Failed
*** ERROR ***

Validation of account settings failed.

An error occurred during configuration validation.
Details: Disable the SUPPLYCHAINPREDICTEDRISKS(Supply Chain Predicted Risks) feature before disabling the SUPPLYCHAINCONTROLTOWER(Supply Chain Control Tower) feature.
File: ~/AccountConfiguration/features.xml`
        mockExecuteAction.mockImplementation(({ commandName }) => {
          if (commandName === COMMANDS.DEPLOY_PROJECT) {
            throw errorMessage
          }
          return { isSuccess: () => true }
        })
        let isRejected: boolean
        testGraph.addNodes([new GraphNode('name', testSDFNode)])
        try {
          await client.deploy(...DEFAULT_DEPLOY_PARAMS)
          isRejected = false
        } catch (e) {
          isRejected = true
          expect(e instanceof SettingsDeployError).toBeTruthy()
          expect(e instanceof SettingsDeployError && e.failedConfigTypes).toEqual(
            new Map([
              [
                'companyFeatures',
                [
                  {
                    message: `An error occurred during configuration validation.
Details: Disable the SUPPLYCHAINPREDICTEDRISKS(Supply Chain Predicted Risks) feature before disabling the SUPPLYCHAINCONTROLTOWER(Supply Chain Control Tower) feature.
File: ~/AccountConfiguration/features.xml`,
                  },
                ],
              ],
            ]),
          )
        }
        expect(isRejected).toBe(true)
      })
    })

    describe('deployFolder', () => {
      it('should succeed', async () => {
        mockExecuteAction.mockResolvedValue({ isSuccess: () => true })
        const folderCustomizationInfo: FolderCustomizationInfo = {
          typeName: 'folder',
          values: {
            description: 'folder description',
          },
          path: ['Templates', 'E-mail Templates', 'InnerFolder'],
        }
        testGraph.addNodes([
          new GraphNode('name', {
            serviceid: 'Templates/E-mail Templates/InnerFolder',
            changeType: 'addition',
            customizationInfo: folderCustomizationInfo,
          } as unknown as SDFObjectNode),
        ])
        await client.deploy(...DEFAULT_DEPLOY_PARAMS)
        expect(mkdirpMock).toHaveBeenCalledTimes(1)
        expect(mkdirpMock).toHaveBeenCalledWith(
          expect.stringContaining(
            `${osPath.sep}Templates${osPath.sep}E-mail Templates${osPath.sep}InnerFolder${osPath.sep}`,
          ),
        )
        expect(writeFileMock).toHaveBeenCalledTimes(3)
        expect(writeFileMock).toHaveBeenCalledWith(
          expect.stringContaining(MOCK_FOLDER_ATTRS_PATH),
          '<folder><description>folder description</description></folder>',
        )
        expect(writeFileMock).toHaveBeenCalledWith(
          expect.stringContaining('manifest.xml'),
          MOCK_MANIFEST_VALID_DEPENDENCIES,
        )
        expect(rmMock).toHaveBeenCalledTimes(2)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(3, addDependenciesCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(4, deployProjectCommandMatcher)
      })
    })

    describe('deployFile', () => {
      it('should succeed', async () => {
        mockExecuteAction.mockResolvedValue({ isSuccess: () => true })
        const dummyFileContent = Buffer.from('dummy file content')
        const fileCustomizationInfo: FileCustomizationInfo = {
          typeName: 'file',
          values: {
            description: 'file description',
          },
          path: ['Templates', 'E-mail Templates', 'InnerFolder', 'content.html'],
          fileContent: dummyFileContent,
        }
        testGraph.addNodes([
          new GraphNode('name', {
            serviceid: 'Templates/E-mail Templates/InnerFolder/content.html',
            changeType: 'addition',
            customizationInfo: fileCustomizationInfo,
          } as unknown as SDFObjectNode),
        ])
        await client.deploy(...DEFAULT_DEPLOY_PARAMS)
        expect(mkdirpMock).toHaveBeenCalledTimes(2)
        expect(mkdirpMock).toHaveBeenCalledWith(
          expect.stringContaining(
            `${osPath.sep}Templates${osPath.sep}E-mail Templates${osPath.sep}InnerFolder${osPath.sep}`,
          ),
        )
        expect(mkdirpMock).toHaveBeenCalledWith(
          expect.stringContaining(
            `${osPath.sep}Templates${osPath.sep}E-mail Templates${osPath.sep}InnerFolder${osPath.sep}${ATTRIBUTES_FOLDER_NAME}`,
          ),
        )
        expect(writeFileMock).toHaveBeenCalledTimes(4)
        expect(writeFileMock).toHaveBeenCalledWith(
          expect.stringContaining(MOCK_FILE_ATTRS_PATH),
          '<file><description>file description</description></file>',
        )
        expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining(MOCK_FILE_PATH), dummyFileContent)
        expect(writeFileMock).toHaveBeenCalledWith(
          expect.stringContaining('manifest.xml'),
          MOCK_MANIFEST_VALID_DEPENDENCIES,
        )
        expect(rmMock).toHaveBeenCalledTimes(2)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(3, addDependenciesCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(4, deployProjectCommandMatcher)
      })
    })

    describe('deploy features object', () => {
      const featuresCustomizationInfo: CustomizationInfo = {
        typeName: CONFIG_FEATURES,
        values: {
          feature: [
            {
              id: 'SUITEAPPCONTROLCENTER',
              status: 'ENABLED',
            },
          ],
        },
      }
      it('should succeed', async () => {
        testGraph.addNodes([
          new GraphNode('name', {
            serviceid: '',
            changeType: 'addition',
            customizationInfo: featuresCustomizationInfo,
          } as SDFObjectNode),
        ])
        mockExecuteAction.mockResolvedValue({
          isSuccess: () => true,
          data: ['Configure feature -- The SUITEAPPCONTROLCENTER(Departments) feature has been DISABLED'],
        })
        await client.deploy(...DEFAULT_DEPLOY_PARAMS)
        expect(writeFileMock).toHaveBeenCalledTimes(3)
        expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining('features.xml'), MOCK_FEATURES_XML)
        expect(writeFileMock).toHaveBeenCalledWith(
          expect.stringContaining('manifest.xml'),
          MOCK_MANIFEST_VALID_DEPENDENCIES,
        )
        expect(rmMock).toHaveBeenCalledTimes(2)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(3, addDependenciesCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(4, deployProjectCommandMatcher)
      })

      it('should throw FeaturesDeployError on failed features deploy', async () => {
        const errorMessage =
          'Configure feature -- Enabling of the SUITEAPPCONTROLCENTER(SuiteApp Control Center) feature has FAILED'
        testGraph.addNodes([
          new GraphNode('name', {
            serviceid: '',
            changeType: 'addition',
            customizationInfo: featuresCustomizationInfo,
          } as SDFObjectNode),
        ])
        mockExecuteAction.mockResolvedValue({ isSuccess: () => true, data: [errorMessage] })
        await expect(client.deploy(...DEFAULT_DEPLOY_PARAMS)).rejects.toThrow(
          new FeaturesDeployError(errorMessage, ['SUITEAPPCONTROLCENTER']),
        )
      })

      it('should throw FeaturesDeployError on failed features deploy - in other language', async () => {
        const errorMessages = [
          'Commencer le d.ploiement',
          'Configurer la fonction -- La d.sactivation de la fonction SUITEAPPCONTROLCENTER(SuiteApp Control Center) a .chou.',
        ]
        mockExecuteAction.mockResolvedValue({ isSuccess: () => true, data: errorMessages })
        await expect(client.deploy(...DEFAULT_DEPLOY_PARAMS)).rejects.toThrow(
          new FeaturesDeployError(errorMessages[1], ['SUITEAPPCONTROLCENTER']),
        )
      })
    })

    it('should deploy multiple CustomizationInfos in a single project', async () => {
      mockExecuteAction.mockResolvedValue({ isSuccess: () => true })
      const scriptId1 = 'filename'
      const customTypeInfo1: CustomTypeInfo = {
        typeName: 'typeName',
        values: { key: 'val' },
        scriptId: scriptId1,
      }
      const scriptId2 = 'filename'
      const customTypeInfo2: CustomTypeInfo = {
        typeName: 'typeName',
        values: { key: 'val' },
        scriptId: scriptId2,
      }
      testGraph.addNodes([
        new GraphNode('name1', {
          serviceid: scriptId1,
          changeType: 'addition',
          customizationInfo: customTypeInfo1,
        } as unknown as SDFObjectNode),
        new GraphNode('name2', {
          serviceid: scriptId2,
          changeType: 'addition',
          customizationInfo: customTypeInfo2,
        } as unknown as SDFObjectNode),
      ])
      await client.deploy(...DEFAULT_DEPLOY_PARAMS)
      expect(writeFileMock).toHaveBeenCalledTimes(4)
      expect(writeFileMock).toHaveBeenCalledWith(
        expect.stringContaining(`${scriptId1}.xml`),
        '<typeName><key>val</key></typeName>',
      )
      expect(writeFileMock).toHaveBeenCalledWith(
        expect.stringContaining(`${scriptId2}.xml`),
        '<typeName><key>val</key></typeName>',
      )
      expect(writeFileMock).toHaveBeenCalledWith(
        expect.stringContaining('manifest.xml'),
        MOCK_MANIFEST_VALID_DEPENDENCIES,
      )
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, addDependenciesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, deployProjectCommandMatcher)
    })

    describe('validate only', () => {
      const failObject = 'fail_object'
      testGraph.addNodes([
        new GraphNode('name2', {
          serviceid: failObject,
          changeType: 'addition',
          customizationInfo: { typeName: 'typeName', values: { key: 'val' }, scriptId: failObject },
        } as unknown as SDFObjectNode),
        new GraphNode('name2', {
          serviceid: 'successObject',
          changeType: 'addition',
          customizationInfo: { typeName: 'typeName', values: { key: 'val' }, scriptId: 'successObject' },
        } as unknown as SDFObjectNode),
      ])
      const deployParams: [undefined, SdfDeployParams, Graph<SDFObjectNode>] = [
        undefined,
        { ...DEFAULT_DEPLOY_PARAMS[1], validateOnly: true },
        testGraph,
      ]
      beforeEach(() => {
        jest.clearAllMocks()
      })
      it('should validate without errors', async () => {
        mockExecuteAction.mockResolvedValue({ isSuccess: () => true, data: [''] })
        await client.deploy(...deployParams)
        expect(mockExecuteAction).toHaveBeenCalledWith(validateProjectCommandMatcher)
      })
      it('should throw ManifestValidationError', async () => {
        let errorMessage: string
        const errorReferenceName = 'some_scriptid'
        const manifestErrorMessage = `An error occurred during account settings validation.
Details: The manifest contains a dependency on ${errorReferenceName} object, but it is not in the account.`
        mockExecuteAction.mockImplementation(context => {
          if (context.commandName === COMMANDS.VALIDATE_PROJECT) {
            errorMessage = `Warning: The validation process has encountered an error.
Validating against TSTDRV2257860 - Salto Development - Administrator.
Validate manifest -- Success
Validate deploy file -- Success
Validate configuration -- Success
Validate objects -- Success

WARNING -- One or more potential issues were found during custom object validation. (${failObject})
Details: Missing or invalid field attribute value for field label. When specifying a scriptid as the field value, set translate = T.
File: ~/Objects/${failObject}.xml
Validate files -- Success
Validate folders -- Success
Validate translation imports -- Success
Validation of referenceability from custom objects to translations collection strings in progress. -- Success
Validate preferences -- Success
Validate flags -- Success
Validate for circular dependencies -- Success
Validate account settings -- Failed
*** ERROR ***

Validation of account settings failed.

An error occurred during account settings validation.
Details: The manifest contains a dependency on ${errorReferenceName} object, but it is not in the account.`
            throw new Error(errorMessage)
          }
          return Promise.resolve({ isSuccess: () => true })
        })

        try {
          await client.deploy(...deployParams)
          // should throw before this test
          expect(false).toBeTruthy()
        } catch (e) {
          expect(e instanceof ManifestValidationError).toBeTruthy()
          expect(e.message).toContain(manifestErrorMessage)
          expect(e.missingDependencies).toEqual([{ scriptId: errorReferenceName, message: manifestErrorMessage }])
        }
      })

      it('should throw MissingManifestFeaturesError', async () => {
        mockExecuteAction.mockImplementation(context => {
          const errorMessage = `An error occurred during custom object validation. (custimport_xepi_subscriptionimport)
        Details: You must specify the SUBSCRIPTIONBILLING(Subscription Billing) feature in the project manifest as required to use the SUBSCRIPTION value in the recordtype field.
        File: ~/Objects/custimport_xepi_subscriptionimport.xml
        
        An error occurred during custom object validation. (customworkflow1)
        Details: When the SuiteCloud project contains a workflow, the manifest must define the WORKFLOW feature as required.
        File: ~/Objects/customworkflow1.xml
        
        An error occurred during custom object validation. (customworkflow2)
        Details: The following features must be specified in the manifest to use the [scriptid=custform1] value with the Transaction Form1 condition builder parameter in the customworkflow2 workflow: RECEIVABLES
        File: ~/Objects/customworkflow2.xml`

          if (context.commandName === COMMANDS.VALIDATE_PROJECT) {
            throw new Error(errorMessage)
          }
          return Promise.resolve({ isSuccess: () => true })
        })
        try {
          await client.deploy(...deployParams)
          expect(false).toBeTruthy()
        } catch (e) {
          expect(e instanceof MissingManifestFeaturesError).toBeTruthy()
          expect(e.message).toContain('Details: You must specify the SUBSCRIPTIONBILLING(Subscription Billing)')
          expect(e.missingFeatures).toEqual(['SUBSCRIPTIONBILLING', 'WORKFLOW', 'RECEIVABLES'])
        }
      })
      it('should throw error', async () => {
        const errorMessage = 'some error'
        mockExecuteAction.mockImplementation(context => {
          if (context.commandName === COMMANDS.VALIDATE_PROJECT) {
            throw new Error(errorMessage)
          }
          return Promise.resolve({ isSuccess: () => true })
        })
        await expect(client.deploy(...deployParams)).rejects.toThrow(errorMessage)
        expect(mockExecuteAction).toHaveBeenCalledWith(validateProjectCommandMatcher)
      })
      it('should throw error when sdf result contain error in other language', async () => {
        const sdfResult = ['Starting validation', '*** ERREUR ***', 'some error']
        mockExecuteAction.mockResolvedValue({ isSuccess: () => true, data: sdfResult })
        await expect(client.deploy(...deployParams)).rejects.toThrow(
          new Error('Starting validation\n*** ERREUR ***\nsome error'),
        )
      })
    })
  })
})
