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
import type {
  AuthenticationService as AuthenticationServiceType,
  CommandsMetadataService as CommandsMetadataServiceType,
  CommandActionExecutor as CommandActionExecutorType,
  CommandInstanceFactory as CommandInstanceFactoryType,
  CLIConfigurationService as CLIConfigurationServiceType,
  CommandOptionsValidator as CommandOptionsValidatorType,
  CommandOutputHandler as CommandOutputHandlerType,
  SDKOperationResultUtils as SDKOperationResultUtilsType,
  OperationResult,
} from '@salto-io/suitecloud-cli'

import { collections, decorators, hash } from '@salto-io/lowerdash'
import { Values, AccountId } from '@salto-io/adapter-api'
import { mkdirp, readDir, readFile, writeFile } from '@salto-io/file'
import { logger } from '@salto-io/logging'
import xmlParser from 'fast-xml-parser'
import he from 'he'
import osPath from 'path'
import os from 'os'
import _ from 'lodash'
import { getRootCLIPath } from './sdf_root_cli_path'
import {
  SUITE_SCRIPTS_FOLDER_NAME, TEMPLATES_FOLDER_NAME, WEB_SITE_HOSTING_FILES_FOLDER_NAME, FILE,
  FOLDER,
} from '../constants'

const { makeArray } = collections.array
const log = logger(module)

let AuthenticationService: typeof AuthenticationServiceType
let CommandsMetadataService: typeof CommandsMetadataServiceType
let CommandActionExecutor: typeof CommandActionExecutorType
let CommandInstanceFactory: typeof CommandInstanceFactoryType
let CLIConfigurationService: typeof CLIConfigurationServiceType
let CommandOptionsValidator: typeof CommandOptionsValidatorType
let CommandOutputHandler: typeof CommandOutputHandlerType
let SDKOperationResultUtils: typeof SDKOperationResultUtilsType

try {
  // eslint-disable-next-line max-len
  // eslint-disable-next-line import/no-extraneous-dependencies,@typescript-eslint/no-var-requires,global-require
  const module = require('@salto-io/suitecloud-cli')
  AuthenticationService = module.AuthenticationService
  CommandsMetadataService = module.CommandsMetadataService
  CommandActionExecutor = module.CommandActionExecutor
  CommandInstanceFactory = module.CommandInstanceFactory
  CLIConfigurationService = module.CLIConfigurationService
  CommandOptionsValidator = module.CommandOptionsValidator
  CommandOutputHandler = module.CommandOutputHandler
  SDKOperationResultUtils = module.SDKOperationResultUtils
} catch (e) {
  // TODO: this is a temp solution as we can't distribute salto with suitecloud-cli
  log.debug('Failed to load Netsuite adapter as @salto-io/suitecloud-cli dependency is missing')
  log.debug('If you want to use Netsuite adapter follow the instructions in the README file')
}

export type Credentials = {
  accountId: string
  tokenId: string
  tokenSecret: string
}

export type NetsuiteClientOpts = {
  credentials: Credentials
}

export const COMMANDS = {
  CREATE_PROJECT: 'project:create',
  SETUP_ACCOUNT: 'account:setup',
  IMPORT_OBJECTS: 'object:import',
  LIST_FILES: 'file:list',
  IMPORT_FILES: 'file:import',
  DEPLOY_PROJECT: 'project:deploy',
  ADD_PROJECT_DEPENDENCIES: 'project:adddependencies',
}

export const ATTRIBUTE_PREFIX = '@_'
export const CDATA_TAG_NAME = '__cdata'

export const ATTRIBUTES_FOLDER_NAME = '.attributes'
export const ATTRIBUTES_FILE_SUFFIX = '.attr.xml'
export const FOLDER_ATTRIBUTES_FILE_SUFFIX = '.folder.attr.xml'
const FILE_CABINET_DIR = 'FileCabinet'
const OBJECTS_DIR = 'Objects'
const SRC_DIR = 'src'
const FILE_SEPARATOR = '.'
const ALL = 'ALL'
const ADDITIONAL_FILE_PATTERN = '.template.'
export const SDF_PATH_SEPARATOR = '/'

const baseExecutionPath = os.tmpdir()

export interface CustomizationInfo {
  typeName: string
  values: Values
}

export interface CustomTypeInfo extends CustomizationInfo {
  scriptId: string
}

export interface TemplateCustomTypeInfo extends CustomTypeInfo {
  fileExtension: string
  fileContent: string
}

export interface FileCustomizationInfo extends CustomizationInfo {
  path: string[]
  fileContent: string
}

export interface FolderCustomizationInfo extends CustomizationInfo {
  path: string[]
}

export const convertToCustomizationInfo = (xmlContent: string):
  CustomizationInfo => {
  const parsedXmlValues = xmlParser.parse(xmlContent, {
    attributeNamePrefix: ATTRIBUTE_PREFIX,
    ignoreAttributes: false,
    tagValueProcessor: val => he.decode(val),
  })
  const typeName = Object.keys(parsedXmlValues)[0]
  return { typeName, values: parsedXmlValues[typeName] }
}

export const convertToCustomTypeInfo = (xmlContent: string, scriptId: string): CustomTypeInfo =>
  Object.assign(
    convertToCustomizationInfo(xmlContent),
    { scriptId }
  )

export const convertToTemplateCustomTypeInfo = (xmlContent: string, scriptId: string,
  fileExtension: string, fileContent: string): TemplateCustomTypeInfo =>
  Object.assign(
    convertToCustomizationInfo(xmlContent),
    { fileExtension, fileContent, scriptId }
  )

export const convertToFileCustomizationInfo = (xmlContent: string, path: string[],
  fileContent: string): FileCustomizationInfo =>
  Object.assign(
    convertToCustomizationInfo(xmlContent),
    { path, fileContent }
  )

export const convertToFolderCustomizationInfo = (xmlContent: string, path: string[]):
  FolderCustomizationInfo =>
  Object.assign(
    convertToCustomizationInfo(xmlContent),
    { path }
  )

export const isCustomTypeInfo = (customizationInfo: CustomizationInfo):
  customizationInfo is CustomTypeInfo => 'scriptId' in customizationInfo

export const isTemplateCustomTypeInfo = (customizationInfo: CustomizationInfo):
  customizationInfo is TemplateCustomTypeInfo =>
  'fileExtension' in customizationInfo && isCustomTypeInfo(customizationInfo)

export const isFileCustomizationInfo = (customizationInfo: CustomizationInfo):
  customizationInfo is FileCustomizationInfo =>
  customizationInfo.typeName === FILE

export const isFolderCustomizationInfo = (customizationInfo: CustomizationInfo):
  customizationInfo is FolderCustomizationInfo =>
  customizationInfo.typeName === FOLDER

export const convertToXmlContent = (customizationInfo: CustomizationInfo): string =>
  // eslint-disable-next-line new-cap
  new xmlParser.j2xParser({
    attributeNamePrefix: ATTRIBUTE_PREFIX,
    // We convert to an not formatted xml since the CDATA transformation is wrong when having format
    format: false,
    ignoreAttributes: false,
    cdataTagName: CDATA_TAG_NAME,
  }).parse({ [customizationInfo.typeName]: customizationInfo.values })

const writeFileInFolder = async (folderPath: string, filename: string, content: string):
  Promise<void> => {
  await mkdirp(folderPath)
  osPath.resolve(folderPath, filename)
  await writeFile(osPath.resolve(folderPath, filename), content)
}

type Project = {
  projectName: string
  executor: CommandActionExecutorType
}

export type GetCustomObjectsResult = {
  elements: CustomTypeInfo[]
  failedTypes: string[]
  failedToFetchAllAtOnce: boolean
}

export default class NetsuiteClient {
  private readonly credentials: Credentials
  private readonly authId: string

  constructor({ credentials }: NetsuiteClientOpts) {
    this.credentials = {
      ...credentials,
      // accountId must be uppercased as decribed in https://github.com/oracle/netsuite-suitecloud-sdk/issues/140
      accountId: credentials.accountId.toUpperCase(),
    }
    this.authId = hash
      .toMD5(this.credentials.accountId + this.credentials.tokenId + this.credentials.tokenSecret)
  }

  static async validateCredentials(credentials: Credentials): Promise<AccountId> {
    const netsuiteClient = new NetsuiteClient({ credentials })
    await netsuiteClient.initProject()
    return Promise.resolve(netsuiteClient.credentials.accountId)
  }

  private static initCommandActionExecutor(executionPath: string): CommandActionExecutorType {
    const commandsMetadataService = new CommandsMetadataService(getRootCLIPath())
    commandsMetadataService.initializeCommandsMetadata()
    return new CommandActionExecutor({
      executionPath,
      commandOutputHandler: new CommandOutputHandler(),
      commandOptionsValidator: new CommandOptionsValidator(),
      cliConfigurationService: new CLIConfigurationService(),
      commandInstanceFactory: new CommandInstanceFactory(),
      authenticationService: new AuthenticationService(executionPath),
      commandsMetadataService,
    })
  }

  private static logDecorator = decorators.wrapMethodWith(
    async (
      { call, name }: decorators.OriginalCall,
    ): Promise<unknown> => {
      const desc = `client.${name}`
      try {
        return await log.time(call, desc)
      } catch (e) {
        log.error('failed to run Netsuite client command on: %o', e)
        throw _.isObject(e) ? e : new Error(String(e))
      }
    }
  )

  private static async createProject(): Promise<string> {
    const projectName = `TempProject${String(Date.now()).substring(8)}`
    const operationResult = await NetsuiteClient.initCommandActionExecutor(baseExecutionPath)
      .executeAction({
        commandName: COMMANDS.CREATE_PROJECT,
        runInInteractiveMode: false,
        arguments: {
          projectname: projectName,
          type: 'ACCOUNTCUSTOMIZATION',
          parentdirectory: getRootCLIPath(),
        },
      })
    NetsuiteClient.verifySuccessfulOperation(operationResult)
    return projectName
  }

  private static verifySuccessfulOperation(operationResult: OperationResult): void {
    if (SDKOperationResultUtils.hasErrors(operationResult)) {
      throw Error(SDKOperationResultUtils.getErrorMessagesString(operationResult))
    }
  }

  private static async executeProjectAction(commandName: string, commandArguments: Values,
    projectCommandActionExecutor: CommandActionExecutorType): Promise<OperationResult> {
    const operationResult = await projectCommandActionExecutor.executeAction({
      commandName,
      runInInteractiveMode: false,
      arguments: commandArguments,
    })
    NetsuiteClient.verifySuccessfulOperation(operationResult)
    return operationResult
  }

  protected async setupAccount(
    projectCommandActionExecutor: CommandActionExecutorType
  ): Promise<void> {
    // Todo: use the correct implementation and not Salto's temporary solution after:
    //  https://github.com/oracle/netsuite-suitecloud-sdk/issues/81 is resolved
    const setupAccountUsingExistingAuthID = async (): Promise<void> => {
      await NetsuiteClient.executeProjectAction(COMMANDS.SETUP_ACCOUNT, { authid: this.authId },
        projectCommandActionExecutor)
    }

    const setupAccountUsingNewAuthID = async (): Promise<void> => {
      await NetsuiteClient.executeProjectAction(COMMANDS.SETUP_ACCOUNT, {
        authid: this.authId,
        accountid: this.credentials.accountId,
        tokenid: this.credentials.tokenId,
        tokensecret: this.credentials.tokenSecret,
      }, projectCommandActionExecutor)
    }

    try {
      await setupAccountUsingExistingAuthID()
    } catch (e) {
      await setupAccountUsingNewAuthID()
    }
  }

  private async initProject(): Promise<Project> {
    const projectName = await NetsuiteClient.createProject()
    const executor = NetsuiteClient
      .initCommandActionExecutor(NetsuiteClient.getProjectPath(projectName))
    await this.setupAccount(executor)
    return { projectName, executor }
  }

  @NetsuiteClient.logDecorator
  async getCustomObjects(typeNames: string[], fetchAllAtOnce: boolean):
    Promise<GetCustomObjectsResult> {
    const { executor, projectName } = await this.initProject()
    const { failedToFetchAllAtOnce, failedTypes } = await NetsuiteClient.importObjects(typeNames,
      fetchAllAtOnce, executor)
    const objectsDirPath = NetsuiteClient.getObjectsDirPath(projectName)
    const filenames = await readDir(objectsDirPath)
    const scriptIdToFiles = _.groupBy(filenames, filename => filename.split(FILE_SEPARATOR)[0])
    const elements = await Promise.all(
      Object.entries(scriptIdToFiles).map(async ([scriptId, objectFileNames]) => {
        const [[additionalFilename], [contentFilename]] = _.partition(objectFileNames,
          filename => filename.includes(ADDITIONAL_FILE_PATTERN))
        const xmlContent = readFile(osPath.resolve(objectsDirPath, contentFilename))
        if (_.isUndefined(additionalFilename)) {
          return convertToCustomTypeInfo((await xmlContent).toString(), scriptId)
        }
        const additionalFileContent = readFile(osPath.resolve(objectsDirPath, additionalFilename))
        return convertToTemplateCustomTypeInfo((await xmlContent).toString(), scriptId,
          additionalFilename.split(FILE_SEPARATOR)[2], (await additionalFileContent).toString())
      })
    )
    return { elements, failedTypes, failedToFetchAllAtOnce }
  }

  private static async importObjects(typeNames: string[], fetchAllAtOnce: boolean,
    executor: CommandActionExecutorType):
    Promise<{ failedToFetchAllAtOnce: boolean; failedTypes: string[] }> {
    const importAllAtOnce = async (): Promise<boolean> => {
      log.debug('Fetching all custom objects at once')
      try {
        await NetsuiteClient.runImportObjectsCommand(ALL, executor)
        return true
      } catch (e) {
        log.warn(`Attempt to fetch all custom objects has failed due to: ${e}`)
        return false
      }
    }

    if (fetchAllAtOnce && await importAllAtOnce()) {
      return { failedToFetchAllAtOnce: false, failedTypes: [] }
    }
    return {
      failedToFetchAllAtOnce: fetchAllAtOnce,
      failedTypes: await NetsuiteClient.importObjectsByTypes(typeNames, executor),
    }
  }

  private static async importObjectsByTypes(typeNames: string[],
    executor: CommandActionExecutorType): Promise<string[]> {
    const failedTypes: string[] = []
    log.debug('Fetching custom objects one by one')
    await typeNames.reduce(
      (prevRes, typeName) =>
        prevRes.then(async () => {
          log.debug(`Fetching objects of type: ${typeName}`)
          try {
            await NetsuiteClient.runImportObjectsCommand(typeName, executor)
          } catch (e) {
            log.warn(`Failed to fetch objects of type ${typeName} failed due to ${e}`)
            failedTypes.push(typeName)
          }
        }),
      Promise.resolve(),
    )
    return failedTypes
  }

  private static async runImportObjectsCommand(type: string, executor: CommandActionExecutorType):
    Promise<OperationResult> {
    return NetsuiteClient.executeProjectAction(COMMANDS.IMPORT_OBJECTS, {
      destinationfolder: `${SDF_PATH_SEPARATOR}${OBJECTS_DIR}`,
      type,
      scriptid: ALL,
      excludefiles: true,
    }, executor)
  }

  private static async listFilePaths(executor: CommandActionExecutorType): Promise<string[]> {
    const TOP_LEVEL_FOLDER_NAMES = [`${SDF_PATH_SEPARATOR}${SUITE_SCRIPTS_FOLDER_NAME}`,
      `${SDF_PATH_SEPARATOR}${TEMPLATES_FOLDER_NAME}`, `${SDF_PATH_SEPARATOR}${WEB_SITE_HOSTING_FILES_FOLDER_NAME}`]
    const operationResults = _.flatten(await Promise.all(
      TOP_LEVEL_FOLDER_NAMES.map(async folderName =>
        NetsuiteClient.executeProjectAction(COMMANDS.LIST_FILES, { folder: folderName }, executor))
    ))
    return _.flatten(operationResults.map(operationResult => makeArray(operationResult.data)))
  }

  private static async importFiles(filePaths: string[], executor: CommandActionExecutorType):
    Promise<OperationResult[]> {
    try {
      const operationResult = await NetsuiteClient.executeProjectAction(
        COMMANDS.IMPORT_FILES,
        { paths: filePaths },
        executor
      )
      return [operationResult]
    } catch (e) {
      if (filePaths.length === 1) {
        log.debug(`Failed to import file ${filePaths[0]} due to: ${e.message}`)
        return []
      }
      return _.chunk(filePaths, (filePaths.length + 1) / 2)
        .filter(chunk => !_.isEmpty(chunk))
        .reduce(
          async (prevRes, paths) =>
            (await prevRes)
              .concat(
                await NetsuiteClient.importFiles(paths, executor)
              ),
          Promise.resolve([] as OperationResult[]),
        )
    }
  }

  @NetsuiteClient.logDecorator
  async importFileCabinetContent(filePathRegexSkipList: RegExp[]): Promise<CustomizationInfo[]> {
    const transformFiles = (filePaths: string[], fileAttrsPaths: string[],
      fileCabinetDirPath: string): Promise<CustomizationInfo[]> => {
      const filePathToAttrsPath = _.fromPairs(
        fileAttrsPaths.map(fileAttrsPath => {
          const fileName = fileAttrsPath.split(SDF_PATH_SEPARATOR).slice(-1)[0]
            .slice(0, -ATTRIBUTES_FILE_SUFFIX.length)
          const folderName = fileAttrsPath.split(ATTRIBUTES_FOLDER_NAME)[0]
          return [`${folderName}${fileName}`, fileAttrsPath]
        })
      )
      return Promise.all(filePaths.map(async filePath => {
        const attrsPath = filePathToAttrsPath[filePath]
        const xmlContent = readFile(osPath.resolve(fileCabinetDirPath,
          ...attrsPath.split(SDF_PATH_SEPARATOR)))
        const filePathParts = filePath.split(SDF_PATH_SEPARATOR)
        const fileContent = readFile(osPath.resolve(fileCabinetDirPath, ...filePathParts))
        return convertToFileCustomizationInfo((await xmlContent).toString(),
          filePathParts.slice(1), (await fileContent).toString())
      }))
    }

    const transformFolders = (folderAttrsPaths: string[], fileCabinetDirPath: string):
      Promise<CustomizationInfo[]> =>
      Promise.all(folderAttrsPaths.map(async attrsPath => {
        const folderPathParts = attrsPath.split(SDF_PATH_SEPARATOR)
        const xmlContent = readFile(osPath.resolve(fileCabinetDirPath, ...folderPathParts))
        return convertToFolderCustomizationInfo((await xmlContent).toString(),
          folderPathParts.slice(1, -2))
      }))

    const project = await this.initProject()
    const filePathsToImport = (await NetsuiteClient.listFilePaths(project.executor))
      .filter(path => filePathRegexSkipList.every(regex => !regex.test(path)))
    const importFilesResults = await NetsuiteClient.importFiles(filePathsToImport, project.executor)
    // folder attributes file is returned multiple times
    const paths = _.uniq(
      _.flatten(importFilesResults.map(importResult => makeArray(importResult.data.results)))
        .filter(result => result.loaded)
        .map(result => result.path)
    )
    const [attributesPaths, filePaths] = _.partition(paths,
      p => p.endsWith(ATTRIBUTES_FILE_SUFFIX))
    const [folderAttrsPaths, fileAttrsPaths] = _.partition(attributesPaths,
      p => p.endsWith(FOLDER_ATTRIBUTES_FILE_SUFFIX))

    const fileCabinetDirPath = NetsuiteClient.getFileCabinetDirPath(project.projectName)
    return _.flatten((await Promise.all(
      [transformFiles(filePaths, fileAttrsPaths, fileCabinetDirPath),
        transformFolders(folderAttrsPaths, fileCabinetDirPath)]
    )))
  }

  @NetsuiteClient.logDecorator
  async deploy(customizationInfos: CustomizationInfo[]): Promise<void> {
    const project = await this.initProject()
    const objectsDirPath = NetsuiteClient.getObjectsDirPath(project.projectName)
    const fileCabinetDirPath = NetsuiteClient.getFileCabinetDirPath(project.projectName)
    await Promise.all(customizationInfos.map(async customizationInfo => {
      if (isCustomTypeInfo(customizationInfo)) {
        return NetsuiteClient.addCustomTypeInfoToProject(customizationInfo, objectsDirPath)
      }
      if (isFileCustomizationInfo(customizationInfo)) {
        return NetsuiteClient.addFileInfoToProject(customizationInfo, fileCabinetDirPath)
      }
      if (isFolderCustomizationInfo(customizationInfo)) {
        return NetsuiteClient.addFolderInfoToProject(customizationInfo, fileCabinetDirPath)
      }
      throw new Error(`Failed to deploy invalid customizationInfo: ${customizationInfo}`)
    }))
    await NetsuiteClient.runDeployCommands(project)
  }

  private static async runDeployCommands({ executor }: Project): Promise<void> {
    await NetsuiteClient.executeProjectAction(COMMANDS.ADD_PROJECT_DEPENDENCIES, {}, executor)
    await NetsuiteClient.executeProjectAction(COMMANDS.DEPLOY_PROJECT, {}, executor)
  }

  private static async addCustomTypeInfoToProject(customTypeInfo: CustomTypeInfo,
    objectsDirPath: string): Promise<void> {
    await writeFile(
      osPath.resolve(objectsDirPath, `${customTypeInfo.scriptId}.xml`),
      convertToXmlContent(customTypeInfo)
    )
    if (isTemplateCustomTypeInfo(customTypeInfo)) {
      await writeFile(osPath.resolve(objectsDirPath,
        `${customTypeInfo.scriptId}${ADDITIONAL_FILE_PATTERN}${customTypeInfo.fileExtension}`),
      customTypeInfo.fileContent)
    }
  }

  private static async addFileInfoToProject(fileCustomizationInfo: FileCustomizationInfo,
    fileCabinetDirPath: string): Promise<void> {
    const attrsFilename = fileCustomizationInfo.path.slice(-1)[0] + ATTRIBUTES_FILE_SUFFIX
    const attrsFolderPath = osPath.resolve(fileCabinetDirPath,
      ...fileCustomizationInfo.path.slice(0, -1), ATTRIBUTES_FOLDER_NAME)

    const filename = fileCustomizationInfo.path.slice(-1)[0]
    const fileFolderPath = osPath.resolve(fileCabinetDirPath,
      ...fileCustomizationInfo.path.slice(0, -1))

    await Promise.all([
      writeFileInFolder(fileFolderPath, filename, fileCustomizationInfo.fileContent),
      writeFileInFolder(attrsFolderPath, attrsFilename, convertToXmlContent(fileCustomizationInfo)),
    ])
  }

  private static async addFolderInfoToProject(folderCustomizationInfo: FolderCustomizationInfo,
    fileCabinetDirPath: string): Promise<void> {
    const attrsFolderPath = osPath.resolve(fileCabinetDirPath, ...folderCustomizationInfo.path,
      ATTRIBUTES_FOLDER_NAME)
    await writeFileInFolder(attrsFolderPath, FOLDER_ATTRIBUTES_FILE_SUFFIX,
      convertToXmlContent(folderCustomizationInfo))
  }

  private static getProjectPath(projectName: string): string {
    return osPath.resolve(baseExecutionPath, projectName)
  }

  private static getObjectsDirPath(projectName: string): string {
    return osPath.resolve(NetsuiteClient.getProjectPath(projectName), SRC_DIR, OBJECTS_DIR)
  }

  private static getFileCabinetDirPath(projectName: string): string {
    return osPath.resolve(NetsuiteClient.getProjectPath(projectName), SRC_DIR, FILE_CABINET_DIR)
  }
}
