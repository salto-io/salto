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
import mockClient, { DUMMY_CREDENTIALS } from './client'
import * as file from '../../src/client/file'
import NetsuiteClient, { COMMANDS } from '../../src/client/client'

const { readFile, readDir, writeFile } = file


jest.mock('../../src/client/file', () => ({
  readDir: jest.fn().mockImplementation(() => ['a.xml', 'b.xml', 'c.html']),
  readFile: jest.fn().mockImplementation(filePath => `<elementName filePath="${filePath}">`),
  writeFile: jest.fn(),
}))
const readFileMock = readFile as jest.Mock
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


  let client: NetsuiteClient
  beforeEach(() => {
    jest.clearAllMocks()
    client = mockClient()
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
      await NetsuiteClient.validateCredentials(DUMMY_CREDENTIALS)
      expect(mockExecuteAction).toHaveBeenCalledWith(createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(saveTokenCommandMatcher)
    })

    it('should succeed', async () => {
      mockExecuteAction.mockResolvedValue({ status: 'SUCCESS' })
      await NetsuiteClient.validateCredentials(DUMMY_CREDENTIALS)
      expect(mockExecuteAction).toHaveBeenCalledWith(createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(saveTokenCommandMatcher)
    })
  })

  describe('listCustomObjects', () => {
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
      const xmlElements = await client.listCustomObjects()
      expect(readDirMock).toHaveBeenCalledTimes(1)
      expect(readFileMock).toHaveBeenCalledTimes(2)
      expect(xmlElements).toHaveLength(2)
      expect(mockExecuteAction).toHaveBeenCalledWith(createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(importObjectsCommandMatcher)
    })

    it('should succeed', async () => {
      mockExecuteAction.mockResolvedValue({ status: 'SUCCESS' })
      const xmlElements = await client.listCustomObjects()
      expect(readDirMock).toHaveBeenCalledTimes(1)
      expect(readFileMock).toHaveBeenCalledTimes(2)
      expect(xmlElements).toHaveLength(2)
      expect(mockExecuteAction).toHaveBeenCalledWith(createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(importObjectsCommandMatcher)
    })
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
      await client.deployCustomObject('elementName', {})
      expect(writeFileMock).toHaveBeenCalledTimes(1)
      expect(mockExecuteAction).toHaveBeenCalledWith(createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(addDependenciesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(deployProjectCommandMatcher)
    })

    it('should succeed', async () => {
      mockExecuteAction.mockResolvedValue({ status: 'SUCCESS' })
      await client.deployCustomObject('elementName', {})
      expect(writeFileMock).toHaveBeenCalledTimes(1)
      expect(mockExecuteAction).toHaveBeenCalledWith(createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(reuseAuthIdCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(addDependenciesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(deployProjectCommandMatcher)
    })
  })
})
