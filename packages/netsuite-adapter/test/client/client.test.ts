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
import { OperationResult } from '@salto-io/suitecloud-cli'
import _ from 'lodash'
import { readFile, readDir, writeFile } from '@salto-io/file'
import { logger } from '@salto-io/logging'
import mockClient, { DUMMY_CREDENTIALS } from './client'
import NetsuiteClient, { COMMANDS, CustomizationInfo } from '../../src/client/client'


const MOCK_TEMPLATE_CONTENT = 'Template Inner Content'
jest.mock('@salto-io/file', () => ({
  readDir: jest.fn().mockImplementation(() => ['a.xml', 'b.xml', 'a.template.html']),
  readFile: jest.fn().mockImplementation(filePath => {
    if (filePath.includes('.template.')) {
      return MOCK_TEMPLATE_CONTENT
    }
    return `<elementName filename="${filePath.split('/').pop()}">`
  }),
  writeFile: jest.fn(),
}))
const readFileMock = readFile as unknown as jest.Mock
const readDirMock = readDir as jest.Mock
const writeFileMock = writeFile as jest.Mock

const mockExecuteAction = jest.fn()

jest.mock('@salto-io/suitecloud-cli', () => ({
  SDKOperationResultUtils: {
    hasErrors: jest.fn().mockImplementation((operationResult: OperationResult) =>
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
}))

describe('netsuite client', () => {
  const createProjectCommandMatcher = expect
    .objectContaining({ commandName: COMMANDS.CREATE_PROJECT })
  const reuseAuthIdCommandMatcher = expect.objectContaining({
    commandName: COMMANDS.SETUP_ACCOUNT,
    arguments: expect.not.objectContaining({
      accountid: DUMMY_CREDENTIALS.accountId,
      tokenid: DUMMY_CREDENTIALS.tokenId,
      tokensecret: DUMMY_CREDENTIALS.tokenSecret,
    }),
  })
  const saveTokenCommandMatcher = expect.objectContaining({
    commandName: COMMANDS.SETUP_ACCOUNT,
    arguments: expect.objectContaining({
      accountid: DUMMY_CREDENTIALS.accountId,
      tokenid: DUMMY_CREDENTIALS.tokenId,
      tokensecret: DUMMY_CREDENTIALS.tokenSecret,
    }),
  })
  const importObjectsCommandMatcher = expect
    .objectContaining({ commandName: COMMANDS.IMPORT_OBJECTS })
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
      expect(accountId).toEqual(DUMMY_CREDENTIALS.accountId)
    })

    it('should succeed', async () => {
      mockExecuteAction.mockResolvedValue({ status: 'SUCCESS' })
      const accountId = await NetsuiteClient.validateCredentials(DUMMY_CREDENTIALS)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(saveTokenCommandMatcher)
      expect(accountId).toEqual(DUMMY_CREDENTIALS.accountId)
    })
  })

  describe('listCustomObjects', () => {
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
      await expect(client.listCustomObjects()).rejects.toThrow()
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
      await expect(client.listCustomObjects()).rejects.toThrow()
      expect(mockExecuteAction).toHaveBeenCalledWith(createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(saveTokenCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(importObjectsCommandMatcher)
    })

    it('should fail when IMPORT_OBJECTS has failed', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.IMPORT_OBJECTS) {
          return Promise.resolve({ status: 'ERROR' })
        }
        return Promise.resolve({ status: 'SUCCESS' })
      })
      await expect(client.listCustomObjects()).rejects.toThrow()
      expect(mockExecuteAction).toHaveBeenCalledWith(createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(importObjectsCommandMatcher)
    })

    it('should succeed when SETUP_ACCOUNT has failed only in reuseAuthId', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.SETUP_ACCOUNT
          && _.isUndefined(context.arguments.accountid)) {
          return Promise.resolve({ status: 'ERROR' })
        }
        return Promise.resolve({ status: 'SUCCESS' })
      })
      await client.listCustomObjects()
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, importObjectsCommandMatcher)
    })

    it('should succeed', async () => {
      mockExecuteAction.mockResolvedValue({ status: 'SUCCESS' })
      const customizationInfos = await client.listCustomObjects()
      expect(readDirMock).toHaveBeenCalledTimes(1)
      expect(readFileMock).toHaveBeenCalledTimes(3)
      expect(customizationInfos).toHaveLength(2)
      expect(customizationInfos).toEqual([{
        typeName: 'elementName',
        values: {
          '@_filename': 'a.xml',
        },
        additionalFileContent: MOCK_TEMPLATE_CONTENT,
        additionalFileExtension: 'html',
      },
      {
        typeName: 'elementName',
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

  describe('deployCustomObject', () => {
    let client: NetsuiteClient
    beforeEach(() => {
      client = mockClient()
    })
    it('should succeed when SETUP_ACCOUNT has failed only in reuseAuthId', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.SETUP_ACCOUNT
          && _.isUndefined(context.arguments.accountid)) {
          return Promise.resolve({ status: 'ERROR' })
        }
        return Promise.resolve({ status: 'SUCCESS' })
      })
      await client.deployCustomObject('elementName', {} as CustomizationInfo)
      expect(writeFileMock).toHaveBeenCalledTimes(1)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, addDependenciesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(5, deployProjectCommandMatcher)
    })

    it('should succeed for customizationInfo without additionalFile', async () => {
      mockExecuteAction.mockResolvedValue({ status: 'SUCCESS' })
      const customizationInfo = {
        typeName: 'typeName',
        values: {
          key: 'val',
        },
      }
      const filename = 'filename'
      await client.deployCustomObject(filename, customizationInfo)
      expect(writeFileMock).toHaveBeenCalledTimes(1)
      expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining(`${filename}.xml`),
        '<typeName><key>val</key></typeName>')
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, addDependenciesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, deployProjectCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(saveTokenCommandMatcher)
    })

    it('should succeed for customizationInfo with additionalFile', async () => {
      mockExecuteAction.mockResolvedValue({ status: 'SUCCESS' })
      const filename = 'filename'
      const customizationInfo = {
        typeName: 'typeName',
        values: {
          key: 'val',
        },
        additionalFileContent: MOCK_TEMPLATE_CONTENT,
        additionalFileExtension: 'html',
      }
      await client.deployCustomObject(filename, customizationInfo)
      expect(writeFileMock).toHaveBeenCalledTimes(2)
      expect(writeFileMock)
        .toHaveBeenCalledWith(expect.stringContaining(`${filename}.xml`), '<typeName><key>val</key></typeName>')
      expect(writeFileMock)
        .toHaveBeenCalledWith(expect.stringContaining(`${filename}.template.html`), MOCK_TEMPLATE_CONTENT)
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
      await expect(client.deployCustomObject('elementName', {} as CustomizationInfo)).rejects
        .toThrow(new Error(errorMessage))
    })

    it('should throw Error object', async () => {
      const errorMessage = 'error message'
      mockExecuteAction.mockImplementation(() => {
        throw new Error(errorMessage)
      })
      await expect(client.deployCustomObject('elementName', {} as CustomizationInfo)).rejects
        .toThrow(new Error(errorMessage))
    })
  })

  describe('setSdfLogLevel', () => {
    it('should set SDF_VERBOSE_LOG env variable to true', () => {
      logger.configure({ minLevel: 'debug' })
      mockClient()
      expect(process.env.IS_SDF_VERBOSE).toEqual('true')
    })

    it('should set SDF_VERBOSE_LOG env variable to false when salto log is none', () => {
      logger.configure({ minLevel: 'none' })
      mockClient()
      expect(process.env.IS_SDF_VERBOSE).toEqual('false')
    })

    it('should set SDF_VERBOSE_LOG env variable to false when salto log is lower than debug', () => {
      logger.configure({ minLevel: 'warn' })
      mockClient()
      expect(process.env.IS_SDF_VERBOSE).toEqual('false')
    })
  })
})
