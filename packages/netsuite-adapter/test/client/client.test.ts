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
import _ from 'lodash'
import { readFile, readDir, writeFile, mkdirp, rm } from '@salto-io/file'
import osPath from 'path'
import mockClient, { DUMMY_CREDENTIALS } from './client'
import NetsuiteClient, {
  ATTRIBUTES_FILE_SUFFIX, ATTRIBUTES_FOLDER_NAME, COMMANDS, CustomTypeInfo,
  FileCustomizationInfo, FOLDER_ATTRIBUTES_FILE_SUFFIX, FolderCustomizationInfo, SDF_PATH_SEPARATOR,
  TemplateCustomTypeInfo,
} from '../../src/client/client'


const MOCK_TEMPLATE_CONTENT = 'Template Inner Content'
const MOCK_FILE_PATH = `${osPath.sep}Templates${osPath.sep}E-mail Templates${osPath.sep}InnerFolder${osPath.sep}content.html`
const MOCK_FILE_ATTRS_PATH = `${osPath.sep}Templates${osPath.sep}E-mail Templates${osPath.sep}InnerFolder${osPath.sep}${ATTRIBUTES_FOLDER_NAME}${osPath.sep}content.html${ATTRIBUTES_FILE_SUFFIX}`
const MOCK_FOLDER_ATTRS_PATH = `${osPath.sep}Templates${osPath.sep}E-mail Templates${osPath.sep}InnerFolder${osPath.sep}${ATTRIBUTES_FOLDER_NAME}${osPath.sep}${FOLDER_ATTRIBUTES_FILE_SUFFIX}`
jest.mock('@salto-io/file', () => ({
  readDir: jest.fn().mockImplementation(() => ['a.xml', 'b.xml', 'a.template.html']),
  readFile: jest.fn().mockImplementation(filePath => {
    if (filePath.includes('.template.')) {
      return MOCK_TEMPLATE_CONTENT
    }
    if (filePath.endsWith(MOCK_FILE_PATH)) {
      return 'dummy file content'
    }
    if (filePath.endsWith(MOCK_FILE_ATTRS_PATH)) {
      return '<file><description>file description</description></file>'
    }
    if (filePath.endsWith(MOCK_FOLDER_ATTRS_PATH)) {
      return '<folder><description>folder description</description></folder>'
    }
    return `<TypeA filename="${filePath.split('/').pop()}">`
  }),
  writeFile: jest.fn(),
  mkdirp: jest.fn(),
  rm: jest.fn(),
}))
const readFileMock = readFile as unknown as jest.Mock
const readDirMock = readDir as jest.Mock
const writeFileMock = writeFile as jest.Mock
const mkdirpMock = mkdirp as jest.Mock
const rmMock = rm as jest.Mock

jest.mock('@salto-io/lowerdash', () => ({
  ...jest.requireActual('@salto-io/lowerdash'),
  hash: {
    toMD5: jest.fn().mockImplementation(input => input),
  },
}))

const mockExecuteAction = jest.fn()

jest.mock('../../src/client/sdf_root_cli_path', () => ({
  getRootCLIPath: jest.fn().mockResolvedValue('path/to/cli'),
}))

jest.mock('@salto-io/suitecloud-cli', () => ({
  SDKOperationResultUtils: {
    hasErrors: jest.fn().mockImplementation(operationResult =>
      operationResult.status === 'ERROR'),
    getErrorMessagesString: jest.fn().mockReturnValue('Error message'),
  },
  CommandOutputHandler: jest.fn(),
  CommandOptionsValidator: jest.fn(),
  CLIConfigurationService: jest.fn(),
  CommandInstanceFactory: jest.fn(),
  AuthenticationService: jest.fn(),
  CommandsMetadataService: jest.fn().mockImplementation(() => ({
    initializeCommandsMetadata: jest.fn(),
  })),
  CommandActionExecutor: jest.fn().mockImplementation(() => ({
    executeAction: mockExecuteAction,
  })),
}), { virtual: true })

describe('netsuite client', () => {
  const transformedAccountId = 'TSTDRV123456_SB'
  const createProjectCommandMatcher = expect
    .objectContaining({ commandName: COMMANDS.CREATE_PROJECT })
  const expectedAuthId = transformedAccountId + DUMMY_CREDENTIALS.tokenId
    + DUMMY_CREDENTIALS.tokenSecret
  const reuseAuthIdCommandMatcher = expect.objectContaining({
    commandName: COMMANDS.SETUP_ACCOUNT,
    arguments: {
      authid: expectedAuthId,
    },
  })
  const saveTokenCommandMatcher = expect.objectContaining({
    commandName: COMMANDS.SETUP_ACCOUNT,
    arguments: {
      accountid: transformedAccountId,
      tokenid: DUMMY_CREDENTIALS.tokenId,
      tokensecret: DUMMY_CREDENTIALS.tokenSecret,
      authid: expectedAuthId,
    },
  })

  const typeNames = ['TypeA', 'TypeB']
  const importObjectsCommandMatcher = expect
    .objectContaining({ commandName: COMMANDS.IMPORT_OBJECTS })
  const listFilesCommandMatcher = expect
    .objectContaining({ commandName: COMMANDS.LIST_FILES })
  const importFilesCommandMatcher = expect
    .objectContaining({ commandName: COMMANDS.IMPORT_FILES })
  const addDependenciesCommandMatcher = expect
    .objectContaining({ commandName: COMMANDS.ADD_PROJECT_DEPENDENCIES })
  const deployProjectCommandMatcher = expect
    .objectContaining({ commandName: COMMANDS.DEPLOY_PROJECT })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('validateCredentials', () => {
    it('should fail when SETUP_ACCOUNT has failed', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.SETUP_ACCOUNT) {
          return Promise.resolve({ status: 'ERROR' })
        }
        return Promise.resolve({ status: 'SUCCESS' })
      })
      await expect(NetsuiteClient.validateCredentials(DUMMY_CREDENTIALS)).rejects.toThrow()
      expect(mockExecuteAction).toHaveBeenCalledWith(createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(saveTokenCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(importObjectsCommandMatcher)
    })

    it('should succeed when SETUP_ACCOUNT has failed only in reuseAuthId', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.SETUP_ACCOUNT
          && _.isUndefined(context.arguments.accountid)) {
          return Promise.resolve({ status: 'ERROR' })
        }
        return Promise.resolve({ status: 'SUCCESS' })
      })
      const accountId = await NetsuiteClient.validateCredentials(DUMMY_CREDENTIALS)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, saveTokenCommandMatcher)
      expect(accountId).toEqual(transformedAccountId)
    })

    it('should succeed', async () => {
      mockExecuteAction.mockResolvedValue({ status: 'SUCCESS' })
      const accountId = await NetsuiteClient.validateCredentials(DUMMY_CREDENTIALS)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(saveTokenCommandMatcher)
      expect(accountId).toEqual(transformedAccountId)
    })
  })

  describe('getCustomObjects', () => {
    let client: NetsuiteClient
    beforeEach(() => {
      client = mockClient()
    })

    it('should fail when CREATE_PROJECT has failed', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.CREATE_PROJECT) {
          return Promise.resolve({ status: 'ERROR' })
        }
        return Promise.resolve({ status: 'SUCCESS' })
      })
      await expect(client.getCustomObjects(typeNames, true)).rejects.toThrow()
      expect(mockExecuteAction).toHaveBeenCalledWith(createProjectCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(saveTokenCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(importObjectsCommandMatcher)
    })

    it('should fail when SETUP_ACCOUNT has failed', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.SETUP_ACCOUNT) {
          return Promise.resolve({ status: 'ERROR' })
        }
        return Promise.resolve({ status: 'SUCCESS' })
      })
      await expect(client.getCustomObjects(typeNames, true)).rejects.toThrow()
      expect(mockExecuteAction).toHaveBeenCalledWith(createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(saveTokenCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(importObjectsCommandMatcher)
    })

    it('should return all types as failedTypes and failedToFetchAllAtOnce when IMPORT_OBJECTS has failed with fetchAllAtOnce', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.IMPORT_OBJECTS
          && ['TypeA', 'ALL'].includes(context.arguments.type)) {
          return Promise.resolve({ status: 'ERROR' })
        }
        return Promise.resolve({ status: 'SUCCESS' })
      })
      const getCustomObjectsResult = await client.getCustomObjects(typeNames, true)
      const numberOfCallsToImport = typeNames.length + 1 // 1 stands for import 'ALL'
      expect(mockExecuteAction)
        .toHaveBeenCalledTimes(numberOfCallsToImport + 2 /* createProject & setupAccount */)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(saveTokenCommandMatcher)
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < numberOfCallsToImport; i++) {
        expect(mockExecuteAction).toHaveBeenNthCalledWith(3 + i, importObjectsCommandMatcher)
      }
      expect(getCustomObjectsResult.failedTypes).toEqual(['TypeA'])
      expect(getCustomObjectsResult.failedToFetchAllAtOnce).toEqual(true)
    })

    it('should return all types as failedTypes and failedToFetchAllAtOnce when IMPORT_OBJECTS has failed without fetchAllAtOnce', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.IMPORT_OBJECTS && context.arguments.type === 'TypeA') {
          return Promise.resolve({ status: 'ERROR' })
        }
        return Promise.resolve({ status: 'SUCCESS' })
      })
      const getCustomObjectsResult = await client.getCustomObjects(typeNames, false)
      const numberOfCallsToImport = typeNames.length
      expect(mockExecuteAction)
        .toHaveBeenCalledTimes(numberOfCallsToImport + 2 /* createProject & setupAccount */)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(saveTokenCommandMatcher)
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < numberOfCallsToImport; i++) {
        expect(mockExecuteAction).toHaveBeenNthCalledWith(3 + i, importObjectsCommandMatcher)
      }
      expect(getCustomObjectsResult.failedTypes).toEqual(['TypeA'])
      expect(getCustomObjectsResult.failedToFetchAllAtOnce).toEqual(false)
    })

    it('should succeed when SETUP_ACCOUNT has failed only in reuseAuthId', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.SETUP_ACCOUNT
          && _.isUndefined(context.arguments.accountid)) {
          return Promise.resolve({ status: 'ERROR' })
        }
        return Promise.resolve({ status: 'SUCCESS' })
      })
      await client.getCustomObjects(typeNames, true)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, importObjectsCommandMatcher)
    })

    it('should succeed', async () => {
      mockExecuteAction.mockResolvedValue({ status: 'SUCCESS' })
      const { elements: customizationInfos, failedToFetchAllAtOnce, failedTypes } = await client
        .getCustomObjects(typeNames, true)
      expect(failedToFetchAllAtOnce).toBe(false)
      expect(failedTypes).toHaveLength(0)
      expect(readDirMock).toHaveBeenCalledTimes(1)
      expect(readFileMock).toHaveBeenCalledTimes(3)
      expect(rmMock).toHaveBeenCalledTimes(1)
      expect(customizationInfos).toHaveLength(2)
      expect(customizationInfos).toEqual([{
        typeName: 'TypeA',
        scriptId: 'a',
        values: {
          '@_filename': 'a.xml',
        },
        fileContent: MOCK_TEMPLATE_CONTENT,
        fileExtension: 'html',
      },
      {
        typeName: 'TypeA',
        scriptId: 'b',
        values: {
          '@_filename': 'b.xml',
        },
      }])

      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, importObjectsCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(saveTokenCommandMatcher)
    })
  })

  describe('importFileCabinetContent', () => {
    let client: NetsuiteClient
    beforeEach(() => {
      client = mockClient()
    })

    it('should fail when CREATE_PROJECT has failed', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.CREATE_PROJECT) {
          return Promise.resolve({ status: 'ERROR' })
        }
        return Promise.resolve({ status: 'SUCCESS' })
      })
      await expect(client.importFileCabinetContent([])).rejects.toThrow()
      expect(rmMock).toHaveBeenCalledTimes(0)
    })

    it('should fail when SETUP_ACCOUNT has failed', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.SETUP_ACCOUNT) {
          return Promise.resolve({ status: 'ERROR' })
        }
        return Promise.resolve({ status: 'SUCCESS' })
      })
      await expect(client.importFileCabinetContent([])).rejects.toThrow()
    })

    it('should fail when LIST_FILES has failed', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.LIST_FILES) {
          return Promise.resolve({ status: 'ERROR' })
        }
        return Promise.resolve({ status: 'SUCCESS' })
      })
      await expect(client.importFileCabinetContent([])).rejects.toThrow()
    })

    it('should succeed when having no files', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.LIST_FILES) {
          return Promise.resolve({
            status: 'SUCCESS',
            data: [],
          })
        }
        if (context.commandName === COMMANDS.IMPORT_FILES) {
          return Promise.resolve({
            status: 'SUCCESS',
            data: {
              results: [],
            },
          })
        }
        return Promise.resolve({ status: 'SUCCESS' })
      })
      const { elements, failedPaths } = await client.importFileCabinetContent([])
      expect(mockExecuteAction).toHaveBeenCalledTimes(6)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(5, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(6, importFilesCommandMatcher)
      expect(elements).toHaveLength(0)
      expect(failedPaths).toHaveLength(0)
    })

    it('should succeed when importFiles when failing to import a certain file', async () => {
      const failedPath = 'error'
      const filesPathResult = [
        MOCK_FILE_PATH,
        failedPath,
      ]
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.LIST_FILES
          && context.arguments.folder === `${SDF_PATH_SEPARATOR}Templates`) {
          return Promise.resolve({
            status: 'SUCCESS',
            data: filesPathResult,
          })
        }
        if (context.commandName === COMMANDS.IMPORT_FILES) {
          if (context.arguments.paths.includes(failedPath)) {
            return Promise.resolve({
              status: 'ERROR',
              data: {
                results: [],
              },
            })
          }
          return Promise.resolve({
            status: 'SUCCESS',
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
        return Promise.resolve({ status: 'SUCCESS' })
      })
      const { elements, failedPaths } = await client.importFileCabinetContent([])
      expect(mockExecuteAction).toHaveBeenCalledTimes(8)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(5, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(6, importFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(7, importFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(8, importFilesCommandMatcher)
      expect(elements).toHaveLength(2)
      expect(failedPaths).toEqual([failedPath])
      expect(rmMock).toHaveBeenCalledTimes(1)
    })

    it('should succeed when having duplicated paths', async () => {
      mockExecuteAction.mockImplementation(context => {
        const filesPathResult = [
          MOCK_FILE_PATH,
        ]
        if (context.commandName === COMMANDS.LIST_FILES
          && context.arguments.folder === `${SDF_PATH_SEPARATOR}Templates`) {
          return Promise.resolve({
            status: 'SUCCESS',
            data: filesPathResult,
          })
        }
        if (context.commandName === COMMANDS.IMPORT_FILES
          && _.isEqual(context.arguments.paths, filesPathResult)) {
          return Promise.resolve({
            status: 'SUCCESS',
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
        return Promise.resolve({ status: 'SUCCESS' })
      })
      const { elements, failedPaths } = await client.importFileCabinetContent([])
      expect(readFileMock).toHaveBeenCalledTimes(3)
      expect(elements).toHaveLength(2)
      expect(elements).toEqual([{
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
      }])
      expect(failedPaths).toHaveLength(0)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(5, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(6, importFilesCommandMatcher)
    })

    it('should filter out paths that match filePathRegexSkipList', async () => {
      mockExecuteAction.mockImplementation(context => {
        const filesPathResult = [
          MOCK_FILE_PATH,
        ]
        if (context.commandName === COMMANDS.LIST_FILES
          && context.arguments.folder === `${SDF_PATH_SEPARATOR}Templates`) {
          return Promise.resolve({
            status: 'SUCCESS',
            data: filesPathResult,
          })
        }
        if (context.commandName === COMMANDS.IMPORT_FILES) {
          if (_.isEqual(context.arguments.paths, filesPathResult)) {
            return Promise.resolve({
              status: 'SUCCESS',
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
          return Promise.resolve({
            status: 'SUCCESS',
            data: {
              results: [],
            },
          })
        }
        return Promise.resolve({ status: 'SUCCESS' })
      })
      const { elements, failedPaths } = await client.importFileCabinetContent(
        [new RegExp(MOCK_FILE_PATH)]
      )
      expect(readFileMock).toHaveBeenCalledTimes(0)
      expect(elements).toHaveLength(0)
      expect(failedPaths).toHaveLength(0)
      expect(mockExecuteAction).toHaveBeenCalledTimes(6)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(5, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(6, importFilesCommandMatcher)
    })

    it('should return only loaded files', async () => {
      mockExecuteAction.mockImplementation(context => {
        const filesPathResult = [
          MOCK_FILE_PATH,
        ]
        if (context.commandName === COMMANDS.LIST_FILES
          && context.arguments.folder === `${SDF_PATH_SEPARATOR}Templates`) {
          return Promise.resolve({
            status: 'SUCCESS',
            data: filesPathResult,
          })
        }
        if (context.commandName === COMMANDS.IMPORT_FILES
          && _.isEqual(context.arguments.paths, filesPathResult)) {
          return Promise.resolve({
            status: 'SUCCESS',
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
        return Promise.resolve({ status: 'SUCCESS' })
      })
      const { elements, failedPaths } = await client.importFileCabinetContent([])
      expect(readFileMock).toHaveBeenCalledTimes(1)
      expect(elements).toHaveLength(1)
      expect(elements).toEqual([{
        typeName: 'folder',
        values: {
          description: 'folder description',
        },
        path: ['Templates', 'E-mail Templates', 'InnerFolder'],
      }])
      expect(failedPaths).toHaveLength(0)
      expect(rmMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('deploy', () => {
    let client: NetsuiteClient
    beforeEach(() => {
      client = mockClient()
    })

    describe('deployCustomObject', () => {
      it('should succeed when SETUP_ACCOUNT has failed only in reuseAuthId', async () => {
        mockExecuteAction.mockImplementation(context => {
          if (context.commandName === COMMANDS.SETUP_ACCOUNT
            && _.isUndefined(context.arguments.accountid)) {
            return Promise.resolve({ status: 'ERROR' })
          }
          return Promise.resolve({ status: 'SUCCESS' })
        })
        const scriptId = 'filename'
        const customTypeInfo = {
          typeName: 'typeName',
          values: {
            key: 'val',
          },
          scriptId,
        } as CustomTypeInfo
        await client.deploy([customTypeInfo])
        expect(writeFileMock).toHaveBeenCalledTimes(1)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(2, reuseAuthIdCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(3, saveTokenCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(4, addDependenciesCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(5, deployProjectCommandMatcher)
      })

      it('should succeed for CustomTypeInfo', async () => {
        mockExecuteAction.mockResolvedValue({ status: 'SUCCESS' })
        const scriptId = 'filename'
        const customTypeInfo = {
          typeName: 'typeName',
          values: {
            key: 'val',
          },
          scriptId,
        } as CustomTypeInfo
        await client.deploy([customTypeInfo])
        expect(writeFileMock).toHaveBeenCalledTimes(1)
        expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining(`${scriptId}.xml`),
          '<typeName><key>val</key></typeName>')
        expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(2, reuseAuthIdCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(3, addDependenciesCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(4, deployProjectCommandMatcher)
        expect(mockExecuteAction).not.toHaveBeenCalledWith(saveTokenCommandMatcher)
      })

      it('should succeed for TemplateCustomTypeInfo', async () => {
        mockExecuteAction.mockResolvedValue({ status: 'SUCCESS' })
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
        await client.deploy([templateCustomTypeInfo])
        expect(writeFileMock).toHaveBeenCalledTimes(2)
        expect(writeFileMock)
          .toHaveBeenCalledWith(expect.stringContaining(`${scriptId}.xml`), '<typeName><key>val</key></typeName>')
        expect(writeFileMock)
          .toHaveBeenCalledWith(expect.stringContaining(`${scriptId}.template.html`), MOCK_TEMPLATE_CONTENT)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(2, reuseAuthIdCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(3, addDependenciesCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(4, deployProjectCommandMatcher)
        expect(mockExecuteAction).not.toHaveBeenCalledWith(saveTokenCommandMatcher)
      })

      it('should wrap the thrown string with Error object', async () => {
        const errorMessage = 'error message'
        mockExecuteAction.mockImplementation(() => {
          throw errorMessage
        })
        await expect(client.deploy([{} as CustomTypeInfo])).rejects
          .toThrow(new Error(errorMessage))
      })

      it('should throw Error object', async () => {
        const errorMessage = 'error message'
        mockExecuteAction.mockImplementation(() => {
          throw new Error(errorMessage)
        })
        await expect(client.deploy([{} as CustomTypeInfo])).rejects
          .toThrow(new Error(errorMessage))
      })
    })

    describe('deployFolder', () => {
      it('should succeed', async () => {
        mockExecuteAction.mockResolvedValue({ status: 'SUCCESS' })
        const folderCustomizationInfo: FolderCustomizationInfo = {
          typeName: 'folder',
          values: {
            description: 'folder description',
          },
          path: ['Templates', 'E-mail Templates', 'InnerFolder'],
        }
        await client.deploy([folderCustomizationInfo])
        expect(mkdirpMock).toHaveBeenCalledTimes(1)
        expect(mkdirpMock)
          .toHaveBeenCalledWith(expect.stringContaining(`${osPath.sep}Templates${osPath.sep}E-mail Templates${osPath.sep}InnerFolder${osPath.sep}`))
        expect(writeFileMock).toHaveBeenCalledTimes(1)
        expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining(MOCK_FOLDER_ATTRS_PATH),
          '<folder><description>folder description</description></folder>')
        expect(rmMock).toHaveBeenCalledTimes(1)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(2, reuseAuthIdCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(3, addDependenciesCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(4, deployProjectCommandMatcher)
      })
    })

    describe('deployFile', () => {
      it('should succeed', async () => {
        mockExecuteAction.mockResolvedValue({ status: 'SUCCESS' })
        const fileCustomizationInfo: FileCustomizationInfo = {
          typeName: 'file',
          values: {
            description: 'file description',
          },
          path: ['Templates', 'E-mail Templates', 'InnerFolder', 'content.html'],
          fileContent: 'dummy file content',
        }
        await client.deploy([fileCustomizationInfo])
        expect(mkdirpMock).toHaveBeenCalledTimes(2)
        expect(mkdirpMock)
          .toHaveBeenCalledWith(expect.stringContaining(`${osPath.sep}Templates${osPath.sep}E-mail Templates${osPath.sep}InnerFolder${osPath.sep}`))
        expect(mkdirpMock)
          .toHaveBeenCalledWith(expect.stringContaining(`${osPath.sep}Templates${osPath.sep}E-mail Templates${osPath.sep}InnerFolder${osPath.sep}${ATTRIBUTES_FOLDER_NAME}`))
        expect(writeFileMock).toHaveBeenCalledTimes(2)
        expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining(MOCK_FILE_ATTRS_PATH),
          '<file><description>file description</description></file>')
        expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining(MOCK_FILE_PATH),
          'dummy file content')
        expect(rmMock).toHaveBeenCalledTimes(1)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(2, reuseAuthIdCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(3, addDependenciesCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(4, deployProjectCommandMatcher)
      })
    })

    it('should deploy multiple CustomizationInfos in a single project', async () => {
      mockExecuteAction.mockResolvedValue({ status: 'SUCCESS' })
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
      await client.deploy([customTypeInfo1, customTypeInfo2])
      expect(writeFileMock).toHaveBeenCalledTimes(2)
      expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining(`${scriptId1}.xml`),
        '<typeName><key>val</key></typeName>')
      expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining(`${scriptId2}.xml`),
        '<typeName><key>val</key></typeName>')
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, addDependenciesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, deployProjectCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(saveTokenCommandMatcher)
    })
  })
})
