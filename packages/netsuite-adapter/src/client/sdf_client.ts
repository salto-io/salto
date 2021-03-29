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
import { collections, decorators, promises, values } from '@salto-io/lowerdash'
import { Values, AccountId } from '@salto-io/adapter-api'
import { mkdirp, readDir, readFile, writeFile, rm } from '@salto-io/file'
import { logger } from '@salto-io/logging'
import {
  CommandsMetadataService, CommandActionExecutor, CLIConfigurationService, NodeConsoleLogger,
  ActionResult, ActionResultUtils,
} from '@salto-io/suitecloud-cli'
import xmlParser from 'fast-xml-parser'
import he from 'he'
import Bottleneck from 'bottleneck'
import osPath from 'path'
import os from 'os'
import _ from 'lodash'
import uuidv4 from 'uuid/v4'
import AsyncLock from 'async-lock'
import wu from 'wu'
import {
  FILE_CABINET_PATH_SEPARATOR,
} from '../constants'
import {
  DEFAULT_FETCH_ALL_TYPES_AT_ONCE, DEFAULT_FETCH_TYPE_TIMEOUT_IN_MINUTES,
  DEFAULT_MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST, DEFAULT_CONCURRENCY, SdfClientConfig,
} from '../config'
import { NetsuiteQuery, NetsuiteQueryParameters, ObjectID } from '../query'
import { SdfCredentials } from './credentials'
import {
  CustomizationInfo, CustomTypeInfo, FileCustomizationInfo, FolderCustomizationInfo,
  GetCustomObjectsResult, ImportFileCabinetResult, ImportObjectsResult, TemplateCustomTypeInfo,
} from './types'
import { ATTRIBUTE_PREFIX, CDATA_TAG_NAME, fileCabinetTopLevelFolders } from './constants'
import {
  isCustomTypeInfo, isFileCustomizationInfo, isFolderCustomizationInfo, isTemplateCustomTypeInfo,
  mergeTypeToInstances,
} from './utils'

const { makeArray } = collections.array
const { withLimitedConcurrency } = promises.array
const { withTimeout } = promises.timeout
const log = logger(module)

export type SdfClientOpts = {
  credentials: SdfCredentials
  config?: SdfClientConfig
}

export const COMMANDS = {
  CREATE_PROJECT: 'project:create',
  SETUP_ACCOUNT: 'account:ci',
  MANAGE_AUTH: 'account:manageauth',
  IMPORT_OBJECTS: 'object:import',
  LIST_OBJECTS: 'object:list',
  LIST_FILES: 'file:list',
  IMPORT_FILES: 'file:import',
  DEPLOY_PROJECT: 'project:deploy',
  ADD_PROJECT_DEPENDENCIES: 'project:adddependencies',
}


export const ATTRIBUTES_FOLDER_NAME = '.attributes'
export const ATTRIBUTES_FILE_SUFFIX = '.attr.xml'
export const FOLDER_ATTRIBUTES_FILE_SUFFIX = '.folder.attr.xml'
const FILE_CABINET_DIR = 'FileCabinet'
const OBJECTS_DIR = 'Objects'
const SRC_DIR = 'src'
const FILE_SEPARATOR = '.'
const ALL = 'ALL'
const ADDITIONAL_FILE_PATTERN = '.template.'

const MINUTE_IN_MILLISECONDS = 1000 * 60

const INVALID_DEPENDENCIES = ['ADVANCEDEXPENSEMANAGEMENT', 'SUBSCRIPTIONBILLING', 'WMSSYSTEM', 'BILLINGACCOUNTS']
const INVALID_DEPENDENCIES_PATTERN = new RegExp(`^.*(<feature required=".*">${INVALID_DEPENDENCIES.join('|')})</feature>.*\n`, 'gm')

const baseExecutionPath = os.tmpdir()

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

export const convertToXmlContent = (customizationInfo: CustomizationInfo): string =>
  // eslint-disable-next-line new-cap
  new xmlParser.j2xParser({
    attributeNamePrefix: ATTRIBUTE_PREFIX,
    // We convert to an not formatted xml since the CDATA transformation is wrong when having format
    format: false,
    ignoreAttributes: false,
    cdataTagName: CDATA_TAG_NAME,
    tagValueProcessor: val => he.encode(val),
  }).parse({ [customizationInfo.typeName]: customizationInfo.values })

const writeFileInFolder = async (folderPath: string, filename: string, content: string | Buffer):
  Promise<void> => {
  await mkdirp(folderPath)
  osPath.resolve(folderPath, filename)
  await writeFile(osPath.resolve(folderPath, filename), content)
}

type Project = {
  projectName: string
  projectPath: string
  executor: CommandActionExecutor
  authId: string
}

type ObjectsChunk = {
  type: string
  ids: string[]
  index: number
  total: number
}

export default class SdfClient {
  private readonly credentials: SdfCredentials
  private readonly fetchAllTypesAtOnce: boolean
  private readonly fetchTypeTimeoutInMinutes: number
  private readonly maxItemsInImportObjectsRequest: number
  private readonly sdfConcurrencyLimit: number
  private readonly sdfCallsLimiter: Bottleneck
  private readonly setupAccountLock: AsyncLock
  private readonly baseCommandExecutor: CommandActionExecutor

  constructor({
    credentials,
    config,
  }: SdfClientOpts) {
    this.credentials = credentials
    this.fetchAllTypesAtOnce = config?.fetchAllTypesAtOnce ?? DEFAULT_FETCH_ALL_TYPES_AT_ONCE
    this.fetchTypeTimeoutInMinutes = config?.fetchTypeTimeoutInMinutes
      ?? DEFAULT_FETCH_TYPE_TIMEOUT_IN_MINUTES
    this.maxItemsInImportObjectsRequest = config?.maxItemsInImportObjectsRequest
      ?? DEFAULT_MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST
    this.sdfConcurrencyLimit = config?.sdfConcurrencyLimit ?? DEFAULT_CONCURRENCY
    this.sdfCallsLimiter = new Bottleneck({ maxConcurrent: this.sdfConcurrencyLimit })
    this.setupAccountLock = new AsyncLock()
    this.baseCommandExecutor = SdfClient.initCommandActionExecutor(baseExecutionPath)
  }

  @SdfClient.logDecorator
  static async validateCredentials(credentials: SdfCredentials): Promise<AccountId> {
    const netsuiteClient = new SdfClient({ credentials })
    const { projectName, authId } = await netsuiteClient.initProject()
    await netsuiteClient.projectCleanup(projectName, authId)
    return Promise.resolve(netsuiteClient.credentials.accountId)
  }

  private static initCommandActionExecutor(executionPath: string): CommandActionExecutor {
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
    SdfClient.verifySuccessfulAction(actionResult, COMMANDS.CREATE_PROJECT)
  }

  private static verifySuccessfulAction(actionResult: ActionResult, commandName: string):
    void {
    if (!actionResult.isSuccess()) {
      log.error(`SDF command ${commandName} has failed.`)
      throw Error(ActionResultUtils.getErrorMessagesString(actionResult))
    }
  }

  private async executeProjectAction(
    commandName: string,
    commandArguments: Values,
    projectCommandActionExecutor: CommandActionExecutor,
    timeoutInMinutes?: number
  ): Promise<ActionResult> {
    const actionResult = await this.sdfCallsLimiter.schedule(() => {
      const actionResultPromise = projectCommandActionExecutor.executeAction({
        commandName,
        runInInteractiveMode: false,
        arguments: commandArguments,
      })
      return timeoutInMinutes !== undefined
        ? withTimeout(actionResultPromise, timeoutInMinutes * MINUTE_IN_MILLISECONDS)
        : actionResultPromise
    })
    SdfClient.verifySuccessfulAction(actionResult, commandName)
    return actionResult
  }

  // The SDF Java SDK has a race when accessing the authIds file concurrently that causes it to
  // override credentials so we have to make sure we never call auth related operations concurrently
  private async withAuthIdsLock(fn: (() => Promise<void>)): Promise<void> {
    await this.setupAccountLock.acquire('authIdManipulation', fn)
  }

  protected async setupAccount(
    projectCommandActionExecutor: CommandActionExecutor,
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
    const projectPath = SdfClient.getProjectPath(projectName)
    const executor = SdfClient
      .initCommandActionExecutor(projectPath)
    await this.setupAccount(executor, authId)
    return { projectName, projectPath, executor, authId }
  }

  private static async deleteProject(projectName: string): Promise<void> {
    log.debug(`Deleting SDF project: ${projectName}`)
    await rm(SdfClient.getProjectPath(projectName))
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
      SdfClient.deleteProject(projectName),
      this.deleteAuthId(authId),
    ])
  }

  @SdfClient.logDecorator
  async getCustomObjects(typeNames: string[], query: NetsuiteQuery):
    Promise<GetCustomObjectsResult> {
    if (typeNames.every(type => !query.isTypeMatch(type))) {
      return { elements: [], failedToFetchAllAtOnce: false, failedTypeToInstances: {} }
    }

    const { executor, projectName, authId } = await this.initProject()
    const { failedToFetchAllAtOnce, failedTypeToInstances } = await this.importObjects(
      executor, typeNames, query
    )
    const objectsDirPath = SdfClient.getObjectsDirPath(projectName)
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
    return { elements, failedToFetchAllAtOnce, failedTypeToInstances }
  }

  private async importObjects(
    executor: CommandActionExecutor,
    typeNames: string[],
    query: NetsuiteQuery
  ): Promise<{ failedToFetchAllAtOnce: boolean; failedTypeToInstances: NetsuiteQueryParameters['types'] }> {
    const importAllAtOnce = async (): Promise<NetsuiteQueryParameters['types'] | undefined> => {
      log.debug('Fetching all custom objects at once')
      try {
        // When fetchAllAtOnce we use the below heuristic in order to define a proper timeout,
        // instead of adding another configuration value
        return await this.runImportObjectsCommand(
          executor, ALL, ALL, this.fetchTypeTimeoutInMinutes * 4
        )
      } catch (e) {
        log.warn('Attempt to fetch all custom objects has failed')
        log.warn(e)
        return undefined
      }
    }

    if (this.fetchAllTypesAtOnce) {
      const failedTypeToInstances = await importAllAtOnce()
      if (failedTypeToInstances !== undefined) {
        return { failedToFetchAllAtOnce: false, failedTypeToInstances }
      }
    }
    const failedTypeToInstances = await this.importObjectsInChunks(executor, typeNames, query)
    return { failedToFetchAllAtOnce: this.fetchAllTypesAtOnce, failedTypeToInstances }
  }

  private async importObjectsInChunks(
    executor: CommandActionExecutor,
    typeNames: string[],
    query: NetsuiteQuery
  ): Promise<NetsuiteQueryParameters['types']> {
    const importObjectsChunk = async (
      { type, ids, index, total }: ObjectsChunk, retry = true
    ): Promise<NetsuiteQueryParameters['types']> => {
      try {
        log.debug('Starting to fetch chunk %d/%d with %d objects of type: %s', index, total, ids.length, type)
        const failedTypeToInstances = await this.runImportObjectsCommand(
          executor, type, ids.join(' '), this.fetchTypeTimeoutInMinutes
        )
        log.debug('Fetched chunk %d/%d with %d objects of type: %s. failedTypeToInstances: %o',
          index, total, ids.length, type, failedTypeToInstances)
        return failedTypeToInstances
      } catch (e) {
        log.warn('Failed to fetch chunk %d/%d with %d objects of type: %s', index, total, ids.length, type)
        log.warn(e)
        if (!retry) {
          throw e
        }
        if (ids.length === 1) {
          log.debug('Retrying to fetch chunk %d/%d with a single object of type: %s', index, total, type)
          return importObjectsChunk({ type, ids, index, total }, false)
        }
        log.debug('Retrying to fetch chunk %d/%d with %d objects of type: %s with smaller chunks', index, total, ids.length, type)
        const middle = (ids.length + 1) / 2
        const results = await Promise.all([
          importObjectsChunk({ type, ids: ids.slice(0, middle), index, total }),
          importObjectsChunk({ type, ids: ids.slice(middle, ids.length), index, total }),
        ])
        return mergeTypeToInstances(...results)
      }
    }

    const instancesIds = (await this.listInstances(
      executor,
      typeNames.filter(query.isTypeMatch)
    )).filter(query.isObjectMatch)

    const instancesIdsByType = _.groupBy(instancesIds, id => id.type)
    const idsChunks = wu.entries(instancesIdsByType).map(
      ([type, ids]: [string, ObjectID[]]) =>
        wu(ids)
          .map(id => id.scriptId)
          .chunk(this.maxItemsInImportObjectsRequest)
          .enumerate()
          .map(([chunk, index]) => ({
            type,
            ids: chunk,
            index: index + 1,
            total: Math.ceil(ids.length / this.maxItemsInImportObjectsRequest),
          }))
          .toArray()
    ).flatten(true).toArray()

    log.debug('Fetching custom objects by types in chunks')
    const results = await withLimitedConcurrency( // limit the number of open promises
      idsChunks.map(idsChunk => () => importObjectsChunk(idsChunk)),
      this.sdfConcurrencyLimit
    )
    return mergeTypeToInstances(...results)
  }

  private async runImportObjectsCommand(
    executor: CommandActionExecutor,
    type: string,
    scriptIds: string,
    timeoutInMinutes: number,
  ): Promise<NetsuiteQueryParameters['types']> {
    const actionResult = await this.executeProjectAction(
      COMMANDS.IMPORT_OBJECTS,
      {
        destinationfolder: `${FILE_CABINET_PATH_SEPARATOR}${OBJECTS_DIR}`,
        type,
        scriptid: scriptIds,
        maxItemsInImportObjectsRequest: this.maxItemsInImportObjectsRequest,
        excludefiles: true,
      },
      executor,
      timeoutInMinutes
    )
    const importResult = actionResult.data as ImportObjectsResult
    return _(importResult.failedImports)
      .filter(failedImport => {
        if (failedImport.customObject.result.message.includes('unexpected error')) {
          log.debug('Failed to fetch (%s) instance with id (%s) due to SDF unexpected error',
            failedImport.customObject.type, failedImport.customObject.id)
          return true
        }
        return false
      })
      .groupBy(failedImport => failedImport.customObject.type)
      .mapValues(failedImports => failedImports.map(failedImport => failedImport.customObject.id))
      .value()
  }

  async listInstances(
    executor: CommandActionExecutor,
    types: string[],
  ): Promise<ObjectID[]> {
    const results = await this.executeProjectAction(
      COMMANDS.LIST_OBJECTS,
      {
        type: types.join(' '),
      },
      executor,
    )
    return results.data
  }

  private async listFilePaths(executor: CommandActionExecutor):
    Promise<{ listedPaths: string[]; failedPaths: string[] }> {
    const failedPaths: string[] = []
    const actionResults = (await Promise.all(
      fileCabinetTopLevelFolders
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

  private async importFiles(filePaths: string[], executor: CommandActionExecutor):
    Promise<string[]> {
    if (filePaths.length === 0) {
      return []
    }
    try {
      log.info(`Going to import ${filePaths.length} files`)
      const actionResult = await this.executeProjectAction(
        COMMANDS.IMPORT_FILES,
        { paths: filePaths },
        executor
      )
      return makeArray(actionResult.data.results)
        .filter(result => result.loaded)
        .map(result => result.path)
    } catch (e) {
      if (filePaths.length === 1) {
        log.error(`Failed to import file ${filePaths[0]} due to: ${e.message}`)
        throw new Error(`Failed to import file: ${filePaths[0]}. Consider to add it to the skip list.`)
      }
      const middle = (filePaths.length + 1) / 2
      const firstChunkImportResults = await this.importFiles(filePaths.slice(0, middle), executor)
      const secondChunkImportResults = await this.importFiles(
        filePaths.slice(middle, filePaths.length), executor
      )
      return [...firstChunkImportResults, ...secondChunkImportResults]
    }
  }

  @SdfClient.logDecorator
  async importFileCabinetContent(query: NetsuiteQuery):
    Promise<ImportFileCabinetResult> {
    if (!query.areSomeFilesMatch()) {
      return {
        elements: [],
        failedPaths: [],
      }
    }

    const transformFiles = (filePaths: string[], fileAttrsPaths: string[],
      fileCabinetDirPath: string): Promise<FileCustomizationInfo[]> => {
      const filePathToAttrsPath = _.fromPairs(
        fileAttrsPaths.map(fileAttrsPath => {
          const fileName = fileAttrsPath.split(FILE_CABINET_PATH_SEPARATOR).slice(-1)[0]
            .slice(0, -ATTRIBUTES_FILE_SUFFIX.length)
          const folderName = fileAttrsPath.split(ATTRIBUTES_FOLDER_NAME)[0]
          return [`${folderName}${fileName}`, fileAttrsPath]
        })
      )
      return Promise.all(filePaths.map(async filePath => {
        const attrsPath = filePathToAttrsPath[filePath]
        const xmlContent = readFile(osPath.resolve(fileCabinetDirPath,
          ...attrsPath.split(FILE_CABINET_PATH_SEPARATOR)))
        const filePathParts = filePath.split(FILE_CABINET_PATH_SEPARATOR)
        const fileContent = readFile(osPath.resolve(fileCabinetDirPath, ...filePathParts))
        return convertToFileCustomizationInfo((await xmlContent).toString(),
          filePathParts.slice(1), await fileContent)
      }))
    }

    const transformFolders = (folderAttrsPaths: string[], fileCabinetDirPath: string):
      Promise<FolderCustomizationInfo[]> =>
      Promise.all(folderAttrsPaths.map(async attrsPath => {
        const folderPathParts = attrsPath.split(FILE_CABINET_PATH_SEPARATOR)
        const xmlContent = readFile(osPath.resolve(fileCabinetDirPath, ...folderPathParts))
        return convertToFolderCustomizationInfo((await xmlContent).toString(),
          folderPathParts.slice(1, -2))
      }))

    const project = await this.initProject()
    const listFilesResults = await this.listFilePaths(project.executor)
    const filePathsToImport = listFilesResults.listedPaths
      .filter(path => query.isFileMatch(path))
    const importFilesResult = await this.importFiles(filePathsToImport, project.executor)
    // folder attributes file is returned multiple times
    const importedPaths = _.uniq(importFilesResult)
    const [attributesPaths, filePaths] = _.partition(importedPaths,
      p => p.endsWith(ATTRIBUTES_FILE_SUFFIX))
    const [folderAttrsPaths, fileAttrsPaths] = _.partition(attributesPaths,
      p => p.endsWith(FOLDER_ATTRIBUTES_FILE_SUFFIX))

    const fileCabinetDirPath = SdfClient.getFileCabinetDirPath(project.projectName)
    const elements = (await Promise.all(
      [transformFiles(filePaths, fileAttrsPaths, fileCabinetDirPath),
        transformFolders(folderAttrsPaths, fileCabinetDirPath)]
    )).flat()
    await this.projectCleanup(project.projectName, project.authId)
    return {
      elements,
      failedPaths: listFilesResults.failedPaths,
    }
  }

  @SdfClient.logDecorator
  async deploy(customizationInfos: CustomizationInfo[]): Promise<void> {
    const project = await this.initProject()
    const objectsDirPath = SdfClient.getObjectsDirPath(project.projectName)
    const fileCabinetDirPath = SdfClient.getFileCabinetDirPath(project.projectName)
    await Promise.all(customizationInfos.map(async customizationInfo => {
      if (isCustomTypeInfo(customizationInfo)) {
        return SdfClient.addCustomTypeInfoToProject(customizationInfo, objectsDirPath)
      }
      if (isFileCustomizationInfo(customizationInfo)) {
        return SdfClient.addFileInfoToProject(customizationInfo, fileCabinetDirPath)
      }
      if (isFolderCustomizationInfo(customizationInfo)) {
        return SdfClient.addFolderInfoToProject(customizationInfo, fileCabinetDirPath)
      }
      throw new Error(`Failed to deploy invalid customizationInfo: ${customizationInfo}`)
    }))
    await this.runDeployCommands(project)
    await this.projectCleanup(project.projectName, project.authId)
  }

  private static async cleanInvalidDependencies(projectPath: string): Promise<void> {
    // This is done due to an SDF bug described in SALTO-1107.
    // This function should be removed once the bug is fixed.
    const manifestPath = osPath.join(projectPath, 'src', 'manifest.xml')
    const manifestContent = await readFile(manifestPath)
    const fixedManifestContent = manifestContent.toString().replace(INVALID_DEPENDENCIES_PATTERN, '')
    await writeFile(manifestPath, fixedManifestContent)
  }

  private async runDeployCommands({ executor, projectPath }: Project): Promise<void> {
    await this.executeProjectAction(COMMANDS.ADD_PROJECT_DEPENDENCIES, {}, executor)
    await SdfClient.cleanInvalidDependencies(projectPath)
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
    return osPath.resolve(SdfClient.getProjectPath(projectName), SRC_DIR, OBJECTS_DIR)
  }

  private static getFileCabinetDirPath(projectName: string): string {
    return osPath.resolve(SdfClient.getProjectPath(projectName), SRC_DIR, FILE_CABINET_DIR)
  }
}
