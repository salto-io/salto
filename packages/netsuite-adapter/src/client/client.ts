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
  CommandsMetadataService as CommandsMetadataServiceType,
  CommandActionExecutor as CommandActionExecutorType,
  CLIConfigurationService as CLIConfigurationServiceType,
  NodeConsoleLogger as NodeConsoleLoggerType,
  ActionResultUtils as ActionResultUtilsType,
  ActionResult,
} from '@salto-io/suitecloud-cli'

import { collections, decorators, promises, values } from '@salto-io/lowerdash'
import { Values, AccountId } from '@salto-io/adapter-api'
import { mkdirp, readDir, readFile, writeFile, rm } from '@salto-io/file'
import { logger } from '@salto-io/logging'
import xmlParser from 'fast-xml-parser'
import he from 'he'
import Bottleneck from 'bottleneck'
import osPath from 'path'
import os from 'os'
import _ from 'lodash'
import uuidv4 from 'uuid/v4'
import AsyncLock from 'async-lock'
import {
  SUITE_SCRIPTS_FOLDER_NAME, TEMPLATES_FOLDER_NAME, WEB_SITE_HOSTING_FILES_FOLDER_NAME, FILE,
  FOLDER, ENTRY_FORM, TRANSACTION_FORM,
} from '../constants'

const { makeArray } = collections.array
const { withLimitedConcurrency } = promises.array
const log = logger(module)

let CommandsMetadataService: typeof CommandsMetadataServiceType
let CommandActionExecutor: typeof CommandActionExecutorType
let CLIConfigurationService: typeof CLIConfigurationServiceType
let NodeConsoleLogger: typeof NodeConsoleLoggerType
let ActionResultUtils: typeof ActionResultUtilsType

try {
  // eslint-disable-next-line max-len
  // eslint-disable-next-line import/no-extraneous-dependencies,@typescript-eslint/no-var-requires,global-require
  const module = require('@salto-io/suitecloud-cli')
  CommandsMetadataService = module.CommandsMetadataService
  CommandActionExecutor = module.CommandActionExecutor
  CLIConfigurationService = module.CLIConfigurationService
  NodeConsoleLogger = module.NodeConsoleLogger
  ActionResultUtils = module.ActionResultUtils
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
  sdfConcurrencyLimit: number
}

export const COMMANDS = {
  CREATE_PROJECT: 'project:create',
  SETUP_ACCOUNT: 'account:ci',
  MANAGE_AUTH: 'account:manageauth',
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
export const fileCabinetTopLevelFolders = [
  `${SDF_PATH_SEPARATOR}${SUITE_SCRIPTS_FOLDER_NAME}`,
  `${SDF_PATH_SEPARATOR}${TEMPLATES_FOLDER_NAME}`,
  `${SDF_PATH_SEPARATOR}${WEB_SITE_HOSTING_FILES_FOLDER_NAME}`,
]

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
  fileContent: Buffer
}

export interface FileCustomizationInfo extends CustomizationInfo {
  path: string[]
  fileContent: Buffer
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
  fileExtension: string, fileContent: Buffer): TemplateCustomTypeInfo =>
  Object.assign(
    convertToCustomizationInfo(xmlContent),
    { fileExtension, fileContent, scriptId }
  )

export const convertToFileCustomizationInfo = (xmlContent: string, path: string[],
  fileContent: Buffer): FileCustomizationInfo =>
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

// Without removing the ZeroWidthSpace, the deploy fails on:
// 'The entity "ZeroWidthSpace" was referenced, but not declared.'
// https://stackoverflow.com/questions/11305797/remove-zero-width-space-characters-from-a-javascript-string
const removeZeroWidthSpace = (val: string): string => val.replace(/[\u200B-\u200D\uFEFF]/g, '')

export const convertToXmlContent = (customizationInfo: CustomizationInfo): string =>
  // eslint-disable-next-line new-cap
  new xmlParser.j2xParser({
    attributeNamePrefix: ATTRIBUTE_PREFIX,
    // We convert to an not formatted xml since the CDATA transformation is wrong when having format
    format: false,
    ignoreAttributes: false,
    cdataTagName: CDATA_TAG_NAME,
    tagValueProcessor: val =>
      he.encode(removeZeroWidthSpace(val), { useNamedReferences: true }),
  }).parse({ [customizationInfo.typeName]: customizationInfo.values })

const writeFileInFolder = async (folderPath: string, filename: string, content: string | Buffer):
  Promise<void> => {
  await mkdirp(folderPath)
  osPath.resolve(folderPath, filename)
  await writeFile(osPath.resolve(folderPath, filename), content)
}

type Project = {
  projectName: string
  executor: CommandActionExecutorType
  authId: string
}

export type GetCustomObjectsResult = {
  elements: CustomTypeInfo[]
  failedTypes: string[]
  failedToFetchAllAtOnce: boolean
}

export type ImportFileCabinetResult = {
  elements: (FileCustomizationInfo | FolderCustomizationInfo)[]
  failedPaths: string[]
}

export default class NetsuiteClient {
  private readonly credentials: Credentials
  private readonly sdfConcurrencyLimit: number
  private readonly sdfCallsLimiter: Bottleneck
  private readonly setupAccountLock: AsyncLock
  private readonly baseCommandExecutor: CommandActionExecutorType

  constructor({ credentials, sdfConcurrencyLimit }: NetsuiteClientOpts) {
    this.credentials = {
      ...credentials,
      // accountId must be uppercased as decribed in https://github.com/oracle/netsuite-suitecloud-sdk/issues/140
      accountId: credentials.accountId.toUpperCase().replace('-', '_'),
    }
    this.sdfConcurrencyLimit = sdfConcurrencyLimit
    this.sdfCallsLimiter = new Bottleneck({ maxConcurrent: sdfConcurrencyLimit })
    this.setupAccountLock = new AsyncLock()
    this.baseCommandExecutor = NetsuiteClient.initCommandActionExecutor(baseExecutionPath)
  }

  @NetsuiteClient.logDecorator
  static async validateCredentials(credentials: Credentials): Promise<AccountId> {
    const netsuiteClient = new NetsuiteClient({ credentials, sdfConcurrencyLimit: 1 })
    const { projectName, authId } = await netsuiteClient.initProject()
    await netsuiteClient.projectCleanup(projectName, authId)
    return Promise.resolve(netsuiteClient.credentials.accountId)
  }

  private static initCommandActionExecutor(executionPath: string): CommandActionExecutorType {
    return new CommandActionExecutor({
      executionPath,
      cliConfigurationService: new CLIConfigurationService(),
      commandsMetadataService: new CommandsMetadataService(),
      log: NodeConsoleLogger,
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

  private async createProject(projectName: string): Promise<void> {
    const actionResult = await this.baseCommandExecutor.executeAction({
      commandName: COMMANDS.CREATE_PROJECT,
      runInInteractiveMode: false,
      arguments: {
        projectname: projectName,
        type: 'ACCOUNTCUSTOMIZATION',
        parentdirectory: osPath.join(baseExecutionPath, projectName),
      },
    })
    NetsuiteClient.verifySuccessfulAction(actionResult, COMMANDS.CREATE_PROJECT)
  }

  private static verifySuccessfulAction(actionResult: ActionResult, commandName: string):
    void {
    if (!actionResult.isSuccess()) {
      log.error(`SDF command ${commandName} has failed.`)
      throw Error(ActionResultUtils.getErrorMessagesString(actionResult))
    }
  }

  private async executeProjectAction(commandName: string, commandArguments: Values,
    projectCommandActionExecutor: CommandActionExecutorType): Promise<ActionResult> {
    const actionResult = await this.sdfCallsLimiter.schedule(() =>
      projectCommandActionExecutor.executeAction({
        commandName,
        runInInteractiveMode: false,
        arguments: commandArguments,
      }))
    NetsuiteClient.verifySuccessfulAction(actionResult, commandName)
    return actionResult
  }

  // The SDF Java SDK has a race when accessing the authIds file concurrently that causes it to
  // override credentials so we have to make sure we never call auth related operations concurrently
  private async withAuthIdsLock(fn: (() => Promise<void>)): Promise<void> {
    await this.setupAccountLock.acquire('authIdManipulation', fn)
  }

  protected async setupAccount(
    projectCommandActionExecutor: CommandActionExecutorType,
    authId: string
  ): Promise<void> {
    await this.withAuthIdsLock(async () => {
      log.debug(`Setting up account using authId: ${authId}`)
      await this.executeProjectAction(
        COMMANDS.SETUP_ACCOUNT,
        {
          authid: authId,
          account: this.credentials.accountId,
          tokenid: this.credentials.tokenId,
          tokensecret: this.credentials.tokenSecret,
          savetoken: true,
        },
        projectCommandActionExecutor
      )
    })
  }

  private async initProject(): Promise<Project> {
    const authId = uuidv4()
    const projectName = `TempSdfProject-${authId}`
    await this.createProject(projectName)
    const executor = NetsuiteClient
      .initCommandActionExecutor(NetsuiteClient.getProjectPath(projectName))
    await this.setupAccount(executor, authId)
    return { projectName, executor, authId }
  }

  private static async deleteProject(projectName: string): Promise<void> {
    log.debug(`Deleting SDF project: ${projectName}`)
    await rm(NetsuiteClient.getProjectPath(projectName))
  }

  private async deleteAuthId(authId: string): Promise<void> {
    await this.withAuthIdsLock(async () => {
      log.debug(`Removing authId: ${authId}`)
      await this.baseCommandExecutor.executeAction({
        commandName: COMMANDS.MANAGE_AUTH,
        runInInteractiveMode: false,
        arguments: {
          remove: authId,
        },
      })
    })
  }

  private async projectCleanup(projectName: string, authId: string): Promise<void> {
    await Promise.all([
      NetsuiteClient.deleteProject(projectName),
      this.deleteAuthId(authId),
    ])
  }

  @NetsuiteClient.logDecorator
  async getCustomObjects(typeNames: string[], fetchAllAtOnce: boolean):
    Promise<GetCustomObjectsResult> {
    const { executor, projectName, authId } = await this.initProject()
    const { failedToFetchAllAtOnce, failedTypes } = await this.importObjects(typeNames,
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
          additionalFilename.split(FILE_SEPARATOR)[2], await additionalFileContent)
      })
    )
    await this.projectCleanup(projectName, authId)
    return { elements, failedTypes, failedToFetchAllAtOnce }
  }

  private async importObjects(typeNames: string[], fetchAllAtOnce: boolean,
    executor: CommandActionExecutorType):
    Promise<{ failedToFetchAllAtOnce: boolean; failedTypes: string[] }> {
    const importAllAtOnce = async (): Promise<boolean> => {
      log.debug('Fetching all custom objects at once')
      try {
        await this.runImportObjectsCommand(ALL, executor)
        return true
      } catch (e) {
        log.warn(`Attempt to fetch all custom objects has failed due to: "${e}"`)
        return false
      }
    }

    if (fetchAllAtOnce && await importAllAtOnce()) {
      return { failedToFetchAllAtOnce: false, failedTypes: [] }
    }
    return {
      failedToFetchAllAtOnce: fetchAllAtOnce,
      failedTypes: await this.importObjectsByTypes(typeNames, executor),
    }
  }

  private async importObjectsByTypes(typeNames: string[],
    executor: CommandActionExecutorType): Promise<string[]> {
    const orderTypesByFetchDuration = (): string[] => {
      // Fetching the below types takes statistically much more time than the others, and sometimes
      // they even fail on SDF internal timeout. We can save some fetch time if fetching them first.
      const typesWithLongFetchDuration = new Set([TRANSACTION_FORM, ENTRY_FORM])
      return [...typeNames].sort((typeA: string, typeB: string): number => {
        if (typesWithLongFetchDuration.has(typeA) && !typesWithLongFetchDuration.has(typeB)) {
          return -1
        }
        if (typesWithLongFetchDuration.has(typeB) && !typesWithLongFetchDuration.has(typeA)) {
          return 1
        }
        return 0
      })
    }

    const failedTypes: string[] = []
    log.debug('Fetching custom objects one by one')
    await withLimitedConcurrency( // limit the number of open promises
      orderTypesByFetchDuration().map(typeName => async () => {
        try {
          log.debug(`Starting to fetch objects of type: ${typeName}`)
          await this.runImportObjectsCommand(typeName, executor)
          log.debug(`Fetched objects of type: ${typeName}`)
        } catch (e) {
          log.warn(`Failed to fetch objects of type ${typeName} failed due to: "${e}"`)
          failedTypes.push(typeName)
        }
      }),
      this.sdfConcurrencyLimit
    )
    return failedTypes
  }

  private async runImportObjectsCommand(type: string, executor: CommandActionExecutorType):
    Promise<ActionResult> {
    return this.executeProjectAction(COMMANDS.IMPORT_OBJECTS, {
      destinationfolder: `${SDF_PATH_SEPARATOR}${OBJECTS_DIR}`,
      type,
      scriptid: ALL,
      excludefiles: true,
    }, executor)
  }

  private async listFilePaths(executor: CommandActionExecutorType, filePathRegexSkipList: RegExp[]):
    Promise<{ listedPaths: string[]; failedPaths: string[] }> {
    const failedPaths: string[] = []
    const actionResults = (await Promise.all(
      fileCabinetTopLevelFolders
        .filter(folder => filePathRegexSkipList.every(regex => !regex.test(folder)))
        .map(folder =>
          this.executeProjectAction(COMMANDS.LIST_FILES, { folder }, executor)
            .catch(() => {
              log.debug(`Adding ${folder} path to skip list`)
              failedPaths.push(folder)
              return undefined
            }))
    )).filter(values.isDefined)
    return {
      listedPaths: actionResults.flatMap(actionResult => makeArray(actionResult.data)),
      failedPaths,
    }
  }

  private async importFiles(filePaths: string[], executor: CommandActionExecutorType):
    Promise<{ importedPaths: string[]; failedPaths: string[] }> {
    try {
      const actionResult = await this.executeProjectAction(
        COMMANDS.IMPORT_FILES,
        { paths: filePaths },
        executor
      )
      return {
        importedPaths: makeArray(actionResult.data.results)
          .filter(result => result.loaded)
          .map(result => result.path),
        failedPaths: [],
      }
    } catch (e) {
      if (filePaths.length === 1) {
        log.debug(`Failed to import file ${filePaths[0]} due to: ${e.message}`)
        return { importedPaths: [], failedPaths: filePaths }
      }
      const importResults = await withLimitedConcurrency( // limit the number of open promises
        _.chunk(filePaths, (filePaths.length + 1) / 2)
          .filter(chunk => !_.isEmpty(chunk))
          .map(paths => () => this.importFiles(paths, executor)),
        this.sdfConcurrencyLimit,
      )
      return {
        importedPaths: importResults.flatMap(importResult => importResult.importedPaths),
        failedPaths: importResults.flatMap(importResult => importResult.failedPaths),
      }
    }
  }

  @NetsuiteClient.logDecorator
  async importFileCabinetContent(filePathRegexSkipList: RegExp[]):
    Promise<ImportFileCabinetResult> {
    const transformFiles = (filePaths: string[], fileAttrsPaths: string[],
      fileCabinetDirPath: string): Promise<FileCustomizationInfo[]> => {
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
          filePathParts.slice(1), await fileContent)
      }))
    }

    const transformFolders = (folderAttrsPaths: string[], fileCabinetDirPath: string):
      Promise<FolderCustomizationInfo[]> =>
      Promise.all(folderAttrsPaths.map(async attrsPath => {
        const folderPathParts = attrsPath.split(SDF_PATH_SEPARATOR)
        const xmlContent = readFile(osPath.resolve(fileCabinetDirPath, ...folderPathParts))
        return convertToFolderCustomizationInfo((await xmlContent).toString(),
          folderPathParts.slice(1, -2))
      }))

    const project = await this.initProject()
    const listFilesResults = await this.listFilePaths(project.executor, filePathRegexSkipList)
    const filePathsToImport = listFilesResults.listedPaths
      .filter(path => filePathRegexSkipList.every(regex => !regex.test(path)))
    const importFilesResults = await this.importFiles(filePathsToImport, project.executor)
    // folder attributes file is returned multiple times
    const importedPaths = _.uniq(importFilesResults.importedPaths)
    const [attributesPaths, filePaths] = _.partition(importedPaths,
      p => p.endsWith(ATTRIBUTES_FILE_SUFFIX))
    const [folderAttrsPaths, fileAttrsPaths] = _.partition(attributesPaths,
      p => p.endsWith(FOLDER_ATTRIBUTES_FILE_SUFFIX))

    const fileCabinetDirPath = NetsuiteClient.getFileCabinetDirPath(project.projectName)
    const elements = (await Promise.all(
      [transformFiles(filePaths, fileAttrsPaths, fileCabinetDirPath),
        transformFolders(folderAttrsPaths, fileCabinetDirPath)]
    )).flat()
    await this.projectCleanup(project.projectName, project.authId)
    return {
      elements,
      failedPaths: [...listFilesResults.failedPaths, ...importFilesResults.failedPaths],
    }
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
    await this.runDeployCommands(project)
    await this.projectCleanup(project.projectName, project.authId)
  }

  private async runDeployCommands({ executor }: Project): Promise<void> {
    await this.executeProjectAction(COMMANDS.ADD_PROJECT_DEPENDENCIES, {}, executor)
    await this.executeProjectAction(COMMANDS.DEPLOY_PROJECT, {}, executor)
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
