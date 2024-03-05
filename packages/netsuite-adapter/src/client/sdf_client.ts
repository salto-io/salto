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
import {
  collections,
  decorators,
  objects as lowerdashObjects,
  promises,
  values as valuesUtils,
} from '@salto-io/lowerdash'
import { Values, AccountInfo } from '@salto-io/adapter-api'
import { mkdirp, readFile, writeFile, rm, stat, rename } from '@salto-io/file'
import { logger } from '@salto-io/logging'
import {
  CommandsMetadataService,
  CommandActionExecutor,
  CLIConfigurationService,
  NodeConsoleLogger,
  ActionResult,
  ActionResultUtils,
  SdkProperties,
} from '@salto-io/suitecloud-cli'
import Bottleneck from 'bottleneck'
import osPath from 'path'
import os from 'os'
import _ from 'lodash'
import { v4 as uuidv4 } from 'uuid'
import AsyncLock from 'async-lock'
import wu from 'wu'
import shellQuote from 'shell-quote'
import { CONFIG_FEATURES, APPLICATION_ID, FILE_CABINET_PATH_SEPARATOR } from '../constants'
import {
  DEFAULT_FETCH_ALL_TYPES_AT_ONCE,
  DEFAULT_COMMAND_TIMEOUT_IN_MINUTES,
  DEFAULT_MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST,
  DEFAULT_CONCURRENCY,
} from '../config/constants'
import { ClientConfig, InstanceLimiterFunc, NetsuiteTypesQueryParams, ObjectID } from '../config/types'
import { NetsuiteFetchQueries, NetsuiteQuery } from '../config/query'
import {
  FeaturesDeployError,
  ManifestValidationError,
  ObjectsDeployError,
  SettingsDeployError,
  MissingManifestFeaturesError,
  getFailedObjectsMap,
  getFailedObjects,
} from './errors'
import { SdfCredentials } from './credentials'
import {
  CustomizationInfo,
  CustomTypeInfo,
  FailedImport,
  FailedTypes,
  FileCustomizationInfo,
  FolderCustomizationInfo,
  GetCustomObjectsResult,
  ImportFileCabinetResult,
  ImportObjectsResult,
  ManifestDependencies,
  SdfDeployParams,
  SDFObjectNode,
} from './types'
import { fileCabinetTopLevelFolders } from './constants'
import {
  isCustomTypeInfo,
  isFileCustomizationInfo,
  isFolderCustomizationInfo,
  isTemplateCustomTypeInfo,
  mergeTypeToInstances,
  getGroupItemFromRegex,
  toError,
  sliceMessagesByRegex,
} from './utils'
import { fixManifest } from './manifest_utils'
import {
  detectLanguage,
  FEATURE_NAME,
  fetchLockedObjectErrorRegex,
  fetchUnexpectedErrorRegex,
  multiLanguageErrorDetectors,
  OBJECT_ID,
} from './language_utils'
import { Graph } from './graph_utils'
import { FileSize, filterFilesInFolders, largeFoldersToExclude } from './file_cabinet_utils'
import { reorderDeployXml } from './deploy_xml_utils'
import {
  OBJECTS_DIR,
  ADDITIONAL_FILE_PATTERN,
  ATTRIBUTES_FILE_SUFFIX,
  ATTRIBUTES_FOLDER_NAME,
  FOLDER_ATTRIBUTES_FILE_SUFFIX,
  READ_CONCURRENCY,
  convertToXmlContent,
  parseFeaturesXml,
  parseFileCabinetDir,
  parseObjectsDir,
  convertToFeaturesXmlContent,
  getCustomTypeInfoPath,
  getFileCabinetCustomInfoPath,
  getFileCabinetDirPath,
  getSrcDirPath,
  getDeployFilePath,
  getManifestFilePath,
  getFeaturesXmlPath,
  FEATURES_XML,
} from './sdf_parser'

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
  config?: ClientConfig
  globalLimiter: Bottleneck
  instanceLimiter: InstanceLimiterFunc
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
export const ALL_FEATURES = 'FEATURES:ALL_FEATURES'

// e.g. *** ERREUR ***
const fatalErrorMessageRegex = RegExp('^\\*\\*\\*.+\\*\\*\\*$')

export const MINUTE_IN_MILLISECONDS = 1000 * 60
const SINGLE_OBJECT_RETRIES = 3

const baseExecutionPath = os.tmpdir()

export const safeQuoteArgument = (argument: unknown): unknown => {
  if (typeof argument === 'string') {
    return shellQuote.quote([argument])
  }
  return argument
}

const writeFileInFolder = async (folderPath: string, filename: string, content: string | Buffer): Promise<void> => {
  await mkdirp(folderPath)
  await writeFile(osPath.resolve(folderPath, filename), content)
}

type Project = {
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
  private readonly instanceLimiter: InstanceLimiterFunc

  constructor({ credentials, config, globalLimiter, instanceLimiter }: SdfClientOpts) {
    this.globalLimiter = globalLimiter
    this.credentials = credentials
    this.fetchAllTypesAtOnce = config?.fetchAllTypesAtOnce ?? DEFAULT_FETCH_ALL_TYPES_AT_ONCE
    this.maxItemsInImportObjectsRequest =
      config?.maxItemsInImportObjectsRequest ?? DEFAULT_MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST
    this.sdfConcurrencyLimit = config?.sdfConcurrencyLimit ?? DEFAULT_CONCURRENCY
    this.sdfCallsLimiter = new Bottleneck({ maxConcurrent: this.sdfConcurrencyLimit })
    this.setupAccountLock = new AsyncLock()
    this.baseCommandExecutor = SdfClient.initCommandActionExecutor(baseExecutionPath)
    const commandTimeoutInMinutes = config?.fetchTypeTimeoutInMinutes ?? DEFAULT_COMMAND_TIMEOUT_IN_MINUTES
    SdkProperties.setCommandTimeout(commandTimeoutInMinutes * MINUTE_IN_MILLISECONDS)
    this.installedSuiteApps = config?.installedSuiteApps ?? []
    this.manifestXmlContent = ''
    this.deployXmlContent = ''
    this.instanceLimiter = instanceLimiter
  }

  @SdfClient.logDecorator
  static async validateCredentials(credentials: SdfCredentials): Promise<AccountInfo> {
    const netsuiteClient = new SdfClient({
      credentials,
      globalLimiter: new Bottleneck(),
      instanceLimiter: () => false,
    })
    const { projectPath, authId } = await netsuiteClient.initProject()
    await netsuiteClient.projectCleanup(projectPath, authId)
    const { accountId } = netsuiteClient.credentials
    return { accountId }
  }

  public getCredentials(): Readonly<SdfCredentials> {
    return this.credentials
  }

  public static initCommandActionExecutor(executionPath: string): CommandActionExecutor {
    return new CommandActionExecutor({
      executionPath,
      cliConfigurationService: new CLIConfigurationService(),
      commandsMetadataService: new CommandsMetadataService(),
      log: NodeConsoleLogger,
    })
  }

  private static logDecorator = decorators.wrapMethodWith(
    async ({ call }: decorators.OriginalCall): Promise<unknown> => {
      try {
        // eslint-disable-next-line @typescript-eslint/return-await
        return await call()
      } catch (e) {
        throw toError(e)
      }
    },
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
      .filter(line => errorIds.some(id => new RegExp(`\\b${id}\\b`).test(line)))
      .join(os.EOL)

    throw new FeaturesDeployError(errorMessage, errorIds)
  }

  private static verifySuccessfulAction(actionResult: ActionResult, commandName: string): void {
    if (!actionResult.isSuccess()) {
      log.error(`SDF command ${commandName} has failed.`)
      throw Error(ActionResultUtils.getErrorMessagesString(actionResult))
    }
    if ([COMMANDS.DEPLOY_PROJECT, COMMANDS.VALIDATE_PROJECT].includes(commandName)) {
      SdfClient.verifySuccessfulDeploy(actionResult.data)
    }
  }

  private async executeProjectAction(
    commandName: string,
    commandArguments: Values,
    projectCommandActionExecutor: CommandActionExecutor,
  ): Promise<ActionResult> {
    const actionResult = await this.sdfCallsLimiter.schedule(() =>
      this.globalLimiter.schedule(() =>
        projectCommandActionExecutor.executeAction({
          commandName,
          runInInteractiveMode: false,
          arguments: commandArguments,
        }),
      ),
    )
    SdfClient.verifySuccessfulAction(actionResult, commandName)
    return actionResult
  }

  // The SDF Java SDK has a race when accessing the authIds file concurrently that causes it to
  // override credentials so we have to make sure we never call auth related operations concurrently
  private async withAuthIdsLock(fn: () => Promise<void>): Promise<void> {
    await this.setupAccountLock.acquire('authIdManipulation', fn)
  }

  protected async setupAccount(projectCommandActionExecutor: CommandActionExecutor, authId: string): Promise<void> {
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
        await this.executeProjectAction(COMMANDS.SAVE_TOKEN, safeArguments, projectCommandActionExecutor)
      } catch (e) {
        log.warn(`Failed to setup account using authId: ${authId}`, e)
        log.debug(`Retrying to setup account using authId: ${authId}`)
        await this.executeProjectAction(COMMANDS.SAVE_TOKEN, setupCommandArguments, projectCommandActionExecutor)
      }
    })
  }

  private async initProject(suiteAppId?: string): Promise<Project> {
    const authId = uuidv4()
    const projectName = `sdf-${authId}`
    await this.createProject(projectName, suiteAppId)
    const projectPath = osPath.resolve(baseExecutionPath, projectName)
    const executor = SdfClient.initCommandActionExecutor(projectPath)
    await this.setupAccount(executor, authId)
    return { projectPath, executor, authId, type: suiteAppId !== undefined ? 'SuiteApp' : 'AccountCustomization' }
  }

  private static async deleteProject(projectPath: string): Promise<void> {
    log.debug(`Deleting SDF project: ${osPath.basename(projectPath)}`)
    await rm(projectPath)
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

  private async projectCleanup(projectPath: string, authId: string): Promise<void> {
    await Promise.all([SdfClient.deleteProject(projectPath), this.deleteAuthId(authId)])
  }

  @SdfClient.logDecorator
  async getCustomObjects(typeNames: string[], queries: NetsuiteFetchQueries): Promise<GetCustomObjectsResult> {
    // in case of partial fetch we'd need to proceed in order to calculate deleted elements
    if (typeNames.concat(CONFIG_FEATURES).every(type => !queries.originFetchQuery.isTypeMatch(type))) {
      return {
        elements: [],
        instancesIds: [],
        failedToFetchAllAtOnce: false,
        failedTypes: { unexpectedError: {}, lockedError: {}, excludedTypes: [] },
      }
    }

    log.debug(`Running getCustomObjects with the following suiteApps ids: ${this.installedSuiteApps.join(', ')}`)
    const importResult = await Promise.all(
      [undefined, ...this.installedSuiteApps].map(async suiteAppId => {
        const { executor, projectPath, authId } = await this.initProject()
        const instancesIds = await this.listInstances(
          executor,
          typeNames.filter(queries.originFetchQuery.isTypeMatch),
          suiteAppId,
        )
        const { failedTypes, failedToFetchAllAtOnce } = await this.importObjects(
          executor,
          suiteAppId,
          instancesIds.filter(queries.updatedFetchQuery.isObjectMatch),
        )
        const elements = await parseObjectsDir(projectPath)

        if (suiteAppId !== undefined) {
          elements.forEach(e => {
            e.values[APPLICATION_ID] = suiteAppId
          })
        }
        if (suiteAppId === undefined && queries.updatedFetchQuery.isTypeMatch(CONFIG_FEATURES)) {
          // use existing project to import features object
          const { typeName, values } = await this.getFeaturesObject(executor, projectPath)
          elements.push({
            scriptId: typeName,
            typeName,
            values,
          })
        }
        await this.projectCleanup(projectPath, authId)

        return { elements, instancesIds, failedToFetchAllAtOnce, failedTypes }
      }),
    )

    const failedTypes = {
      unexpectedError: concatObjects(importResult.map(res => res.failedTypes.unexpectedError)),
      lockedError: concatObjects(importResult.map(res => res.failedTypes.lockedError)),
      excludedTypes: importResult.flatMap(res => res.failedTypes.excludedTypes),
    }

    const elements = importResult.flatMap(res => res.elements)
    const failedToFetchAllAtOnce = importResult.some(res => res.failedToFetchAllAtOnce)
    const instancesIds = importResult.flatMap(res => res.instancesIds)

    return { elements, instancesIds, failedToFetchAllAtOnce, failedTypes }
  }

  private async getFeaturesObject(executor: CommandActionExecutor, projectPath: string): Promise<CustomizationInfo> {
    try {
      await this.executeProjectAction(COMMANDS.IMPORT_CONFIGURATION, { configurationid: ALL_FEATURES }, executor)
    } catch (e) {
      log.error('Attempt to import features object has failed with error: %o', e)
      throw e
    }
    const featuresObject = await parseFeaturesXml(projectPath)
    if (featuresObject === undefined) {
      log.error('Could not find features object in project path %s', projectPath)
      throw new Error('Could not find features object in project')
    }
    return featuresObject
  }

  private async importObjects(
    executor: CommandActionExecutor,
    suiteAppId: string | undefined,
    instancesIds: ObjectID[],
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
    const failedTypes = await this.importObjectsInChunks(executor, suiteAppId, instancesIds)
    return { failedToFetchAllAtOnce: this.fetchAllTypesAtOnce, failedTypes }
  }

  private async importObjectsInChunks(
    executor: CommandActionExecutor,
    suiteAppId: string | undefined,
    instancesIds: ObjectID[],
  ): Promise<FailedTypes> {
    const importObjectsChunk = async (
      { type, ids, index, total }: ObjectsChunk,
      retriesLeft = SINGLE_OBJECT_RETRIES,
    ): Promise<FailedTypes> => {
      const retryFetchFailedInstances = async (failedInstancesIds: string[]): Promise<FailedTypes> => {
        log.debug(
          'Retrying to fetch failed instances with suiteApp: %s of chunk %d/%d of type %s: %o',
          suiteAppId,
          index,
          total,
          type,
          failedInstancesIds,
        )
        const failedTypeToInstancesAfterRetry = await this.runImportObjectsCommand(
          executor,
          type,
          failedInstancesIds.join(' '),
          suiteAppId,
        )
        log.debug(
          'Retried to fetch %d failed instances with suiteApp: %s of chunk %d/%d of type: %s.',
          failedInstancesIds.length,
          suiteAppId,
          index,
          total,
          type,
        )
        return failedTypeToInstancesAfterRetry
      }

      try {
        log.debug(
          'Starting to fetch chunk %d/%d with %d objects of type: %s with SuiteApp %s',
          index,
          total,
          ids.length,
          type,
          suiteAppId,
        )
        let failedTypeToInstances = await this.runImportObjectsCommand(executor, type, ids.join(' '), suiteAppId)
        if (failedTypeToInstances.unexpectedError[type]?.length > 0) {
          failedTypeToInstances = {
            unexpectedError: (await retryFetchFailedInstances(failedTypeToInstances.unexpectedError[type]))
              .unexpectedError,
            lockedError: failedTypeToInstances.lockedError,
            excludedTypes: failedTypeToInstances.excludedTypes,
          }
        }
        log.debug(
          'Fetched chunk %d/%d with %d objects of type: %s with suiteApp: %s. failedTypes: %o',
          index,
          total,
          ids.length,
          type,
          suiteAppId,
          failedTypeToInstances,
        )
        return failedTypeToInstances
      } catch (e) {
        log.warn(
          'Failed to fetch chunk %d/%d with %d objects of type: %s with suiteApp: %s',
          index,
          total,
          ids.length,
          type,
          suiteAppId,
        )
        log.warn(toError(e))
        const [objectId] = ids
        if (retriesLeft === 0) {
          throw new Error(
            `Failed to fetch object '${objectId}' of type '${type}' with error: ${toError(e).message}. Exclude it and fetch again.`,
          )
        }
        if (ids.length === 1) {
          log.debug(
            "Retrying to fetch chunk %d/%d with a single object '%s' of type: %s. %d retries left",
            index,
            total,
            objectId,
            type,
            retriesLeft - 1,
          )
          return importObjectsChunk({ type, ids, index, total }, retriesLeft - 1)
        }
        log.debug(
          'Retrying to fetch chunk %d/%d with %d objects of type: %s with smaller chunks',
          index,
          total,
          ids.length,
          type,
        )
        const middle = (ids.length + 1) / 2
        const results = await Promise.all([
          importObjectsChunk({ type, ids: ids.slice(0, middle), index, total }),
          importObjectsChunk({ type, ids: ids.slice(middle, ids.length), index, total }),
        ])
        return {
          lockedError: mergeTypeToInstances(...results.map(res => res.lockedError)),
          unexpectedError: mergeTypeToInstances(...results.map(res => res.unexpectedError)),
          excludedTypes: results.flatMap(res => res.excludedTypes),
        }
      }
    }

    const instancesIdsByType = _.groupBy(instancesIds, id => id.type)

    const [excludedGroups, instancesToFetch] = _.partition(Object.entries(instancesIdsByType), ([type, instances]) =>
      this.instanceLimiter(type, instances.length),
    )

    const excludedTypes = excludedGroups.map(([type, instances]) => {
      log.info(`Excluding type ${type} as it has about ${instances.length} elements.`)
      return type
    })

    const idsChunks = instancesToFetch.flatMap(([type, ids]) =>
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
        .toArray(),
    )

    log.debug('Fetching custom objects by types in chunks')
    const results = await withLimitedConcurrency(
      // limit the number of open promises
      idsChunks.map(idsChunk => () => importObjectsChunk(idsChunk)),
      this.sdfConcurrencyLimit,
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
      .mapValues(failedImportsGroup => failedImportsGroup.map(failedImport => failedImport.customObject.id))
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

    const unexpectedError = SdfClient.createFailedImportsMap(
      importResult.failedImports.filter(failedImport => {
        if (fetchUnexpectedErrorRegex.test(failedImport.customObject.result.message)) {
          log.debug(
            'Failed to fetch (%s) instance with id (%s) due to SDF unexpected error',
            SdfClient.fixTypeName(failedImport.customObject.type),
            failedImport.customObject.id,
          )
          return true
        }
        return false
      }),
    )

    const lockedError = SdfClient.createFailedImportsMap(
      importResult.failedImports.filter(failedImport => {
        if (fetchLockedObjectErrorRegex.test(failedImport.customObject.result.message)) {
          log.debug(
            'Failed to fetch (%s) instance with id (%s) due to the instance being locked',
            SdfClient.fixTypeName(failedImport.customObject.type),
            failedImport.customObject.id,
          )
          return true
        }
        return false
      }),
    )

    return { unexpectedError, lockedError, excludedTypes: [] }
  }

  private static fixTypeName(typeName: string): string {
    // For some type names, SDF might return different names in its
    // response, so we replace it with the original name
    return RESPONSE_TYPE_NAME_TO_REAL_NAME[typeName] ?? typeName
  }

  async listInstances(
    executor: CommandActionExecutor,
    types: string[],
    suiteAppId: string | undefined,
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

  private async listFilePaths(
    executor: CommandActionExecutor,
  ): Promise<{ listedPaths: string[]; failedPaths: string[] }> {
    const failedPaths: string[] = []
    const actionResults = (
      await Promise.all(
        fileCabinetTopLevelFolders.map(folder =>
          this.executeProjectAction(COMMANDS.LIST_FILES, { folder }, executor).catch(() => {
            log.debug(`Adding ${folder} path to skip list`)
            failedPaths.push(`^${folder}.*`)
            return undefined
          }),
        ),
      )
    ).filter(isDefined)
    return {
      listedPaths: actionResults.flatMap(actionResult => makeArray(actionResult.data)),
      failedPaths,
    }
  }

  private async importFiles(filePaths: string[], executor: CommandActionExecutor): Promise<string[]> {
    if (filePaths.length === 0) {
      return []
    }
    try {
      log.info(`Going to import ${filePaths.length} files`)
      const actionResult = await this.executeProjectAction(COMMANDS.IMPORT_FILES, { paths: filePaths }, executor)
      return makeArray(actionResult.data.results)
        .filter(result => result.loaded)
        .map(result => result.path)
    } catch (e) {
      if (filePaths.length === 1) {
        log.error(`Failed to import file ${filePaths[0]} due to: ${toError(e).message}`)
        throw new Error(
          `Failed to import file: ${filePaths[0]}. Consider adding it to the skip list. To learn more visit https://github.com/salto-io/salto/blob/main/packages/netsuite-adapter/config_doc.md`,
        )
      }
      const middle = (filePaths.length + 1) / 2
      const firstChunkImportResults = await this.importFiles(filePaths.slice(0, middle), executor)
      const secondChunkImportResults = await this.importFiles(filePaths.slice(middle, filePaths.length), executor)
      return [...firstChunkImportResults, ...secondChunkImportResults]
    }
  }

  @SdfClient.logDecorator
  async importFileCabinetContent(
    query: NetsuiteQuery,
    maxFileCabinetSizeInGB: number,
  ): Promise<ImportFileCabinetResult> {
    if (!query.areSomeFilesMatch()) {
      return {
        elements: [],
        failedPaths: { lockedError: [], otherError: [], largeFolderError: [] },
      }
    }

    const filesToSize = async (filePaths: string[], fileCabinetDirPath: string): Promise<FileSize[]> => {
      const normalizedPath = (filePath: string): string => {
        const filePathParts = filePath.split(FILE_CABINET_PATH_SEPARATOR)
        return osPath.join(fileCabinetDirPath, ...filePathParts)
      }

      return withLimitedConcurrency(
        filePaths.map(path => async () => ({ path, size: (await stat(normalizedPath(path))).size })),
        READ_CONCURRENCY,
      )
    }

    const project = await this.initProject()
    const listFilesResults = await this.listFilePaths(project.executor)
    const filePathsToImport = listFilesResults.listedPaths.filter(path => query.isFileMatch(path))
    const importFilesResult = await this.importFiles(filePathsToImport, project.executor)
    // folder attributes file is returned multiple times
    const importedPaths = _.uniq(importFilesResult)

    const fileCabinetDirPath = getFileCabinetDirPath(project.projectPath)
    const largeFolders = largeFoldersToExclude(
      await filesToSize(importedPaths, fileCabinetDirPath),
      maxFileCabinetSizeInGB,
    )
    const listedPaths = filterFilesInFolders(importedPaths, largeFolders)
    const elements = await parseFileCabinetDir(project.projectPath, listedPaths)
    await this.projectCleanup(project.projectPath, project.authId)
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
    dependencyGraph: Graph<SDFObjectNode>,
  ): Promise<void> {
    const project = await this.initProject(suiteAppId)
    const srcDirPath = getSrcDirPath(project.projectPath)
    const fileCabinetDirPath = getFileCabinetDirPath(project.projectPath)
    const customizationInfos = Array.from(dependencyGraph.nodes.values()).map(node => node.value.customizationInfo)
    // Delete the default FileCabinet folder to prevent permissions error
    await rm(fileCabinetDirPath)
    await Promise.all(
      customizationInfos.map(async customizationInfo => {
        if (customizationInfo.typeName === CONFIG_FEATURES) {
          return SdfClient.addFeaturesObjectToProject(customizationInfo, project.projectPath)
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
      }),
    )
    await this.runDeployCommands(project, customizationInfos, manifestDependencies, validateOnly, dependencyGraph)
    await this.projectCleanup(project.projectPath, project.authId)
  }

  private async fixManifest(
    projectPath: string,
    customizationInfos: CustomizationInfo[],
    manifestDependencies: ManifestDependencies,
  ): Promise<void> {
    const manifestPath = getManifestFilePath(projectPath)
    const manifestContent = (await readFile(manifestPath)).toString()
    this.manifestXmlContent = fixManifest(manifestContent, customizationInfos, manifestDependencies)
    await writeFile(manifestPath, this.manifestXmlContent)
  }

  private async fixDeployXml(dependencyGraph: Graph<SDFObjectNode>, projectPath: string): Promise<void> {
    const deployFilePath = getDeployFilePath(projectPath)
    const deployXmlContent = (await readFile(deployFilePath)).toString()
    this.deployXmlContent = reorderDeployXml(deployXmlContent, dependencyGraph)
    await writeFile(deployFilePath, this.deployXmlContent)
  }

  private customizeDeployError(error: Error): Error {
    if (error instanceof FeaturesDeployError) {
      return error
    }

    const messages = error.message.split(`${os.EOL}${os.EOL}`)
    const sdfLanguage = detectLanguage(error.message)
    const {
      settingsValidationErrorRegex,
      manifestErrorDetailsRegex,
      objectValidationErrorRegexes,
      missingFeatureErrorRegexes,
      deployedObjectRegex,
      errorObjectRegex,
      otherErrorRegexes,
    } = multiLanguageErrorDetectors[sdfLanguage]

    const manifestErrorScriptids = getFailedObjects(messages, manifestErrorDetailsRegex)
    if (manifestErrorScriptids.length > 0) {
      return new ManifestValidationError(error.message, manifestErrorScriptids)
    }

    const missingFeatureNames = missingFeatureErrorRegexes.flatMap(regex =>
      getGroupItemFromRegex(error.message, regex, FEATURE_NAME),
    )
    if (missingFeatureNames.length > 0) {
      return new MissingManifestFeaturesError(error.message, _.uniq(missingFeatureNames))
    }

    const validationErrorsMap = getFailedObjectsMap(messages, ...objectValidationErrorRegexes)
    if (validationErrorsMap.size > 0) {
      return new ObjectsDeployError(error.message, validationErrorsMap)
    }

    const settingsErrors = sliceMessagesByRegex(messages, settingsValidationErrorRegex)
      .filter(message => message.includes(FEATURES_XML))
      .map(message => ({ message }))
    if (settingsErrors.length > 0) {
      return new SettingsDeployError(error.message, new Map([[CONFIG_FEATURES, settingsErrors]]))
    }

    const errorObjectsMap = getFailedObjectsMap(messages, errorObjectRegex)
    if (errorObjectsMap.size > 0) {
      return new ObjectsDeployError(error.message, errorObjectsMap)
    }

    const allDeployedObjects = getGroupItemFromRegex(error.message, deployedObjectRegex, OBJECT_ID)
    if (allDeployedObjects.length > 0) {
      const errorMessages = sliceMessagesByRegex(messages, deployedObjectRegex, false)
      const message = errorMessages.length > 0 ? errorMessages.join(os.EOL) : error.message
      // the last object in the error message is the one that failed the deploy
      const errorsMap = new Map([[allDeployedObjects.slice(-1)[0], [{ message }]]])
      return new ObjectsDeployError(error.message, errorsMap)
    }

    log.warn(`
could not detect the reason for this sdf error.
manifest.xml:
${this.manifestXmlContent}

deploy.xml:
${this.deployXmlContent}
`)

    const detectedErrors = messages.filter(message => otherErrorRegexes.some(regex => regex.test(message)))
    return detectedErrors.length > 0 ? new Error(detectedErrors.join(os.EOL)) : error
  }

  private async runDeployCommands(
    { executor, projectPath, type }: Project,
    customizationInfos: CustomizationInfo[],
    manifestDependencies: ManifestDependencies,
    validateOnly: boolean,
    dependencyGraph: Graph<SDFObjectNode>,
  ): Promise<void> {
    await this.executeProjectAction(COMMANDS.ADD_PROJECT_DEPENDENCIES, {}, executor)
    await this.fixManifest(projectPath, customizationInfos, manifestDependencies)
    await this.fixDeployXml(dependencyGraph, projectPath)
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
        executor,
      )
    } catch (e) {
      throw this.customizeDeployError(toError(e))
    }
  }

  private static async addCustomTypeInfoToProject(customTypeInfo: CustomTypeInfo, srcDirPath: string): Promise<void> {
    await writeFile(getCustomTypeInfoPath(srcDirPath, customTypeInfo), convertToXmlContent(customTypeInfo))
    if (isTemplateCustomTypeInfo(customTypeInfo)) {
      await writeFile(
        getCustomTypeInfoPath(srcDirPath, customTypeInfo, `${ADDITIONAL_FILE_PATTERN}${customTypeInfo.fileExtension}`),
        customTypeInfo.fileContent,
      )
    }
  }

  private static async addFeaturesObjectToProject(
    customizationInfo: CustomizationInfo,
    projectPath: string,
  ): Promise<void> {
    await writeFile(getFeaturesXmlPath(projectPath), convertToFeaturesXmlContent(customizationInfo))
  }

  private static async addFileInfoToProject(
    fileCustomizationInfo: FileCustomizationInfo,
    srcDirPath: string,
  ): Promise<void> {
    const attrsFilename = fileCustomizationInfo.path.slice(-1)[0] + ATTRIBUTES_FILE_SUFFIX
    const fileFolderPath = getFileCabinetCustomInfoPath(srcDirPath, fileCustomizationInfo)
    const attrsFolderPath = osPath.resolve(fileFolderPath, ATTRIBUTES_FOLDER_NAME)
    const filename = fileCustomizationInfo.path.slice(-1)[0]
    await Promise.all([
      writeFileInFolder(fileFolderPath, filename, fileCustomizationInfo.fileContent),
      writeFileInFolder(attrsFolderPath, attrsFilename, convertToXmlContent(fileCustomizationInfo)),
    ])
  }

  private static async addFolderInfoToProject(
    folderCustomizationInfo: FolderCustomizationInfo,
    srcDirPath: string,
  ): Promise<void> {
    const attrsFolderPath = osPath.resolve(
      getFileCabinetCustomInfoPath(srcDirPath, folderCustomizationInfo),
      ATTRIBUTES_FOLDER_NAME,
    )
    await writeFileInFolder(
      attrsFolderPath,
      FOLDER_ATTRIBUTES_FILE_SUFFIX,
      convertToXmlContent(folderCustomizationInfo),
    )
  }
}
