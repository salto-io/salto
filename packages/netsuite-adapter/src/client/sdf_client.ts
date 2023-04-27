/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { collections, decorators, objects as lowerdashObjects, promises, values as valuesUtils } from '@salto-io/lowerdash'
import { Values, AccountId } from '@salto-io/adapter-api'
import { mkdirp, readFile, writeFile, rm, stat, rename } from '@salto-io/file'
import { logger } from '@salto-io/logging'
import {
  CommandsMetadataService, CommandActionExecutor, CLIConfigurationService, NodeConsoleLogger,
  ActionResult, ActionResultUtils, SdkProperties,
} from '@salto-io/suitecloud-cli'
import Bottleneck from 'bottleneck'
import osPath from 'path'
import os from 'os'
import _ from 'lodash'
import { v4 as uuidv4 } from 'uuid'
import AsyncLock from 'async-lock'
import wu from 'wu'
import shellQuote from 'shell-quote'
import {
  CONFIG_FEATURES,
  APPLICATION_ID,
  FILE_CABINET_PATH_SEPARATOR,
} from '../constants'
import {
  DEFAULT_FETCH_ALL_TYPES_AT_ONCE, DEFAULT_COMMAND_TIMEOUT_IN_MINUTES,
  DEFAULT_MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST, DEFAULT_CONCURRENCY, SdfClientConfig,
} from '../config'
import { NetsuiteQuery, NetsuiteTypesQueryParams, ObjectID } from '../query'
import { FeaturesDeployError, ManifestValidationError, ObjectsDeployError, SettingsDeployError, MissingManifestFeaturesError } from './errors'
import { SdfCredentials } from './credentials'
import {
  CustomizationInfo, CustomTypeInfo, FailedImport, FailedTypes, FileCustomizationInfo,
  FolderCustomizationInfo, GetCustomObjectsResult, ImportFileCabinetResult, ImportObjectsResult,
  ManifestDependencies, SdfDeployParams, SDFObjectNode,
} from './types'
import { fileCabinetTopLevelFolders } from './constants'
import {
  isCustomTypeInfo, isFileCustomizationInfo, isFolderCustomizationInfo, isTemplateCustomTypeInfo,
  mergeTypeToInstances, getGroupItemFromRegex, toError,
} from './utils'
import { fixManifest } from './manifest_utils'
import { detectLanguage, FEATURE_NAME, fetchLockedObjectErrorRegex, fetchUnexpectedErrorRegex, multiLanguageErrorDetectors, OBJECT_ID } from './language_utils'
import { Graph } from './graph_utils'
import { FileSize, largeFoldersToExclude } from './file_cabinet_utils'
import { reorderDeployXml } from './deploy_xml_utils'
import { OBJECTS_DIR, FILE_CABINET_DIR, ADDITIONAL_FILE_PATTERN, ATTRIBUTES_FILE_SUFFIX, ATTRIBUTES_FOLDER_NAME, FOLDER_ATTRIBUTES_FILE_SUFFIX, READ_CONCURRENCY, convertToXmlContent, parseFeaturesXml, parseFileCabinetDir, parseObjectsDir, convertToFeaturesXmlContent, ACCOUNT_CONFIGURATION_DIR, FEATURES_XML, SRC_DIR, getCustomTypeInfoPath, getFileCabinetCustomInfoPath } from './sdf_parser'

const { makeArray } = collections.array
const { withLimitedConcurrency } = promises.array
const { isDefined } = valuesUtils
const { concatObjects } = lowerdashObjects
const log = logger(module)

const RESPONSE_TYPE_NAME_TO_REAL_NAME: Record<string, string> = {
  csvimport: 'savedcsvimport',
  plugintypeimpl: 'pluginimplementation',
}

export type SdfClientOpts = {
  credentials: SdfCredentials
  config?: SdfClientConfig
  globalLimiter: Bottleneck
  instanceLimiter: (type: string, instanceCount: number) => boolean
}

export const COMMANDS = {
  CREATE_PROJECT: 'project:create',
  SAVE_TOKEN: 'account:savetoken',
  MANAGE_AUTH: 'account:manageauth',
  IMPORT_OBJECTS: 'object:import',
  LIST_OBJECTS: 'object:list',
  LIST_FILES: 'file:list',
  IMPORT_FILES: 'file:import',
  DEPLOY_PROJECT: 'project:deploy',
  VALIDATE_PROJECT: 'project:validate',
  ADD_PROJECT_DEPENDENCIES: 'project:adddependencies',
  IMPORT_CONFIGURATION: 'configuration:import',
}

const ALL = 'ALL'
const ALL_FEATURES = 'FEATURES:ALL_FEATURES'

// e.g. *** ERREUR ***
const fatalErrorMessageRegex = RegExp('^\\*\\*\\*.+\\*\\*\\*$')

export const MINUTE_IN_MILLISECONDS = 1000 * 60
const SINGLE_OBJECT_RETRIES = 3

const baseExecutionPath = os.tmpdir()

const safeQuoteArgument = (argument: unknown): unknown => {
  if (typeof argument === 'string') {
    return shellQuote.quote([argument])
  }
  return argument
}

const writeFileInFolder = async (folderPath: string, filename: string, content: string | Buffer):
  Promise<void> => {
  await mkdirp(folderPath)
  await writeFile(osPath.resolve(folderPath, filename), content)
}

type Project = {
  projectName: string
  projectPath: string
  executor: CommandActionExecutor
  authId: string
  type: 'AccountCustomization' | 'SuiteApp'
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
  private readonly maxItemsInImportObjectsRequest: number
  private readonly sdfConcurrencyLimit: number
  private readonly sdfCallsLimiter: Bottleneck
  private readonly globalLimiter: Bottleneck
  private readonly setupAccountLock: AsyncLock
  private readonly baseCommandExecutor: CommandActionExecutor
  private readonly installedSuiteApps: string[]
  private manifestXmlContent: string
  private deployXmlContent: string
  private readonly instanceLimiter: (type: string, instanceCount: number) => boolean

  constructor({
    credentials,
    config,
    globalLimiter,
    instanceLimiter,
  }: SdfClientOpts) {
    this.globalLimiter = globalLimiter
    this.credentials = credentials
    this.fetchAllTypesAtOnce = config?.fetchAllTypesAtOnce ?? DEFAULT_FETCH_ALL_TYPES_AT_ONCE
    this.maxItemsInImportObjectsRequest = config?.maxItemsInImportObjectsRequest
      ?? DEFAULT_MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST
    this.sdfConcurrencyLimit = config?.sdfConcurrencyLimit ?? DEFAULT_CONCURRENCY
    this.sdfCallsLimiter = new Bottleneck({ maxConcurrent: this.sdfConcurrencyLimit })
    this.setupAccountLock = new AsyncLock()
    this.baseCommandExecutor = SdfClient.initCommandActionExecutor(baseExecutionPath)
    const commandTimeoutInMinutes = config?.fetchTypeTimeoutInMinutes
      ?? DEFAULT_COMMAND_TIMEOUT_IN_MINUTES
    SdkProperties.setCommandTimeout(commandTimeoutInMinutes * MINUTE_IN_MILLISECONDS)
    this.installedSuiteApps = config?.installedSuiteApps ?? []
    this.manifestXmlContent = ''
    this.deployXmlContent = ''
    this.instanceLimiter = instanceLimiter
  }

  @SdfClient.logDecorator
  static async validateCredentials(credentials: SdfCredentials): Promise<AccountId> {
    const netsuiteClient = new SdfClient({
      credentials,
      globalLimiter: new Bottleneck(),
      instanceLimiter: (_t: string, _c: number) => false,
    })
    const { projectName, authId } = await netsuiteClient.initProject()
    await netsuiteClient.projectCleanup(projectName, authId)
    return Promise.resolve(netsuiteClient.credentials.accountId)
  }

  public getCredentials(): Readonly<SdfCredentials> {
    return this.credentials
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
      { call }: decorators.OriginalCall,
    ): Promise<unknown> => {
      try {
        // eslint-disable-next-line @typescript-eslint/return-await
        return await call()
      } catch (e) {
        throw toError(e)
      }
    }
  )

  private async createProject(projectName: string, suiteAppId: string | undefined): Promise<void> {
    const projectPath = osPath.join(baseExecutionPath, projectName)
    const args: Record<string, unknown> = {
      projectname: projectName,
    }
    if (suiteAppId !== undefined) {
      args.type = 'SUITEAPP'
      const splitIndex = suiteAppId.lastIndexOf('.')
      args.publisherid = suiteAppId.slice(0, splitIndex)
      args.projectid = suiteAppId.slice(splitIndex + 1)
      args.projectversion = '1.0.0'
      args.overwrite = true
      args.parentdirectory = osPath.join(baseExecutionPath, suiteAppId)
    } else {
      args.type = 'ACCOUNTCUSTOMIZATION'
      args.parentdirectory = projectPath
    }
    const actionResult = await this.baseCommandExecutor.executeAction({
      commandName: COMMANDS.CREATE_PROJECT,
      runInInteractiveMode: false,
      arguments: args,
    })
    SdfClient.verifySuccessfulAction(actionResult, COMMANDS.CREATE_PROJECT)
    if (suiteAppId !== undefined) {
      // When creating a SuiteApp project, the folder name will always be the suiteAppId
      // (regardless the what we pass in the projectname) so we want to
      // rename it to projectPath.
      await rename(osPath.join(baseExecutionPath, suiteAppId), projectPath)
    }
  }

  private static verifySuccessfulDeploy(data: unknown): void {
    if (!_.isArray(data)) {
      log.warn('suitecloud deploy returned unexpected value: %o', data)
      return
    }

    const dataLines = data.map(line => String(line))
    const errorString = dataLines.join(os.EOL)

    if (dataLines.some(line => fatalErrorMessageRegex.test(line))) {
      log.error('non-thrown sdf error was detected: %o', errorString)
      throw new Error(errorString)
    }

    const detectedLanguage = detectLanguage(errorString)
    const { configureFeatureFailRegex } = multiLanguageErrorDetectors[detectedLanguage]
    const featureDeployFailes = dataLines.filter(line => configureFeatureFailRegex.test(line))
    if (featureDeployFailes.length === 0) return

    log.warn('suitecloud deploy failed to configure the following features: %o', featureDeployFailes)
    const errorIds = featureDeployFailes
      .map(line => line.match(configureFeatureFailRegex)?.groups)
      .filter(isDefined)
      .map(groups => groups[FEATURE_NAME])

    const errorMessage = dataLines
      .filter(line => errorIds.some(id => (new RegExp(`\\b${id}\\b`)).test(line)))
      .join(os.EOL)

    throw new FeaturesDeployError(errorMessage, errorIds)
  }

  private static verifySuccessfulAction(actionResult: ActionResult, commandName: string):
    void {
    if (!actionResult.isSuccess()) {
      log.error(`SDF command ${commandName} has failed.`)
      throw Error(ActionResultUtils.getErrorMessagesString(actionResult))
    }
    if ([
      COMMANDS.DEPLOY_PROJECT,
      COMMANDS.VALIDATE_PROJECT,
    ].includes(commandName)) {
      SdfClient.verifySuccessfulDeploy(actionResult.data)
    }
  }

  private async executeProjectAction(
    commandName: string,
    commandArguments: Values,
    projectCommandActionExecutor: CommandActionExecutor,
  ): Promise<ActionResult> {
    const actionResult = await this.globalLimiter.schedule(
      () => this.sdfCallsLimiter.schedule(() =>
        projectCommandActionExecutor.executeAction({
          commandName,
          runInInteractiveMode: false,
          arguments: commandArguments,
        }))
    )
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
    const setupCommandArguments = {
      authid: authId,
      account: this.credentials.accountId,
      tokenid: this.credentials.tokenId,
      tokensecret: this.credentials.tokenSecret,
    }
    const safeArguments: Values = _.mapValues(setupCommandArguments, safeQuoteArgument)
    await this.withAuthIdsLock(async () => {
      log.debug(`Setting up account using authId: ${authId}`)
      try {
        await this.executeProjectAction(
          COMMANDS.SAVE_TOKEN,
          safeArguments,
          projectCommandActionExecutor
        )
      } catch (e) {
        log.warn(`Failed to setup account using authId: ${authId}`, e)
        log.debug(`Retrying to setup account using authId: ${authId}`)
        await this.executeProjectAction(
          COMMANDS.SAVE_TOKEN,
          setupCommandArguments,
          projectCommandActionExecutor
        )
      }
    })
  }

  private async initProject(suiteAppId?: string): Promise<Project> {
    const authId = uuidv4()
    const projectName = `sdf-${authId}`
    await this.createProject(projectName, suiteAppId)
    const projectPath = SdfClient.getProjectPath(projectName)
    const executor = SdfClient
      .initCommandActionExecutor(projectPath)
    await this.setupAccount(executor, authId)
    return { projectName, projectPath, executor, authId, type: suiteAppId !== undefined ? 'SuiteApp' : 'AccountCustomization' }
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
    if (typeNames.concat(CONFIG_FEATURES).every(type => !query.isTypeMatch(type))) {
      return {
        elements: [],
        failedToFetchAllAtOnce: false,
        failedTypes: { unexpectedError: {}, lockedError: {} },
      }
    }

    log.debug(`Running getCustomObjects with the following suiteApps ids: ${this.installedSuiteApps.join(', ')}`)
    const importResult = await Promise.all(
      [undefined, ...this.installedSuiteApps]
        .map(async suiteAppId => {
          const { executor, projectName, authId } = await this.initProject()
          const { failedTypes, failedToFetchAllAtOnce } = await this.importObjects(
            executor,
            typeNames,
            query,
            suiteAppId,
          )
          const elements = await parseObjectsDir(SdfClient.getObjectsDirPath(projectName))

          if (suiteAppId !== undefined) {
            elements.forEach(e => { e.values[APPLICATION_ID] = suiteAppId })
          }
          if (suiteAppId === undefined && query.isTypeMatch(CONFIG_FEATURES)) {
            // use existing project to import features object
            const { typeName, values } = await this.getFeaturesObject(executor, projectName)
            elements.push({
              scriptId: typeName,
              typeName,
              values,
            })
          }
          await this.projectCleanup(projectName, authId)

          return { elements, failedToFetchAllAtOnce, failedTypes }
        })
    )

    const failedTypes = {
      unexpectedError: concatObjects(
        importResult.map(res => res.failedTypes.unexpectedError)
      ),
      lockedError: concatObjects(
        importResult.map(res => res.failedTypes.lockedError)
      ),
    }

    const elements = importResult.flatMap(res => res.elements)
    const failedToFetchAllAtOnce = importResult.some(res => res.failedToFetchAllAtOnce)

    return { elements, failedToFetchAllAtOnce, failedTypes }
  }

  private async getFeaturesObject(
    executor: CommandActionExecutor,
    projectName: string,
  ): Promise<CustomizationInfo> {
    try {
      await this.executeProjectAction(
        COMMANDS.IMPORT_CONFIGURATION, { configurationid: ALL_FEATURES }, executor
      )
      const featuresObject = await parseFeaturesXml(SdfClient.getFeaturesXmlPath(projectName))
      return featuresObject
    } catch (e) {
      log.error('Attempt to import features object has failed with error: %o', e)
      return { typeName: CONFIG_FEATURES, values: { feature: [] } }
    }
  }

  private async importObjects(
    executor: CommandActionExecutor,
    typeNames: string[],
    query: NetsuiteQuery,
    suiteAppId: string | undefined,
  ): Promise<{
    failedToFetchAllAtOnce: boolean
    failedTypes: FailedTypes
  }> {
    const importAllAtOnce = async (): Promise<FailedTypes | undefined> => {
      log.debug(`Fetching all custom objects at once with suiteApp: ${suiteAppId}`)
      try {
        // When fetchAllAtOnce we use the below heuristic in order to define a proper timeout,
        // instead of adding another configuration value
        return await this.runImportObjectsCommand(executor, ALL, ALL, suiteAppId)
      } catch (e) {
        log.warn(`Attempt to fetch all custom objects has failed with suiteApp: ${suiteAppId}`)
        log.warn(toError(e))
        return undefined
      }
    }

    if (this.fetchAllTypesAtOnce) {
      const failedTypes = await importAllAtOnce()
      if (failedTypes !== undefined) {
        return { failedToFetchAllAtOnce: false, failedTypes }
      }
    }
    const failedTypes = await this.importObjectsInChunks(
      executor,
      typeNames,
      query,
      suiteAppId,
    )
    return { failedToFetchAllAtOnce: this.fetchAllTypesAtOnce, failedTypes }
  }

  private async importObjectsInChunks(
    executor: CommandActionExecutor,
    typeNames: string[],
    query: NetsuiteQuery,
    suiteAppId: string | undefined,
  ): Promise<FailedTypes> {
    const importObjectsChunk = async (
      { type, ids, index, total }: ObjectsChunk, retriesLeft = SINGLE_OBJECT_RETRIES
    ): Promise<FailedTypes> => {
      const retryFetchFailedInstances = async (
        failedInstancesIds: string[]
      ): Promise<FailedTypes> => {
        log.debug('Retrying to fetch failed instances with suiteApp: %s of chunk %d/%d of type %s: %o',
          suiteAppId, index, total, type, failedInstancesIds)
        const failedTypeToInstancesAfterRetry = await this.runImportObjectsCommand(
          executor, type, failedInstancesIds.join(' '), suiteAppId
        )
        log.debug('Retried to fetch %d failed instances with suiteApp: %s of chunk %d/%d of type: %s.',
          failedInstancesIds.length, suiteAppId, index, total, type)
        return failedTypeToInstancesAfterRetry
      }

      try {
        log.debug('Starting to fetch chunk %d/%d with %d objects of type: %s with SuiteApp %s', index, total, ids.length, type, suiteAppId)
        let failedTypeToInstances = await this.runImportObjectsCommand(
          executor, type, ids.join(' '), suiteAppId
        )
        if (failedTypeToInstances.unexpectedError[type]?.length > 0) {
          failedTypeToInstances = {
            unexpectedError: (await retryFetchFailedInstances(
              failedTypeToInstances.unexpectedError[type]
            )).unexpectedError,
            lockedError: failedTypeToInstances.lockedError,
          }
        }
        log.debug('Fetched chunk %d/%d with %d objects of type: %s with suiteApp: %s. failedTypes: %o',
          index, total, ids.length, type, suiteAppId, failedTypeToInstances)
        return failedTypeToInstances
      } catch (e) {
        log.warn('Failed to fetch chunk %d/%d with %d objects of type: %s with suiteApp: %s', index, total, ids.length, type, suiteAppId)
        log.warn(toError(e))
        const [objectId] = ids
        if (retriesLeft === 0) {
          throw new Error(`Failed to fetch object '${objectId}' of type '${type}' with error: ${toError(e).message}. Exclude it and fetch again.`)
        }
        if (ids.length === 1) {
          log.debug('Retrying to fetch chunk %d/%d with a single object \'%s\' of type: %s. %d retries left', index, total, objectId, type, retriesLeft - 1)
          return importObjectsChunk({ type, ids, index, total }, retriesLeft - 1)
        }
        log.debug('Retrying to fetch chunk %d/%d with %d objects of type: %s with smaller chunks', index, total, ids.length, type)
        const middle = (ids.length + 1) / 2
        const results = await Promise.all([
          importObjectsChunk({ type, ids: ids.slice(0, middle), index, total }),
          importObjectsChunk({ type, ids: ids.slice(middle, ids.length), index, total }),
        ])
        return {
          lockedError: mergeTypeToInstances(...results.map(res => res.lockedError)),
          unexpectedError: mergeTypeToInstances(...results.map(res => res.unexpectedError)),
        }
      }
    }

    const instancesIds = (await this.listInstances(
      executor,
      typeNames.filter(query.isTypeMatch),
      suiteAppId,
    )).filter(query.isObjectMatch)

    const instancesIdsByType = _.groupBy(instancesIds, id => id.type)

    const excludedTypes: string[] = []
    const filterLargeTypes = ([type, instances]: [string, ObjectID[]]): boolean => {
      if (this.instanceLimiter(type, instances.length)) {
        excludedTypes.push(type)
        return false
      }
      return true
    }

    const idsChunks = Object.entries(instancesIdsByType)
      .filter(filterLargeTypes)
      .flatMap(([type, ids]: [string, ObjectID[]]) =>
        wu(ids)
          .map(id => id.instanceId)
          .chunk(this.maxItemsInImportObjectsRequest)
          .enumerate()
          .map(([chunk, index]) => ({
            type,
            ids: chunk,
            index: index + 1,
            total: Math.ceil(ids.length / this.maxItemsInImportObjectsRequest),
          }))
          .toArray())

    log.debug('Fetching custom objects by types in chunks')
    const results = await withLimitedConcurrency( // limit the number of open promises
      idsChunks.map(idsChunk => () => importObjectsChunk(idsChunk)),
      this.sdfConcurrencyLimit
    )
    return {
      lockedError: mergeTypeToInstances(...results.map(res => res.lockedError)),
      unexpectedError: mergeTypeToInstances(...results.map(res => res.unexpectedError)),
      excludedTypes,
    }
  }

  private static createFailedImportsMap(failedImports: FailedImport[]): NetsuiteTypesQueryParams {
    return _(failedImports)
      .groupBy(failedImport => SdfClient.fixTypeName(failedImport.customObject.type))
      .mapValues(failedImportsGroup => failedImportsGroup.map(
        failedImport => failedImport.customObject.id
      ))
      .value()
  }

  private async runImportObjectsCommand(
    executor: CommandActionExecutor,
    type: string,
    scriptIds: string,
    suiteAppId: string | undefined,
  ): Promise<FailedTypes> {
    const actionResult = await this.executeProjectAction(
      COMMANDS.IMPORT_OBJECTS,
      {
        destinationfolder: `${FILE_CABINET_PATH_SEPARATOR}${OBJECTS_DIR}`,
        type,
        scriptid: scriptIds,
        maxItemsInImportObjectsRequest: this.maxItemsInImportObjectsRequest,
        excludefiles: true,
        appid: suiteAppId,
      },
      executor,
    )
    const importResult = actionResult.data as ImportObjectsResult

    const unexpectedError = SdfClient.createFailedImportsMap(importResult.failedImports
      .filter(failedImport => {
        if (fetchUnexpectedErrorRegex.test(failedImport.customObject.result.message)) {
          log.debug('Failed to fetch (%s) instance with id (%s) due to SDF unexpected error',
            SdfClient.fixTypeName(failedImport.customObject.type), failedImport.customObject.id)
          return true
        }
        return false
      }))

    const lockedError = SdfClient.createFailedImportsMap(importResult.failedImports
      .filter(failedImport => {
        if (fetchLockedObjectErrorRegex.test(failedImport.customObject.result.message)) {
          log.debug('Failed to fetch (%s) instance with id (%s) due to the instance being locked',
            SdfClient.fixTypeName(failedImport.customObject.type), failedImport.customObject.id)
          return true
        }
        return false
      }))

    return { unexpectedError, lockedError }
  }

  private static fixTypeName(typeName: string): string {
    // For some type names, SDF might return different names in its
    // response, so we replace it with the original name
    return RESPONSE_TYPE_NAME_TO_REAL_NAME[typeName] ?? typeName
  }

  async listInstances(
    executor: CommandActionExecutor,
    types: string[],
    suiteAppId: string | undefined
  ): Promise<ObjectID[]> {
    const results = await this.executeProjectAction(
      COMMANDS.LIST_OBJECTS,
      {
        type: types.join(' '),
        appid: suiteAppId,
      },
      executor,
    )
    return results.data.map(({ type, scriptId }: { type: string; scriptId: string }) => ({
      type: SdfClient.fixTypeName(type),
      instanceId: scriptId,
    }))
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
              failedPaths.push(`^${folder}.*`)
              return undefined
            }))
    )).filter(isDefined)
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
        log.error(`Failed to import file ${filePaths[0]} due to: ${toError(e).message}`)
        throw new Error(`Failed to import file: ${filePaths[0]}. Consider adding it to the skip list. To learn more visit https://github.com/salto-io/salto/blob/main/packages/netsuite-adapter/config_doc.md`)
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
  async importFileCabinetContent(query: NetsuiteQuery, maxFileCabinetSizeInGB: number):
    Promise<ImportFileCabinetResult> {
    if (!query.areSomeFilesMatch()) {
      return {
        elements: [],
        failedPaths: { lockedError: [], otherError: [], largeFolderError: [] },
      }
    }

    const filesToSize = async (
      filePaths: string[],
      fileCabinetDirPath: string
    ): Promise<FileSize[]> => {
      const normalizedPath = (filePath: string): string => {
        const filePathParts = filePath.split(FILE_CABINET_PATH_SEPARATOR)
        return osPath.join(fileCabinetDirPath, ...filePathParts)
      }

      return withLimitedConcurrency(
        filePaths.map(path => async () => ({ path, size: (await stat(normalizedPath(path))).size })),
        READ_CONCURRENCY
      )
    }

    const project = await this.initProject()
    const listFilesResults = await this.listFilePaths(project.executor)
    const filePathsToImport = listFilesResults.listedPaths
      .filter(path => query.isFileMatch(path))
    const importFilesResult = await this.importFiles(filePathsToImport, project.executor)
    // folder attributes file is returned multiple times
    const importedPaths = _.uniq(importFilesResult)

    const fileCabinetDirPath = SdfClient.getFileCabinetDirPath(project.projectName)
    const largeFolders: string[] = [] // largeFoldersToExclude(
    largeFoldersToExclude(
      await filesToSize(importedPaths, fileCabinetDirPath), maxFileCabinetSizeInGB
    )
    const listedPaths = importedPaths // Salto 3853: Will change to filtered files on full deployment
    // const listedPaths = filterFilesInFolders(importedPaths, largeFolders)
    const elements = await parseFileCabinetDir(fileCabinetDirPath, listedPaths)
    await this.projectCleanup(project.projectName, project.authId)
    return {
      elements,
      failedPaths: {
        lockedError: [],
        otherError: listFilesResults.failedPaths,
        largeFolderError: largeFolders,
      },
    }
  }

  @SdfClient.logDecorator
  async deploy(
    suiteAppId: string | undefined,
    { manifestDependencies, validateOnly = false }: SdfDeployParams,
    dependencyGraph: Graph<SDFObjectNode>
  ): Promise<void> {
    const project = await this.initProject(suiteAppId)
    const srcDirPath = SdfClient.getSrcDirPath(project.projectName)
    const fileCabinetDirPath = SdfClient.getFileCabinetDirPath(project.projectName)
    const customizationInfos = Array.from(dependencyGraph.nodes.values()).map(node => node.value.customizationInfo)
    // Delete the default FileCabinet folder to prevent permissions error
    await rm(fileCabinetDirPath)
    await Promise.all(customizationInfos.map(async customizationInfo => {
      if (customizationInfo.typeName === CONFIG_FEATURES) {
        return SdfClient.addFeaturesObjectToProject(customizationInfo, project.projectName)
      }
      if (isCustomTypeInfo(customizationInfo)) {
        return SdfClient.addCustomTypeInfoToProject(customizationInfo, srcDirPath)
      }
      if (isFileCustomizationInfo(customizationInfo)) {
        return SdfClient.addFileInfoToProject(customizationInfo, srcDirPath)
      }
      if (isFolderCustomizationInfo(customizationInfo)) {
        return SdfClient.addFolderInfoToProject(customizationInfo, srcDirPath)
      }
      throw new Error(`Failed to deploy invalid customizationInfo: ${customizationInfo}`)
    }))
    await this.runDeployCommands(project, customizationInfos, manifestDependencies, validateOnly, dependencyGraph)
    await this.projectCleanup(project.projectName, project.authId)
  }

  private async fixManifest(
    projectName: string,
    customizationInfos: CustomizationInfo[],
    manifestDependencies: ManifestDependencies
  ): Promise<void> {
    const manifestPath = SdfClient.getManifestFilePath(projectName)
    const manifestContent = (await readFile(manifestPath)).toString()
    this.manifestXmlContent = fixManifest(manifestContent, customizationInfos, manifestDependencies)
    await writeFile(
      manifestPath,
      this.manifestXmlContent
    )
  }

  private async fixDeployXml(
    dependencyGraph: Graph<SDFObjectNode>,
    projectName: string,
  ): Promise<void> {
    const deployFilePath = SdfClient.getDeployFilePath(projectName)
    const deployXmlContent = (await readFile(deployFilePath)).toString()
    this.deployXmlContent = reorderDeployXml(deployXmlContent, dependencyGraph)
    await writeFile(
      deployFilePath,
      this.deployXmlContent
    )
  }

  private customizeDeployError(error: Error): Error {
    if (error instanceof FeaturesDeployError) {
      return error
    }

    const errorMessage = error.message
    const sdfLanguage = detectLanguage(errorMessage)
    const {
      settingsValidationErrorRegex,
      manifestErrorDetailsRegex,
      objectValidationErrorRegex,
      missingFeatureErrorRegex,
      deployedObjectRegex,
      errorObjectRegex,
    } = multiLanguageErrorDetectors[sdfLanguage]
    const manifestErrorScriptids = getGroupItemFromRegex(errorMessage, manifestErrorDetailsRegex, OBJECT_ID)
    if (manifestErrorScriptids.length > 0) {
      return new ManifestValidationError(errorMessage, manifestErrorScriptids)
    }
    const missingFeatureNames = missingFeatureErrorRegex
      .flatMap(regex => getGroupItemFromRegex(errorMessage, regex, FEATURE_NAME))
    if (missingFeatureNames.length > 0) {
      return new MissingManifestFeaturesError(errorMessage, _.uniq(missingFeatureNames))
    }
    const validationErrorObjects = getGroupItemFromRegex(
      errorMessage, objectValidationErrorRegex, OBJECT_ID
    )
    if (validationErrorObjects.length > 0) {
      return new ObjectsDeployError(errorMessage, new Set(validationErrorObjects))
    }
    if (settingsValidationErrorRegex.test(errorMessage) && errorMessage.includes(FEATURES_XML)) {
      return new SettingsDeployError(errorMessage, new Set([CONFIG_FEATURES]))
    }
    const errorObject = errorMessage.match(errorObjectRegex)?.groups?.[OBJECT_ID]
    if (errorObject !== undefined) {
      return new ObjectsDeployError(errorMessage, new Set([errorObject]))
    }
    const allDeployedObjects = getGroupItemFromRegex(
      errorMessage, deployedObjectRegex, OBJECT_ID
    )
    if (allDeployedObjects.length > 0) {
      // the last object in the error message is the one that failed the deploy
      return new ObjectsDeployError(errorMessage, new Set([allDeployedObjects.slice(-1)[0]]))
    }

    log.warn(`
could not detect the reason for this sdf error.
manifest.xml:
${this.manifestXmlContent}

deploy.xml:
${this.deployXmlContent}
`)
    return error
  }

  private async runDeployCommands(
    { executor, projectName, type }: Project,
    customizationInfos: CustomizationInfo[],
    manifestDependencies: ManifestDependencies,
    validateOnly: boolean,
    dependencyGraph: Graph<SDFObjectNode>,
  ): Promise<void> {
    await this.executeProjectAction(COMMANDS.ADD_PROJECT_DEPENDENCIES, {}, executor)
    await this.fixManifest(projectName, customizationInfos, manifestDependencies)
    await this.fixDeployXml(dependencyGraph, projectName)
    try {
      const custCommandArguments = {
        ...(type === 'AccountCustomization' ? { accountspecificvalues: 'WARNING' } : {}),
        ...(validateOnly ? { server: true } : {}),
      }
      await this.executeProjectAction(
        validateOnly ? COMMANDS.VALIDATE_PROJECT : COMMANDS.DEPLOY_PROJECT,
        // SuiteApp project type can't contain account specific values
        // and thus the flag is not supported
        custCommandArguments,
        executor
      )
    } catch (e) {
      throw this.customizeDeployError(toError(e))
    }
  }

  private static async addCustomTypeInfoToProject(customTypeInfo: CustomTypeInfo,
    srcDirPath: string): Promise<void> {
    await writeFile(
      getCustomTypeInfoPath(srcDirPath, customTypeInfo),
      convertToXmlContent(customTypeInfo)
    )
    if (isTemplateCustomTypeInfo(customTypeInfo)) {
      await writeFile(getCustomTypeInfoPath(srcDirPath,
        customTypeInfo, `${ADDITIONAL_FILE_PATTERN}${customTypeInfo.fileExtension}`),
      customTypeInfo.fileContent)
    }
  }

  private static async addFeaturesObjectToProject(
    customizationInfo: CustomizationInfo,
    projectName: string
  ): Promise<void> {
    await writeFile(
      SdfClient.getFeaturesXmlPath(projectName),
      convertToFeaturesXmlContent(customizationInfo)
    )
  }

  private static async addFileInfoToProject(fileCustomizationInfo: FileCustomizationInfo,
    srcDirPath: string): Promise<void> {
    const attrsFilename = fileCustomizationInfo.path.slice(-1)[0] + ATTRIBUTES_FILE_SUFFIX
    const fileFolderPath = getFileCabinetCustomInfoPath(srcDirPath, fileCustomizationInfo)
    const attrsFolderPath = osPath.resolve(
      fileFolderPath, ATTRIBUTES_FOLDER_NAME
    )
    const filename = fileCustomizationInfo.path.slice(-1)[0]
    await Promise.all([
      writeFileInFolder(fileFolderPath, filename, fileCustomizationInfo.fileContent),
      writeFileInFolder(attrsFolderPath, attrsFilename, convertToXmlContent(fileCustomizationInfo)),
    ])
  }

  private static async addFolderInfoToProject(folderCustomizationInfo: FolderCustomizationInfo,
    srcDirPath: string): Promise<void> {
    const attrsFolderPath = osPath.resolve(
      getFileCabinetCustomInfoPath(srcDirPath, folderCustomizationInfo), ATTRIBUTES_FOLDER_NAME
    )
    await writeFileInFolder(attrsFolderPath, FOLDER_ATTRIBUTES_FILE_SUFFIX,
      convertToXmlContent(folderCustomizationInfo))
  }

  private static getProjectPath(projectName: string): string {
    return osPath.resolve(baseExecutionPath, projectName)
  }

  private static getSrcDirPath(projectName: string): string {
    return osPath.resolve(SdfClient.getProjectPath(projectName), SRC_DIR)
  }

  private static getObjectsDirPath(projectName: string): string {
    return osPath.resolve(SdfClient.getProjectPath(projectName), SRC_DIR, OBJECTS_DIR)
  }

  private static getFileCabinetDirPath(projectName: string): string {
    return osPath.resolve(SdfClient.getProjectPath(projectName), SRC_DIR, FILE_CABINET_DIR)
  }

  private static getManifestFilePath(projectName: string): string {
    return osPath.resolve(SdfClient.getProjectPath(projectName), SRC_DIR, 'manifest.xml')
  }

  private static getDeployFilePath(projectName: string): string {
    return osPath.resolve(SdfClient.getProjectPath(projectName), SRC_DIR, 'deploy.xml')
  }

  private static getFeaturesXmlPath(projectName: string): string {
    return osPath.resolve(
      SdfClient.getProjectPath(projectName),
      SRC_DIR,
      ACCOUNT_CONFIGURATION_DIR,
      FEATURES_XML
    )
  }
}
