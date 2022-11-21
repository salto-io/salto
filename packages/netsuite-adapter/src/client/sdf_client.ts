/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { collections, decorators, objects as lowerdashObjects, promises, values as valuesUtils, strings } from '@salto-io/lowerdash'
import { Values, AccountId, Value } from '@salto-io/adapter-api'
import { mkdirp, readDir, readFile, writeFile, rm, rename } from '@salto-io/file'
import { logger } from '@salto-io/logging'
import {
  CommandsMetadataService, CommandActionExecutor, CLIConfigurationService, NodeConsoleLogger,
  ActionResult, ActionResultUtils, SdkProperties,
} from '@salto-io/suitecloud-cli'
import xmlParser from 'fast-xml-parser'
import he from 'he'
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
import { NetsuiteQuery, NetsuiteQueryParameters, ObjectID } from '../query'
import { FeaturesDeployError, ManifestValidationError, ObjectsDeployError, ObjectsValidationError, SettingsDeployError } from '../errors'
import { SdfCredentials } from './credentials'
import {
  CustomizationInfo, CustomTypeInfo, FailedImport, FailedTypes, FileCustomizationInfo,
  FolderCustomizationInfo, GetCustomObjectsResult, ImportFileCabinetResult, ImportObjectsResult,
  TemplateCustomTypeInfo, AdditionalDependencies, SdfDeployParams,
} from './types'
import { ATTRIBUTE_PREFIX, CDATA_TAG_NAME, fileCabinetTopLevelFolders } from './constants'
import {
  isCustomTypeInfo, isFileCustomizationInfo, isFolderCustomizationInfo, isTemplateCustomTypeInfo,
  mergeTypeToInstances,
} from './utils'
import { fixManifest } from './manifest_utils'

const { makeArray } = collections.array
const { withLimitedConcurrency } = promises.array
const { isDefined } = valuesUtils
const { concatObjects } = lowerdashObjects
const { matchAll } = strings
const log = logger(module)

const FAILED_TYPE_NAME_TO_REAL_NAME: Record<string, string> = {
  csvimport: 'savedcsvimport',
  plugintypeimpl: 'pluginimplementation',
}

export type SdfClientOpts = {
  credentials: SdfCredentials
  config?: SdfClientConfig
  globalLimiter: Bottleneck
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


export const ATTRIBUTES_FOLDER_NAME = '.attributes'
export const ATTRIBUTES_FILE_SUFFIX = '.attr.xml'
export const FOLDER_ATTRIBUTES_FILE_SUFFIX = '.folder.attr.xml'
const FILE_CABINET_DIR = 'FileCabinet'
const OBJECTS_DIR = 'Objects'
const SRC_DIR = 'src'
const FILE_SEPARATOR = '.'
const ALL = 'ALL'
const ADDITIONAL_FILE_PATTERN = '.template.'

const ALL_FEATURES = 'FEATURES:ALL_FEATURES'
const ACCOUNT_CONFIGURATION_DIR = 'AccountConfiguration'
const FEATURES_XML = 'features.xml'
const FEATURES_TAG = 'features'
const FEATURE_ID = 'featureId'
const configureFeatureFailRegex = RegExp(`Configure feature -- (Enabling|Disabling) of the (?<${FEATURE_ID}>\\w+)\\(.*?\\) feature has FAILED`)

const OBJECT_ID = 'objectId'
const deployStartMessageRegex = RegExp('^Begin deployment$', 'm')
const settingsValidationErrorRegex = RegExp('^Validation of account settings failed.$', 'm')
const objectValidationErrorRegex = RegExp(`^An error occurred during custom object validation. \\((?<${OBJECT_ID}>[a-z0-9_]+)\\)`, 'gm')
const deployedObjectRegex = RegExp(`^(Create|Update) object -- (?<${OBJECT_ID}>[a-z0-9_]+)`, 'gm')
const errorObjectRegex = RegExp(`^An unexpected error has occurred. \\((?<${OBJECT_ID}>[a-z0-9_]+)\\)`, 'm')

const ERROR_MESSAGE = 'errorMessage'
const errorMessageRegex = RegExp(`Error Message: (?<${ERROR_MESSAGE}>.*)`)

export const MINUTE_IN_MILLISECONDS = 1000 * 60
const SINGLE_OBJECT_RETRIES = 3
const READ_CONCURRENCY = 100

const baseExecutionPath = os.tmpdir()

const XML_PARSE_OPTIONS: xmlParser.J2xOptionsOptional = {
  attributeNamePrefix: ATTRIBUTE_PREFIX,
  ignoreAttributes: false,
  tagValueProcessor: val => he.decode(val),
}

const safeQuoteArgument = (argument: Value): Value => {
  if (typeof argument === 'string') {
    return shellQuote.quote([argument])
  }
  return argument
}

export const convertToCustomizationInfo = (xmlContent: string):
  CustomizationInfo => {
  const parsedXmlValues = xmlParser.parse(xmlContent, XML_PARSE_OPTIONS)
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

const getGroupItemFromRegex = (str: string, regex: RegExp, item: string): string[] =>
  Array.from(matchAll(str, regex))
    .map(r => r.groups)
    .filter(isDefined)
    .map(groups => groups[item])

type ErrorMatcher = { getValidationErrorMessage: (filePath: string) => string }
const createErrorMatcher = (lines: string[]): ErrorMatcher => {
  const indexesMap = new Map<string, number[]>()
  lines.forEach((line, index) => {
    if (!indexesMap.has(line)) {
      indexesMap.set(line, [])
    }
    indexesMap.get(line)?.push(index)
  })

  return {
    getValidationErrorMessage: filePath => {
      const invalidObjectErrorMessage = `Errors for file ${filePath}.`
      const custInfoErrorIndexes = indexesMap.get(invalidObjectErrorMessage)
      return _(custInfoErrorIndexes)
        .map(errorIndex => {
          const errorMessageLine = lines[errorIndex + 1]
          return errorMessageLine?.match(errorMessageRegex)?.groups?.[ERROR_MESSAGE]
            ?? lines[errorIndex]
        })
        .uniq()
        .join(os.EOL)
    },
  }
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

  constructor({
    credentials,
    config,
    globalLimiter,
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
  }

  @SdfClient.logDecorator
  static async validateCredentials(credentials: SdfCredentials): Promise<AccountId> {
    const netsuiteClient = new SdfClient({ credentials, globalLimiter: new Bottleneck() })
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
        throw _.isObject(e) ? e : new Error(String(e))
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

  private static verifySuccessfulDeploy(data: Value): void {
    if (!_.isArray(data)) {
      log.warn('suitecloud deploy returned unexpected value: %o', data)
      return
    }

    const featureDeployFailes = data
      .filter(_.isString)
      .filter(line => configureFeatureFailRegex.test(line))

    if (featureDeployFailes.length === 0) return

    log.warn('suitecloud deploy failed to configure the following features: %o', featureDeployFailes)
    const errorIds = featureDeployFailes
      .map(line => line.match(configureFeatureFailRegex)?.groups)
      .filter(isDefined)
      .map(groups => groups[FEATURE_ID])

    const errorMessage = data
      .filter(_.isString)
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
    if (commandName === COMMANDS.DEPLOY_PROJECT) {
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

  private static async transformCustomObject(
    scriptId: string, objectFileNames: string[], objectsDirPath: string
  ): Promise<CustomTypeInfo> {
    const [[additionalFilename], [contentFilename]] = _.partition(objectFileNames,
      filename => filename.includes(ADDITIONAL_FILE_PATTERN))
    const xmlContent = readFile(osPath.resolve(objectsDirPath, contentFilename))
    if (_.isUndefined(additionalFilename)) {
      return convertToCustomTypeInfo((await xmlContent).toString(), scriptId)
    }
    const additionalFileContent = readFile(
      osPath.resolve(objectsDirPath, additionalFilename)
    )
    return convertToTemplateCustomTypeInfo((await xmlContent).toString(), scriptId,
      additionalFilename.split(FILE_SEPARATOR)[2], await additionalFileContent)
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
          const objectsDirPath = SdfClient.getObjectsDirPath(projectName)
          const filenames = await readDir(objectsDirPath)
          const scriptIdToFiles = _.groupBy(
            filenames,
            filename => filename.split(FILE_SEPARATOR)[0]
          )

          const elements = await withLimitedConcurrency(
            Object.entries(scriptIdToFiles).map(([scriptId, objectFileNames]) =>
              () => SdfClient.transformCustomObject(scriptId, objectFileNames, objectsDirPath)),
            READ_CONCURRENCY
          )

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
      const xmlContent = await readFile(SdfClient.getFeaturesXmlPath(projectName))
      const featuresXml = xmlParser.parse(xmlContent.toString(), XML_PARSE_OPTIONS)

      const feature = makeArray(featuresXml.features?.feature)
      return { typeName: CONFIG_FEATURES, values: { feature } }
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
        log.warn(e)
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
        log.warn(e)
        if (retriesLeft === 0) {
          throw e
        }
        if (ids.length === 1) {
          const [objectId] = ids
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
    const idsChunks = wu.entries(instancesIdsByType).map(
      ([type, ids]: [string, ObjectID[]]) =>
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
          .toArray()
    ).flatten(true).toArray()

    log.debug('Fetching custom objects by types in chunks')
    const results = await withLimitedConcurrency( // limit the number of open promises
      idsChunks.map(idsChunk => () => importObjectsChunk(idsChunk)),
      this.sdfConcurrencyLimit
    )
    return {
      lockedError: mergeTypeToInstances(...results.map(res => res.lockedError)),
      unexpectedError: mergeTypeToInstances(...results.map(res => res.unexpectedError)),
    }
  }

  private static createFailedImportsMap(failedImports: FailedImport[]): NetsuiteQueryParameters['types'] {
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
        if (failedImport.customObject.result.message.includes('unexpected error')) {
          log.debug('Failed to fetch (%s) instance with id (%s) due to SDF unexpected error',
            SdfClient.fixTypeName(failedImport.customObject.type), failedImport.customObject.id)
          return true
        }
        return false
      }))

    const lockedError = SdfClient.createFailedImportsMap(importResult.failedImports
      .filter(failedImport => {
        if (failedImport.customObject.result.message.includes('You cannot download the XML file for this object because it is locked')) {
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
    // error response, so we replace it with the original name
    return FAILED_TYPE_NAME_TO_REAL_NAME[typeName] ?? typeName
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
    return results.data.map(
      ({ type, scriptId }: { type: string; scriptId: string }) => ({ type, instanceId: scriptId })
    )
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
        failedPaths: { lockedError: [], otherError: [] },
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

      const transformFile = async (filePath: string): Promise<FileCustomizationInfo> => {
        const attrsPath = filePathToAttrsPath[filePath]
        const xmlContent = readFile(osPath.resolve(fileCabinetDirPath,
          ...attrsPath.split(FILE_CABINET_PATH_SEPARATOR)))
        const filePathParts = filePath.split(FILE_CABINET_PATH_SEPARATOR)
        const fileContent = readFile(osPath.resolve(fileCabinetDirPath, ...filePathParts))
        return convertToFileCustomizationInfo((await xmlContent).toString(),
          filePathParts.slice(1), await fileContent)
      }

      return withLimitedConcurrency(
        filePaths.map(filePath => () => transformFile(filePath)),
        READ_CONCURRENCY
      )
    }

    const transformFolders = (folderAttrsPaths: string[], fileCabinetDirPath: string):
      Promise<FolderCustomizationInfo[]> => {
      const transformFolder = async (folderAttrsPath: string): Promise<FolderCustomizationInfo> => {
        const folderPathParts = folderAttrsPath.split(FILE_CABINET_PATH_SEPARATOR)
        const xmlContent = readFile(osPath.resolve(fileCabinetDirPath, ...folderPathParts))
        return convertToFolderCustomizationInfo((await xmlContent).toString(),
          folderPathParts.slice(1, -2))
      }

      return withLimitedConcurrency(
        folderAttrsPaths.map(folderAttrsPath => () => transformFolder(folderAttrsPath)),
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
      failedPaths: { lockedError: [], otherError: listFilesResults.failedPaths },
    }
  }

  @SdfClient.logDecorator
  async deploy(
    customizationInfos: CustomizationInfo[],
    suiteAppId: string | undefined,
    { additionalDependencies, validateOnly = false }: SdfDeployParams
  ): Promise<void> {
    const project = await this.initProject(suiteAppId)
    const objectsDirPath = SdfClient.getObjectsDirPath(project.projectName)
    const fileCabinetDirPath = SdfClient.getFileCabinetDirPath(project.projectName)
    // Delete the default FileCabinet folder to prevent permissions error
    await rm(fileCabinetDirPath)
    await Promise.all(customizationInfos.map(async customizationInfo => {
      if (customizationInfo.typeName === CONFIG_FEATURES) {
        return SdfClient.addFeaturesObjectToProject(customizationInfo, project.projectName)
      }
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
    await this.runDeployCommands(project, customizationInfos, additionalDependencies, validateOnly)
    await this.projectCleanup(project.projectName, project.authId)
  }

  private static async fixManifest(
    projectName: string,
    customizationInfos: CustomizationInfo[],
    additionalDependencies: AdditionalDependencies
  ): Promise<void> {
    const manifestPath = SdfClient.getManifestFilePath(projectName)
    const manifestContent = (await readFile(manifestPath)).toString()
    await writeFile(
      manifestPath,
      fixManifest(manifestContent, customizationInfos, additionalDependencies)
    )
  }

  private static customizeDeployError(error: Error): Error {
    const errorMessage = error.message

    if (settingsValidationErrorRegex.test(errorMessage)) {
      return new SettingsDeployError(errorMessage, new Set([CONFIG_FEATURES]))
    }
    if (!deployStartMessageRegex.test(errorMessage)) {
      // we'll get here when the deploy failed in the validation phase.
      // in this case we're looking for validation error message lines.
      const validationErrorObjects = getGroupItemFromRegex(
        errorMessage, objectValidationErrorRegex, OBJECT_ID
      )
      return validationErrorObjects.length > 0
        ? new ObjectsDeployError(errorMessage, new Set(validationErrorObjects))
        : error
    }

    const allDeployedObjects = getGroupItemFromRegex(
      errorMessage, deployedObjectRegex, OBJECT_ID
    )
    const errorObject = errorMessage.match(errorObjectRegex)?.groups?.[OBJECT_ID]

    if (allDeployedObjects.length === 0) {
      return errorObject !== undefined
        ? new ObjectsDeployError(errorMessage, new Set([errorObject]))
        : error
    }
    // if errorObject doesn't exists - the last object in the error message is the one
    // that failed the deploy
    return new ObjectsDeployError(
      errorMessage,
      new Set([errorObject ?? allDeployedObjects.slice(-1)[0]])
    )
  }

  private static customizeValidationError(
    error: Error,
    projectName: string,
    customizationInfos: CustomizationInfo[]
  ): Error {
    const errorMatcher = createErrorMatcher(error.message.split(os.EOL))
    const manifestErrorMessage = errorMatcher
      .getValidationErrorMessage(SdfClient.getManifestFilePath(projectName))
    if (manifestErrorMessage) {
      return new ManifestValidationError(manifestErrorMessage)
    }
    const objectsDirPath = SdfClient.getObjectsDirPath(projectName)
    const failedObjects = customizationInfos
      .filter(isCustomTypeInfo)
      .map((custInfo): [string, string] | undefined => {
        const errorMessage = errorMatcher
          .getValidationErrorMessage(`${osPath.join(objectsDirPath, custInfo.scriptId)}.xml`)
        return errorMessage ? [custInfo.scriptId, errorMessage] : undefined
      })
      .filter(isDefined)
    return failedObjects.length > 0
      ? new ObjectsValidationError(error.message, new Map(failedObjects))
      : error
  }

  private async runDeployCommands(
    { executor, projectName, type }: Project,
    customizationInfos: CustomizationInfo[],
    additionalDependencies: AdditionalDependencies,
    validateOnly: boolean
  ): Promise<void> {
    await this.executeProjectAction(COMMANDS.ADD_PROJECT_DEPENDENCIES, {}, executor)
    await SdfClient.fixManifest(projectName, customizationInfos, additionalDependencies)
    try {
      await this.executeProjectAction(
        validateOnly ? COMMANDS.VALIDATE_PROJECT : COMMANDS.DEPLOY_PROJECT,
        // SuiteApp project type can't contain account specific values
        // and thus the flag is not supported
        type === 'AccountCustomization' ? { accountspecificvalues: 'WARNING' } : {},
        executor
      )
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e))
      if (validateOnly) {
        throw SdfClient.customizeValidationError(error, projectName, customizationInfos)
      }
      throw SdfClient.customizeDeployError(error)
    }
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

  private static async addFeaturesObjectToProject(
    customizationInfo: CustomizationInfo,
    projectName: string
  ): Promise<void> {
    const { feature } = customizationInfo.values
    await writeFile(
      SdfClient.getFeaturesXmlPath(projectName),
      convertToXmlContent({
        typeName: FEATURES_TAG,
        values: { feature },
      })
    )
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

  private static getManifestFilePath(projectName: string): string {
    return osPath.resolve(SdfClient.getProjectPath(projectName), SRC_DIR, 'manifest.xml')
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
