/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { buildNetsuiteQuery, notQuery } from '../../src/query'
import mockClient, { DUMMY_CREDENTIALS } from './sdf_client'
import {
  FILE_CABINET_PATH_SEPARATOR,
} from '../../src/constants'
import SdfClient, { ATTRIBUTES_FILE_SUFFIX, ATTRIBUTES_FOLDER_NAME, COMMANDS, FOLDER_ATTRIBUTES_FILE_SUFFIX } from '../../src/client/sdf_client'
import { CustomTypeInfo, FileCustomizationInfo, FolderCustomizationInfo, TemplateCustomTypeInfo } from '../../src/client/types'
import { fileCabinetTopLevelFolders } from '../../src/client/constants'


const MOCK_TEMPLATE_CONTENT = Buffer.from('Template Inner Content')
const MOCK_FILE_PATH = `${osPath.sep}Templates${osPath.sep}E-mail Templates${osPath.sep}InnerFolder${osPath.sep}content.html`
const MOCK_FILE_ATTRS_PATH = `${osPath.sep}Templates${osPath.sep}E-mail Templates${osPath.sep}InnerFolder${osPath.sep}${ATTRIBUTES_FOLDER_NAME}${osPath.sep}content.html${ATTRIBUTES_FILE_SUFFIX}`
const MOCK_FOLDER_ATTRS_PATH = `${osPath.sep}Templates${osPath.sep}E-mail Templates${osPath.sep}InnerFolder${osPath.sep}${ATTRIBUTES_FOLDER_NAME}${osPath.sep}${FOLDER_ATTRIBUTES_FILE_SUFFIX}`

const MOCK_MANIFEST_INVALID_DEPENDENCIES = `<manifest projecttype="ACCOUNTCUSTOMIZATION">
<projectname>TempSdfProject-56067b34-18db-4372-a35b-e2ed2c3aaeb3</projectname>
<frameworkversion>1.0</frameworkversion>
<dependencies>
  <features>
    <feature required="true">ADVANCEDEXPENSEMANAGEMENT</feature>
    <feature required="true">SFA</feature>
    <feature required="true">MULTICURRENCYVENDOR</feature>
    <feature required="true">ACCOUNTING</feature>
    <feature required="true">SUBSCRIPTIONBILLING</feature>
    <feature required="true">ADDRESSCUSTOMIZATION</feature>
    <feature required="true">WMSSYSTEM</feature>
    <feature required="true">SUBSIDIARIES</feature>
    <feature required="true">RECEIVABLES</feature>
    <feature required="true">BILLINGACCOUNTS</feature>
  </features>
  <objects>
    <object>custentity2edited</object>
    <object>custentity13</object>
    <object>custentity_14</object>
    <object>custentity10</object>
    <object>custentitycust_active</object>
    <object>custentity11</object>
    <object>custentity_slt_tax_reg</object>
  </objects>
  <files>
    <file>/SuiteScripts/clientScript_2_0.js</file>
  </files>
</dependencies>
</manifest>`

const MOCK_MANIFEST_VALID_DEPENDENCIES = `<manifest projecttype="ACCOUNTCUSTOMIZATION">
<projectname>TempSdfProject-56067b34-18db-4372-a35b-e2ed2c3aaeb3</projectname>
<frameworkversion>1.0</frameworkversion>
<dependencies>
  <features>
    <feature required="true">SFA</feature>
    <feature required="true">MULTICURRENCYVENDOR</feature>
    <feature required="true">ACCOUNTING</feature>
    <feature required="true">ADDRESSCUSTOMIZATION</feature>
    <feature required="true">SUBSIDIARIES</feature>
    <feature required="true">RECEIVABLES</feature>
  </features>
  <objects>
    <object>custentity2edited</object>
    <object>custentity13</object>
    <object>custentity_14</object>
    <object>custentity10</object>
    <object>custentitycust_active</object>
    <object>custentity11</object>
    <object>custentity_slt_tax_reg</object>
  </objects>
  <files>
    <file>/SuiteScripts/clientScript_2_0.js</file>
  </files>
</dependencies>
</manifest>`

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

    if (filePath.endsWith('manifest.xml')) {
      return MOCK_MANIFEST_INVALID_DEPENDENCIES
    }
    return `<addressForm filename="${filePath.split('/').pop()}">`
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
  ...jest.requireActual<{}>('@salto-io/lowerdash'),
  hash: {
    toMD5: jest.fn().mockImplementation(input => input),
  },
}))

const mockExecuteAction = jest.fn()

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
}))

describe('netsuite client', () => {
  const createProjectCommandMatcher = expect
    .objectContaining({ commandName: COMMANDS.CREATE_PROJECT })
  const saveTokenCommandMatcher = expect.objectContaining({
    commandName: COMMANDS.SETUP_ACCOUNT,
    arguments: expect.objectContaining({
      account: DUMMY_CREDENTIALS.accountId,
      tokenid: DUMMY_CREDENTIALS.tokenId,
      tokensecret: DUMMY_CREDENTIALS.tokenSecret,
      authid: expect.anything(),
      savetoken: true,
    }),
  })

  const instancesIds = [
    { type: 'addressForm', scriptId: 'IdA' },
    { type: 'advancedpdftemplate', scriptId: 'IdB' },
  ]

  const typeNames = instancesIds.map(instance => instance.type)

  const typeNamesQuery = buildNetsuiteQuery({
    types: Object.fromEntries(instancesIds.map(id => [id.type, ['.*']])),
  })

  const importObjectsCommandMatcher = expect
    .objectContaining({ commandName: COMMANDS.IMPORT_OBJECTS })
  const listObjectsCommandMatcher = expect
    .objectContaining({ commandName: COMMANDS.LIST_OBJECTS })
  const listFilesCommandMatcher = expect
    .objectContaining({ commandName: COMMANDS.LIST_FILES })
  const importFilesCommandMatcher = expect
    .objectContaining({ commandName: COMMANDS.IMPORT_FILES })
  const addDependenciesCommandMatcher = expect
    .objectContaining({ commandName: COMMANDS.ADD_PROJECT_DEPENDENCIES })
  const deployProjectCommandMatcher = expect
    .objectContaining({ commandName: COMMANDS.DEPLOY_PROJECT })
  const deleteAuthIdCommandMatcher = expect.objectContaining({
    commandName: COMMANDS.MANAGE_AUTH,
    arguments: expect.objectContaining({
      remove: expect.anything(),
    }),
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('validateCredentials', () => {
    it('should fail when SETUP_ACCOUNT has failed', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.SETUP_ACCOUNT) {
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
      const accountId = await SdfClient.validateCredentials(DUMMY_CREDENTIALS)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
      expect(accountId).toEqual(DUMMY_CREDENTIALS.accountId)
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
      await expect(mockClient().getCustomObjects(typeNames, typeNamesQuery)).rejects.toThrow()
      expect(mockExecuteAction).toHaveBeenCalledWith(createProjectCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(saveTokenCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(importObjectsCommandMatcher)
    })

    it('should fail when SETUP_ACCOUNT has failed', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.SETUP_ACCOUNT) {
          return Promise.resolve({ isSuccess: () => false })
        }
        return Promise.resolve({ isSuccess: () => true })
      })
      await expect(mockClient().getCustomObjects(typeNames, typeNamesQuery)).rejects.toThrow()
      expect(mockExecuteAction).toHaveBeenCalledWith(createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenCalledWith(saveTokenCommandMatcher)
      expect(mockExecuteAction).not.toHaveBeenCalledWith(importObjectsCommandMatcher)
    })

    it('should retry to authenticate when SETUP_ACCOUNT has failed', async () => {
      let isFirstSetupTry = true
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.SETUP_ACCOUNT && isFirstSetupTry) {
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

      await mockClient().getCustomObjects(typeNames, typeNamesQuery)
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
      const getCustomObjectsResult = await client.getCustomObjects(typeNames, typeNamesQuery)
      expect(mockExecuteAction).toHaveBeenCalledTimes(7)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, importObjectsCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, listObjectsCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(5, importObjectsCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(6, importObjectsCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(7, deleteAuthIdCommandMatcher)
      expect(getCustomObjectsResult.failedToFetchAllAtOnce).toEqual(true)
      expect(getCustomObjectsResult.failedTypeToInstances).toEqual({})
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
      await expect(client.getCustomObjects(typeNames, typeNamesQuery)).rejects.toThrow()
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
      await client.getCustomObjects(typeNames, typeNamesQuery)
      // createProject & setupAccount & listObjects & 3*importObjects & deleteAuthId
      const numberOfExecuteActions = 7
      expect(mockExecuteAction).toHaveBeenCalledTimes(numberOfExecuteActions)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, listObjectsCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, importObjectsCommandMatcher)
      expect(mockExecuteAction.mock.calls[3][0].arguments).toEqual(expect.objectContaining({
        type: 'addressForm',
        scriptid: 'a b',
      }))

      expect(mockExecuteAction).toHaveBeenNthCalledWith(5, importObjectsCommandMatcher)
      expect(mockExecuteAction.mock.calls[4][0].arguments).toEqual(expect.objectContaining({
        type: 'addressForm',
        scriptid: 'a',
      }))

      expect(mockExecuteAction).toHaveBeenNthCalledWith(6, importObjectsCommandMatcher)
      expect(mockExecuteAction.mock.calls[5][0].arguments).toEqual(expect.objectContaining({
        type: 'addressForm',
        scriptid: 'b',
      }))

      expect(mockExecuteAction)
        .toHaveBeenNthCalledWith(numberOfExecuteActions, deleteAuthIdCommandMatcher)
    })

    it('should retry chunks with size 1 when IMPORT_OBJECTS has failed', async () => {
      const ids = [
        { type: 'addressForm', scriptId: 'a' },
      ]
      let isFirstImportTry = true
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.LIST_OBJECTS) {
          return Promise.resolve({
            isSuccess: () => true,
            data: ids,
          })
        }
        if (context.commandName === COMMANDS.IMPORT_OBJECTS) {
          if (isFirstImportTry) {
            isFirstImportTry = false
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
      await client.getCustomObjects(typeNames, typeNamesQuery)
      // createProject & setupAccount & listObjects & 2*importObjects & deleteAuthId
      const numberOfExecuteActions = 6
      expect(mockExecuteAction).toHaveBeenCalledTimes(numberOfExecuteActions)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, listObjectsCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, importObjectsCommandMatcher)
      expect(mockExecuteAction.mock.calls[3][0].arguments).toEqual(expect.objectContaining({
        type: 'addressForm',
        scriptid: 'a',
      }))

      expect(mockExecuteAction).toHaveBeenNthCalledWith(5, importObjectsCommandMatcher)
      expect(mockExecuteAction.mock.calls[4][0].arguments).toEqual(expect.objectContaining({
        type: 'addressForm',
        scriptid: 'a',
      }))

      expect(mockExecuteAction)
        .toHaveBeenNthCalledWith(numberOfExecuteActions, deleteAuthIdCommandMatcher)
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
      await client.getCustomObjects(typeNames, typeNamesQuery)
      // createProject & setupAccount & listObjects & 3*importObjects & deleteAuthId
      const numberOfExecuteActions = 7
      expect(mockExecuteAction).toHaveBeenCalledTimes(numberOfExecuteActions)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, listObjectsCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, importObjectsCommandMatcher)
      expect(mockExecuteAction.mock.calls[3][0].arguments).toEqual(expect.objectContaining({
        type: 'addressForm',
        scriptid: 'a b',
      }))

      expect(mockExecuteAction).toHaveBeenNthCalledWith(5, importObjectsCommandMatcher)
      expect(mockExecuteAction.mock.calls[4][0].arguments).toEqual(expect.objectContaining({
        type: 'addressForm',
        scriptid: 'c',
      }))

      expect(mockExecuteAction).toHaveBeenNthCalledWith(6, importObjectsCommandMatcher)
      expect(mockExecuteAction.mock.calls[5][0].arguments).toEqual(expect.objectContaining({
        type: 'advancedpdftemplate',
        scriptid: 'd',
      }))

      expect(mockExecuteAction)
        .toHaveBeenNthCalledWith(numberOfExecuteActions, deleteAuthIdCommandMatcher)
    })

    it('should fail to import type when it exceeds the configured timeout', async () => {
      mockExecuteAction.mockResolvedValue({ isSuccess: () => true })
      mockExecuteAction.mockImplementation(async context => {
        if (context.commandName === COMMANDS.LIST_OBJECTS) {
          return Promise.resolve({
            isSuccess: () => true,
            data: instancesIds,
          })
        }
        if (context.commandName === COMMANDS.IMPORT_OBJECTS) {
          if (context.arguments.type === 'addressForm') {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
          return Promise.resolve({
            isSuccess: () => true,
            data: { failedImports: [] },
          })
        }
        return Promise.resolve({ isSuccess: () => true })
      })
      const client = mockClient({ fetchAllTypesAtOnce: false, fetchTypeTimeoutInMinutes: 0.001 })
      await expect(client.getCustomObjects(typeNames, typeNamesQuery)).rejects.toThrow()
    })

    it('should fail to import all types at once due to timeout and succeed type by type', async () => {
      mockExecuteAction.mockResolvedValue({ isSuccess: () => true })
      mockExecuteAction.mockImplementation(async context => {
        if (context.commandName === COMMANDS.IMPORT_OBJECTS) {
          if (context.arguments.scriptid === 'ALL') {
            await new Promise(resolve => setTimeout(resolve, 100))
          } else {
            await new Promise(resolve => setTimeout(resolve, 1))
          }
          return Promise.resolve({
            isSuccess: () => true,
            data: { failedImports: [] },
          })
        }
        if (context.commandName === COMMANDS.LIST_OBJECTS) {
          return Promise.resolve({ isSuccess: () => true, data: [{ scriptId: 'id', type: 'type' }] })
        }
        return Promise.resolve({ isSuccess: () => true })
      })
      const client = mockClient({ fetchAllTypesAtOnce: true, fetchTypeTimeoutInMinutes: 0.0001 })
      const query = buildNetsuiteQuery({
        types: {
          addressForm: ['.*'],
        },
      })
      const getCustomObjectsResult = await client.getCustomObjects(typeNames, query)
      expect(getCustomObjectsResult.failedToFetchAllAtOnce).toEqual(true)
      expect(getCustomObjectsResult.failedTypeToInstances).toEqual({})
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
        failedTypeToInstances,
      } = await mockClient().getCustomObjects(typeNames, typeNamesQuery)
      expect(failedToFetchAllAtOnce).toBe(false)
      expect(failedTypeToInstances).toEqual({})
      expect(readDirMock).toHaveBeenCalledTimes(1)
      expect(readFileMock).toHaveBeenCalledTimes(3)
      expect(rmMock).toHaveBeenCalledTimes(1)
      expect(customizationInfos).toHaveLength(2)
      expect(customizationInfos).toEqual([{
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
      }])

      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, listObjectsCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, importObjectsCommandMatcher)
    })

    it('should succeed and return failedTypeToInstances', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.LIST_OBJECTS) {
          return Promise.resolve({
            isSuccess: () => true,
            data: [
              { type: 'addressForm', scriptId: 'a' },
              { type: 'addressForm', scriptId: 'b' },
              { type: 'addressForm', scriptId: 'c' },
              { type: 'addressForm', scriptId: 'd' },
              { type: 'advancedpdftemplate', scriptId: 'a' },
            ],
          })
        }
        if (context.commandName === COMMANDS.IMPORT_OBJECTS) {
          if (context.arguments.type === 'addressForm') {
            return Promise.resolve({
              isSuccess: () => true,
              data: {
                failedImports: [
                  {
                    customObject: {
                      id: 'b',
                      type: 'addressForm',
                      result: {
                        code: 'FAILED',
                        message: 'An unexpected error has occurred',
                      },
                    },
                  },
                  {
                    customObject: {
                      id: 'c',
                      type: 'addressForm',
                      result: {
                        code: 'FAILED',
                        message: 'An unexpected error has occurred',
                      },
                    },
                  },
                  {
                    customObject: {
                      id: 'd',
                      type: 'addressForm',
                      result: {
                        code: 'FAILED',
                        message: 'You cannot download the XML file for this object because it is locked.',
                      },
                    },
                  },
                ],
              },
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

      const {
        failedTypeToInstances,
      } = await mockClient().getCustomObjects(typeNames, typeNamesQuery)
      expect(failedTypeToInstances).toEqual({
        addressForm: ['b', 'c'],
        advancedpdftemplate: ['a'],
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
                failedImports: [{
                  customObject: {
                    id: context.arguments.scriptid,
                    type: 'addressForm',
                    result: {
                      code: 'FAILED',
                      message: 'An unexpected error has occurred',
                    },
                  },
                }],
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

      const {
        failedTypeToInstances,
      } = await mockClient().getCustomObjects(typeNames, typeNamesQuery)
      expect(failedTypeToInstances).toEqual({
        addressForm: ['a', 'b'],
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
        types: {
          addressForm: ['a'],
        },
      })
      await mockClient().getCustomObjects(typeNames, query)
      expect(mockExecuteAction).toHaveBeenCalledWith(expect.objectContaining({
        commandName: COMMANDS.LIST_OBJECTS,
        arguments: {
          type: 'addressForm',
        },
      }))

      expect(mockExecuteAction).toHaveBeenCalledWith(expect.objectContaining({
        commandName: COMMANDS.IMPORT_OBJECTS,
        arguments: expect.objectContaining({
          type: 'addressForm',
          scriptid: 'a',
        }),
      }))

      expect(mockExecuteAction).not.toHaveBeenCalledWith(expect.objectContaining({
        commandName: COMMANDS.IMPORT_OBJECTS,
        arguments: expect.objectContaining({
          type: 'addressForm',
          scriptid: 'b',
        }),
      }))
    })

    it('should do nothing of no files are matched', async () => {
      const { elements, failedToFetchAllAtOnce } = await mockClient()
        .getCustomObjects(typeNames, buildNetsuiteQuery({
          types: {},
        }))
      expect(elements).toHaveLength(0)
      expect(failedToFetchAllAtOnce).toBeFalsy()
      expect(mockExecuteAction).not.toHaveBeenCalledWith()
    })
  })

  describe('importFileCabinetContent', () => {
    const allFilesQuery = buildNetsuiteQuery({
      filePaths: ['.*'],
    })

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
      await expect(client.importFileCabinetContent(allFilesQuery)).rejects.toThrow()
      expect(rmMock).toHaveBeenCalledTimes(0)
    })

    it('should return failed paths when LIST_FILES has failed', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.LIST_FILES) {
          return Promise.resolve({ isSuccess: () => false })
        }
        return Promise.resolve({ isSuccess: () => true })
      })
      const { elements, failedPaths } = await client.importFileCabinetContent(allFilesQuery)
      expect(elements).toHaveLength(0)
      expect(failedPaths).toEqual(fileCabinetTopLevelFolders)
    })

    it('should fail when SETUP_ACCOUNT has failed', async () => {
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.SETUP_ACCOUNT) {
          return Promise.resolve({ isSuccess: () => false })
        }
        return Promise.resolve({ isSuccess: () => true })
      })
      await expect(client.importFileCabinetContent(allFilesQuery)).rejects.toThrow()
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
      const { elements, failedPaths } = await client.importFileCabinetContent(allFilesQuery)
      expect(mockExecuteAction).toHaveBeenCalledTimes(6)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(5, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(6, deleteAuthIdCommandMatcher)
      expect(elements).toHaveLength(0)
      expect(failedPaths).toHaveLength(0)
    })

    it('should fail to importFiles when failing to import a certain file', async () => {
      const failedPath = 'error'
      const filesPathResult = [
        MOCK_FILE_PATH,
        failedPath,
      ]
      mockExecuteAction.mockImplementation(context => {
        if (context.commandName === COMMANDS.LIST_FILES
          && context.arguments.folder === `${FILE_CABINET_PATH_SEPARATOR}Templates`) {
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
      await expect(client.importFileCabinetContent(allFilesQuery)).rejects.toThrow()
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
        const filesPathResult = [
          MOCK_FILE_PATH,
        ]
        if (context.commandName === COMMANDS.LIST_FILES
          && context.arguments.folder === `${FILE_CABINET_PATH_SEPARATOR}Templates`) {
          return Promise.resolve({
            isSuccess: () => true,
            data: filesPathResult,
          })
        }
        if (context.commandName === COMMANDS.IMPORT_FILES
          && _.isEqual(context.arguments.paths, filesPathResult)) {
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
      const { elements, failedPaths } = await client.importFileCabinetContent(allFilesQuery)
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
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(5, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(6, importFilesCommandMatcher)
    })

    it('should filter out paths that do not match the query', async () => {
      mockExecuteAction.mockImplementation(context => {
        const filesPathResult = [
          MOCK_FILE_PATH,
        ]
        if (context.commandName === COMMANDS.LIST_FILES
          && context.arguments.folder === `${FILE_CABINET_PATH_SEPARATOR}Templates`) {
          return Promise.resolve({
            isSuccess: () => true,
            data: filesPathResult,
          })
        }
        return Promise.resolve({ isSuccess: () => true })
      })
      const query = notQuery(buildNetsuiteQuery({
        filePaths: [MOCK_FILE_PATH],
      }))
      const { elements, failedPaths } = await client.importFileCabinetContent(query)
      expect(readFileMock).toHaveBeenCalledTimes(0)
      expect(elements).toHaveLength(0)
      expect(failedPaths).toHaveLength(0)
      expect(mockExecuteAction).toHaveBeenCalledTimes(6)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(5, listFilesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(6, deleteAuthIdCommandMatcher)
    })

    it('should do nothing of no files are matched', async () => {
      const { elements, failedPaths } = await client.importFileCabinetContent(buildNetsuiteQuery({
        filePaths: [],
      }))

      expect(elements).toHaveLength(0)
      expect(failedPaths).toHaveLength(0)
      expect(mockExecuteAction).not.toHaveBeenCalled()
    })

    it('should return only loaded files', async () => {
      mockExecuteAction.mockImplementation(context => {
        const filesPathResult = [
          MOCK_FILE_PATH,
        ]
        if (context.commandName === COMMANDS.LIST_FILES
          && context.arguments.folder === `${FILE_CABINET_PATH_SEPARATOR}Templates`) {
          return Promise.resolve({
            isSuccess: () => true,
            data: filesPathResult,
          })
        }
        if (context.commandName === COMMANDS.IMPORT_FILES
          && _.isEqual(context.arguments.paths, filesPathResult)) {
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
      const { elements, failedPaths } = await client.importFileCabinetContent(allFilesQuery)
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
    let client: SdfClient
    beforeEach(() => {
      client = mockClient()
    })

    describe('deployCustomObject', () => {
      it('should succeed for CustomTypeInfo', async () => {
        mockExecuteAction.mockResolvedValue({ isSuccess: () => true })
        const scriptId = 'filename'
        const customTypeInfo = {
          typeName: 'typeName',
          values: {
            key: 'val',
          },
          scriptId,
        } as CustomTypeInfo
        await client.deploy([customTypeInfo])
        expect(writeFileMock).toHaveBeenCalledTimes(2)
        expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining(`${scriptId}.xml`),
          '<typeName><key>val</key></typeName>')
        expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining('manifest.xml'), MOCK_MANIFEST_VALID_DEPENDENCIES)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(3, addDependenciesCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(4, deployProjectCommandMatcher)
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
        await client.deploy([templateCustomTypeInfo])
        expect(writeFileMock).toHaveBeenCalledTimes(3)
        expect(writeFileMock)
          .toHaveBeenCalledWith(expect.stringContaining(`${scriptId}.xml`), '<typeName><key>val</key></typeName>')
        expect(writeFileMock)
          .toHaveBeenCalledWith(expect.stringContaining(`${scriptId}.template.html`), MOCK_TEMPLATE_CONTENT)
        expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining('manifest.xml'), MOCK_MANIFEST_VALID_DEPENDENCIES)
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
        mockExecuteAction.mockResolvedValue({ isSuccess: () => true })
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
        expect(writeFileMock).toHaveBeenCalledTimes(2)
        expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining(MOCK_FOLDER_ATTRS_PATH),
          '<folder><description>folder description</description></folder>')
        expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining('manifest.xml'), MOCK_MANIFEST_VALID_DEPENDENCIES)
        expect(rmMock).toHaveBeenCalledTimes(1)
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
        await client.deploy([fileCustomizationInfo])
        expect(mkdirpMock).toHaveBeenCalledTimes(2)
        expect(mkdirpMock)
          .toHaveBeenCalledWith(expect.stringContaining(`${osPath.sep}Templates${osPath.sep}E-mail Templates${osPath.sep}InnerFolder${osPath.sep}`))
        expect(mkdirpMock)
          .toHaveBeenCalledWith(expect.stringContaining(`${osPath.sep}Templates${osPath.sep}E-mail Templates${osPath.sep}InnerFolder${osPath.sep}${ATTRIBUTES_FOLDER_NAME}`))
        expect(writeFileMock).toHaveBeenCalledTimes(3)
        expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining(MOCK_FILE_ATTRS_PATH),
          '<file><description>file description</description></file>')
        expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining(MOCK_FILE_PATH),
          dummyFileContent)
        expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining('manifest.xml'), MOCK_MANIFEST_VALID_DEPENDENCIES)
        expect(rmMock).toHaveBeenCalledTimes(1)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(3, addDependenciesCommandMatcher)
        expect(mockExecuteAction).toHaveBeenNthCalledWith(4, deployProjectCommandMatcher)
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
      await client.deploy([customTypeInfo1, customTypeInfo2])
      expect(writeFileMock).toHaveBeenCalledTimes(3)
      expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining(`${scriptId1}.xml`),
        '<typeName><key>val</key></typeName>')
      expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining(`${scriptId2}.xml`),
        '<typeName><key>val</key></typeName>')
      expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining('manifest.xml'), MOCK_MANIFEST_VALID_DEPENDENCIES)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(1, createProjectCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(2, saveTokenCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(3, addDependenciesCommandMatcher)
      expect(mockExecuteAction).toHaveBeenNthCalledWith(4, deployProjectCommandMatcher)
    })
  })
})
