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
import _ from 'lodash'
import {
  FetchResult,
  AdapterOperations,
  DeployResult,
  DeployModifiers,
  FetchOptions,
  ElemIdGetter,
  InstanceElement,
  isObjectType,
  isInstanceChange,
  DeployOptions,
  Change,
  getChangeData,
  SaltoError,
  isSaltoError,
  ChangeValidator,
  DependencyChanger,
} from '@salto-io/adapter-api'
import { logDuration, restoreChangeElement, safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, objects, types } from '@salto-io/lowerdash'
import { Client } from '../../client/client_creator'
import { AdapterParams } from './types'
import { Filter, FilterResult, filterRunner } from '../../filter_utils'
import { getUpdatedCofigFromConfigChanges } from '../../config'
import { ApiDefinitions, UserConfig, createUserConfigType, queryWithDefault } from '../../definitions'
import { FetchElements, getElements } from '../../fetch'
import { ElementQuery, createElementQuery } from '../../fetch/query'
import {
  createChangeValidator,
  deployNotSupportedValidator,
  getDefaultChangeValidators,
} from '../../deployment/change_validators'
import { ParsedTypes, generateTypes } from '../../elements/swagger' // TODO switch to new infra (SALTO-5422)
import { generateLookupFunc } from '../../references'
import { overrideInstanceTypeForDeploy, restoreInstanceTypeFromChange } from '../../deployment'
import { createChangeElementResolver } from '../../resolve_utils'
import { getChangeGroupIdsFuncWithDefinitions } from '../../deployment/grouping'
import { combineDependencyChangers } from '../../deployment/dependency'

const log = logger(module)
const { awu } = collections.asynciterable

type FilterWithResult = Filter<FilterResult>

export class AdapterImpl<
  Credentials,
  Co extends UserConfig,
  ClientOptions extends string = 'main',
  PaginationOptions extends string | 'none' = 'none',
  AdditionalAction extends string = never,
> implements AdapterOperations
{
  protected createFiltersRunner: () => Required<FilterWithResult>
  protected clients: Record<ClientOptions, Client<Credentials>>
  protected fetchQuery: ElementQuery
  protected adapterName: string
  protected userConfig: Co
  protected configInstance?: InstanceElement
  protected getElemIdFunc?: ElemIdGetter
  protected changeValidators: Record<string, ChangeValidator>
  protected dependencyChangers: DependencyChanger[]
  protected definitions: types.PickyRequired<
    ApiDefinitions<ClientOptions, PaginationOptions, AdditionalAction>,
    'clients' | 'pagination' | 'fetch'
  >

  public constructor({
    adapterName,
    filterCreators,
    clients,
    config,
    configInstance,
    definitions,
    elementSource,
    getElemIdFunc,
    additionalChangeValidators,
    dependencyChangers,
  }: AdapterParams<Credentials, Co, ClientOptions, PaginationOptions, AdditionalAction>) {
    this.adapterName = adapterName
    this.clients = clients
    this.getElemIdFunc = getElemIdFunc
    this.definitions = definitions
    this.fetchQuery = createElementQuery(config.fetch)
    this.createFiltersRunner = () =>
      filterRunner<Co, FilterResult, {}, ClientOptions, PaginationOptions, AdditionalAction>(
        {
          fetchQuery: this.fetchQuery,
          definitions: this.definitions,
          config: this.userConfig,
          getElemIdFunc: this.getElemIdFunc,
          elementSource,
        },
        filterCreators,
        objects.concatObjects,
      )
    this.userConfig = config
    this.configInstance = configInstance
    this.changeValidators = {
      ...getDefaultChangeValidators(),
      ...(this.definitions.deploy?.instances === undefined ? { deployNotSupported: deployNotSupportedValidator } : {}),
      ...additionalChangeValidators,
    }
    // TODO combine with infra changers after SALTO-5571
    this.dependencyChangers = dependencyChangers ?? []
  }

  @logDuration('generating types from swagger')
  private async getAllSwaggerTypes(): Promise<ParsedTypes> {
    return _.defaults(
      {},
      ...(await Promise.all(
        collections.array.makeArray(this.definitions.sources?.openAPI).map(def =>
          generateTypes(
            this.adapterName,
            // TODO re-implement with definitions and add missing functionality (SALTO-5422)
            {
              supportedTypes: {},
              typeDefaults: { transformation: { idFields: [] } },
              types: {},
              swagger: {
                url: def.url,
              },
            },
          ),
        ),
      )),
    )
  }

  /**
   * Fetch configuration elements in the given sap account.
   * Account credentials were given in the constructor.
   */
  @logDuration('fetching account configuration')
  async getElements(): Promise<FetchElements> {
    const { allTypes, parsedConfigs } = await this.getAllSwaggerTypes()
    log.debug('Full parsed configuration from swaggers: %s', safeJsonStringify(parsedConfigs))

    const res = await getElements({
      adapterName: this.adapterName,
      fetchQuery: this.fetchQuery,
      definitions: this.definitions,
      getElemIdFunc: this.getElemIdFunc,
      predefinedTypes: _.pickBy(allTypes, isObjectType),
    })
    return res
  }

  /**
   * Fetch configuration elements in the given account.
   * Account credentials were given in the constructor.
   */
  @logDuration('fetching account configuration')
  async fetch({ progressReporter }: FetchOptions): Promise<FetchResult> {
    log.debug(`going to fetch (${this.adapterName}) account configuration`)
    progressReporter.reportProgress({ message: 'Fetching elements' })

    const { elements, configChanges, errors } = await this.getElements()

    log.debug('going to run filters on %d fetched elements', elements.length)
    progressReporter.reportProgress({ message: 'Running filters for additional information' })

    const result = (await this.createFiltersRunner().onFetch(elements)) || {}

    const updatedConfig =
      this.configInstance && configChanges
        ? getUpdatedCofigFromConfigChanges({
            configChanges,
            currentConfig: this.configInstance,
            configType: createUserConfigType({ adapterName: this.adapterName }),
          })
        : undefined

    const fetchErrors = (errors ?? []).concat(result.errors ?? [])

    return { elements, errors: fetchErrors, updatedConfig }
  }

  /**
   * Deploy configuration elements to the given account.
   */
  @logDuration('deploying account configuration')
  async deploy({ changeGroup }: DeployOptions): Promise<DeployResult> {
    const [instanceChanges, nonInstanceChanges] = _.partition(changeGroup.changes, isInstanceChange)
    if (nonInstanceChanges.length > 0) {
      log.warn(
        `We currently can't deploy types. Therefore, the following changes will not be deployed: ${nonInstanceChanges.map(elem => getChangeData(elem).elemID.getFullName()).join(', ')}`,
      )
    }
    if (instanceChanges.length === 0) {
      log.warn(`no instance changes in group ${changeGroup.groupID}`)
      return {
        appliedChanges: [],
        errors: [],
      }
    }
    if (this.definitions.deploy?.instances === undefined) {
      // not supposed to happen if we didn't fail on a change validator
      return {
        appliedChanges: [],
        errors: [
          {
            message: 'no deploy definitions found, cannot deploy changes',
            severity: 'Error',
          },
        ],
      }
    }

    // TODO SALTO-5406 allow passing in a custom fieldReferenceResolverCreator
    const lookupFunc = generateLookupFunc(this.definitions.references?.rules ?? [])

    const changesToDeploy = instanceChanges.map(change => ({
      action: change.action,
      data: _.mapValues(change.data, (instance: InstanceElement) =>
        // overriding instance types before running the filters
        // TODO decide if should be done for types generated from swagger
        overrideInstanceTypeForDeploy({
          instance,
          defQuery: queryWithDefault(this.definitions.fetch.instances),
        }),
      ),
    })) as Change<InstanceElement>[]
    const sourceChanges = _.keyBy(changesToDeploy, change => getChangeData(change).elemID.getFullName())
    const runner = this.createFiltersRunner()
    const deployDefQuery = queryWithDefault(this.definitions.deploy.instances)
    const changeResolver = createChangeElementResolver({ getLookUpName: lookupFunc })
    const resolvedChanges = await awu(changesToDeploy)
      .map(async change =>
        deployDefQuery.query(getChangeData(change).elemID.typeName)?.referenceResolution?.when === 'early'
          ? changeResolver(change)
          : change,
      )
      .toArray()
    const saltoErrors: SaltoError[] = []
    try {
      await runner.preDeploy(resolvedChanges)
    } catch (e) {
      if (!isSaltoError(e)) {
        throw e
      }
      return {
        appliedChanges: [],
        errors: [e],
      }
    }
    const { deployResult } = await runner.deploy(resolvedChanges, changeGroup)
    const appliedChangesBeforeRestore = [...deployResult.appliedChanges]
    try {
      await runner.onDeploy(appliedChangesBeforeRestore)
    } catch (e) {
      if (!isSaltoError(e)) {
        throw e
      }
      saltoErrors.push(e)
    }

    const appliedChanges = await awu(appliedChangesBeforeRestore)
      .map(change => restoreChangeElement(change, sourceChanges, lookupFunc))
      .toArray()
    const restoredAppliedChanges = restoreInstanceTypeFromChange({
      appliedChanges,
      originalInstanceChanges: instanceChanges,
    })
    return {
      appliedChanges: restoredAppliedChanges,
      errors: deployResult.errors.concat(saltoErrors),
    }
  }

  public get deployModifiers(): DeployModifiers {
    const changeValidator = createChangeValidator({ validators: this.changeValidators })

    if (this.definitions.deploy?.instances !== undefined) {
      return {
        changeValidator,
        getChangeGroupIds: getChangeGroupIdsFuncWithDefinitions(this.definitions.deploy.instances),
        dependencyChanger:
          this.dependencyChangers !== undefined ? combineDependencyChangers(this.dependencyChangers) : undefined,
      }
    }
    return {
      changeValidator,
    }
  }
}
