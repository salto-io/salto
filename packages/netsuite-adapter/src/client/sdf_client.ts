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
import { collections, decorators, objects as lowerdashObjects, promises, values, strings } from '@salto-io/lowerdash'
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
import uuidv4 from 'uuid/v4'
import AsyncLock from 'async-lock'
import wu from 'wu'
import shellQuote from 'shell-quote'
import {
  APPLICATION_ID,
  FILE_CABINET_PATH_SEPARATOR,
  SCRIPT_ID,
  WORKFLOW,
} from '../constants'
import {
  DEFAULT_FETCH_ALL_TYPES_AT_ONCE, DEFAULT_COMMAND_TIMEOUT_IN_MINUTES,
  DEFAULT_MAX_ITEMS_IN_IMPORT_OBJECTS_REQUEST, DEFAULT_CONCURRENCY, SdfClientConfig,
} from '../config'
import { NetsuiteQuery, NetsuiteQueryParameters, ObjectID } from '../query'
import { SdfCredentials } from './credentials'
import {
  CustomizationInfo, CustomTypeInfo, FailedImport, FailedTypes, FileCustomizationInfo,
  FolderCustomizationInfo, GetCustomObjectsResult, ImportFileCabinetResult, ImportObjectsResult,
  TemplateCustomTypeInfo,
} from './types'
import { ATTRIBUTE_PREFIX, CDATA_TAG_NAME, fileCabinetTopLevelFolders } from './constants'
import {
  isCustomTypeInfo, isFileCustomizationInfo, isFolderCustomizationInfo, isTemplateCustomTypeInfo,
  mergeTypeToInstances,
} from './utils'

const { makeArray } = collections.array
const { withLimitedConcurrency } = promises.array
const { isDefined, lookupValue } = values
const { matchAll } = strings
const { concatObjects } = lowerdashObjects
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

export const MINUTE_IN_MILLISECONDS = 1000 * 60
const SINGLE_OBJECT_RETRIES = 3
const READ_CONCURRENCY = 100

const TEXT_ATTRIBUTE = '#text'
const REQUIRED_ATTRIBUTE = '@_required'
const INVALID_DEPENDENCIES = ['ADVANCEDEXPENSEMANAGEMENT', 'SUBSCRIPTIONBILLING', 'WMSSYSTEM', 'BILLINGACCOUNTS']
const REFERENCED_OBJECT_REGEX = new RegExp(`${SCRIPT_ID}=(?<${SCRIPT_ID}>[a-z0-9_]+(\\.[a-z0-9_]+)*)`, 'g')

type RequiredDependencyValueCondition = 'fullLookup' | 'byValue' | 'byPath'

type RequiredDependency = {
  typeName: string
  dependency: string
  value?: Value
  path?: string[]
  condition?: RequiredDependencyValueCondition
}

const REQUIRED_FEATURES: RequiredDependency[] = [
  {
    typeName: WORKFLOW,
    dependency: 'EXPREPORTS',
    value: 'STDRECORDSUBSIDIARYDEFAULTACCTCORPCARDEXP',
  },
]

const baseExecutionPath = os.tmpdir()

const safeQuoteArgument = (argument: Value): Value => {
  if (typeof argument === 'string') {
    return shellQuote.quote([argument])
  }
  return argument
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
  type: 'AccountCustomization' | 'SuiteApp'
}

type ObjectsChunk = {
  type: string
  ids: string[]
  index: number
  total: number
}

const getRequiredFeatures = (customizationInfos: CustomizationInfo[]): string[] =>
  REQUIRED_FEATURES.map(
    ({ typeName, dependency, value, path, condition }) => {
      const custInfoWithDependency = customizationInfos
        .find(custInfo => {
          if (typeName !== custInfo.typeName) {
            return false
          }
          if (_.isUndefined(value)) {
            return true
          }
          switch (condition) {
            case 'byPath':
              return path && _.get(custInfo.values, path) === value
            case 'byValue':
              return lookupValue(custInfo.values, val => _.isEqual(val, value))
            default:
              return lookupValue(custInfo.values,
                val => _.isEqual(val, value)
                || (_.isString(val) && _.isString(value) && val.includes(value)))
          }
        })
      return custInfoWithDependency ? dependency : undefined
    }
  ).filter(isDefined)

const getRequiredObjects = (customizationInfos: CustomizationInfo[]): string[] =>
  _.uniq(customizationInfos.flatMap(custInfo => {
    const objName = custInfo.values[ATTRIBUTE_PREFIX + SCRIPT_ID]
    const requiredObjects: string[] = []
    lookupValue(custInfo.values, val => {
      if (!_.isString(val)) {
        return
      }

      requiredObjects.push(...[...matchAll(val, REFERENCED_OBJECT_REGEX)]
        .map(r => r.groups)
        .filter(isDefined)
        .map(group => group[SCRIPT_ID])
        .filter(scriptId => scriptId !== objName
          && !scriptId.startsWith(`${objName}.`)))
    })
    return requiredObjects
  }))

const fixDependenciesObject = (dependencies: Value): void => {
  dependencies.features = dependencies.features ?? {}
  dependencies.features.feature = dependencies.features.feature ?? []
  dependencies.objects = dependencies.objects ?? {}
  dependencies.objects.object = dependencies.objects.object ?? []
}

const addRequiredDependencies = (
  dependencies: Value,
  customizationInfos: CustomizationInfo[]
): void => {
  const requiredFeatures = getRequiredFeatures(customizationInfos)
  const requiredObjects = getRequiredObjects(customizationInfos)
  if (requiredFeatures.length === 0 && requiredObjects.length === 0) {
    return
  }

  const { features, objects } = dependencies
  features.feature = _.union(
    features.feature,
    requiredFeatures.map(feature => ({ [REQUIRED_ATTRIBUTE]: 'true', [TEXT_ATTRIBUTE]: feature }))
  )
  objects.object = _.union(objects.object, requiredObjects)
}

const cleanInvalidDependencies = (dependencies: Value): void => {
  // This is done due to an SDF bug described in SALTO-1107.
  // This function should be removed once the bug is fixed.
  const fixedFeatureList = _.differenceBy(
    makeArray(dependencies.features.feature),
    INVALID_DEPENDENCIES.map(dep => ({ [TEXT_ATTRIBUTE]: dep })),
    item => item[TEXT_ATTRIBUTE]
  )
  dependencies.features.feature = fixedFeatureList
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
    const projectName = `TempSdfProject-${authId}`
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
    if (typeNames.every(type => !query.isTypeMatch(type))) {
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
          log.debug('Retrying to fetch chunk %d/%d with a single object of type: %s. %d retries left', index, total, type, retriesLeft - 1)
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
  async deploy(customizationInfos: CustomizationInfo[], suiteAppId?: string): Promise<void> {
    const project = await this.initProject(suiteAppId)
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
    await this.runDeployCommands(project, customizationInfos)
    await this.projectCleanup(project.projectName, project.authId)
  }

  private static async fixManifest(
    projectPath: string,
    customizationInfos: CustomizationInfo[]
  ): Promise<void> {
    const manifestPath = osPath.join(projectPath, 'src', 'manifest.xml')
    const manifestContent = (await readFile(manifestPath)).toString()
    const manifestXml = xmlParser.parse(manifestContent, { ignoreAttributes: false })

    if (!_.isPlainObject(manifestXml.manifest?.dependencies)) {
      log.warn('manifest.xml is missing dependencies tag')
      return
    }

    const { dependencies } = manifestXml.manifest
    fixDependenciesObject(dependencies)
    cleanInvalidDependencies(dependencies)
    addRequiredDependencies(dependencies, customizationInfos)

    // eslint-disable-next-line new-cap
    const fixedDependencies = new xmlParser.j2xParser({
      ignoreAttributes: false,
      format: true,
    }).parse({ dependencies })
    const fixedManifestContent = manifestContent.replace(
      new RegExp('<dependencies>.*</dependencies>\\n?', 'gs'), fixedDependencies
    )
    await writeFile(manifestPath, fixedManifestContent)
  }

  private async runDeployCommands(
    { executor, projectPath, type }: Project,
    customizationInfos: CustomizationInfo[]
  ): Promise<void> {
    await this.executeProjectAction(COMMANDS.ADD_PROJECT_DEPENDENCIES, {}, executor)
    await SdfClient.fixManifest(projectPath, customizationInfos)
    await this.executeProjectAction(
      COMMANDS.DEPLOY_PROJECT,
      // SuiteApp project type can't contain account specific values
      // and thus the flag is not supported
      type === 'AccountCustomization' ? { accountspecificvalues: 'WARNING' } : {},
      executor
    )
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
