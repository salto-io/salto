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
  FetchResult,
  AdapterOperations,
  DeployResult,
  PostFetchOptions,
  DeployModifiers,
  FetchOptions,
  ElemIdGetter,
  DeployOptions,
  isInstanceChange,
  getChangeData,
  Change,
} from '@salto-io/adapter-api'
import {
  client as clientUtils,
  elements as elementUtils,
  fetch as fetchUtils,
  resolveChangeElement,
} from '@salto-io/adapter-components'
import { getParent, hasValidParent, logDuration } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import WorkatoClient from './client/client'
import fetchCriteria from './fetch_criteria'
import { FilterCreator, Filter, filtersRunner } from './filter'
import { ENABLE_DEPLOY_SUPPORT_FLAG, FETCH_CONFIG, WorkatoConfig } from './config'
import addRootFolderFilter from './filters/add_root_folder'
import fieldReferencesFilter from './filters/field_references'
import jiraProjectIssueTypeFilter from './filters/cross_service/jira/project_issuetypes'
import recipeCrossServiceReferencesFilter from './filters/cross_service/recipe_references'
import serviceUrlFilter from './filters/service_url'
import commonFilters from './filters/common'
import { DEPLOY_USING_RLM_GROUP, RECIPE_CODE_TYPE, WORKATO } from './constants'
import changeValidator from './change_validator'
import { paginate } from './client/pagination'
import { workatoLookUpName } from './reference_mapping'
import { resolveWorkatoValues, RLMDeploy } from './rlm'
import { getChangeGroupIds } from './group_change'

const log = logger(module)
const { createPaginator } = clientUtils
const { returnFullEntry } = elementUtils
const { getAllElements } = elementUtils.ducktype
const { simpleGetArgs } = fetchUtils.resource
const { awu } = collections.asynciterable

export const DEFAULT_FILTERS = [
  addRootFolderFilter,
  jiraProjectIssueTypeFilter,
  // fieldReferencesFilter should run after all element manipulations are done
  fieldReferencesFilter,
  recipeCrossServiceReferencesFilter,
  serviceUrlFilter,
  // referencedIdFieldsFilter and queryFilter should run after element references are resolved
  ...Object.values(commonFilters),
]

export interface WorkatoAdapterParams {
  filterCreators?: FilterCreator[]
  client: WorkatoClient
  config: WorkatoConfig
  // callback function to get an existing elemId or create a new one by the ServiceIds values
  getElemIdFunc?: ElemIdGetter
}

export default class WorkatoAdapter implements AdapterOperations {
  private createFiltersRunner: () => Required<Filter>
  private client: WorkatoClient
  private paginator: clientUtils.Paginator
  private userConfig: WorkatoConfig
  private getElemIdFunc?: ElemIdGetter
  private fetchQuery: elementUtils.query.ElementQuery

  public constructor({ filterCreators = DEFAULT_FILTERS, client, getElemIdFunc, config }: WorkatoAdapterParams) {
    this.userConfig = config
    this.client = client
    this.getElemIdFunc = getElemIdFunc
    const paginator = createPaginator({
      client: this.client,
      paginationFuncCreator: paginate,
    })
    this.paginator = paginator
    this.fetchQuery = elementUtils.query.createElementQuery(this.userConfig[FETCH_CONFIG], fetchCriteria)
    this.createFiltersRunner = () =>
      filtersRunner(
        {
          client,
          paginator,
          config: {
            fetch: config.fetch,
            apiDefinitions: config.apiDefinitions,
          },
          getElemIdFunc,
          fetchQuery: this.fetchQuery,
        },
        filterCreators,
      )
  }

  @logDuration('generating instances and types from service')
  private async getElements(): Promise<ReturnType<typeof getAllElements>> {
    return getAllElements({
      adapterName: WORKATO,
      types: this.userConfig.apiDefinitions.types,
      supportedTypes: this.userConfig.apiDefinitions.supportedTypes,
      fetchQuery: this.fetchQuery,
      paginator: this.paginator,
      nestedFieldFinder: returnFullEntry,
      computeGetArgs: simpleGetArgs,
      typeDefaults: this.userConfig.apiDefinitions.typeDefaults,
      getElemIdFunc: this.getElemIdFunc,
    })
  }

  /**
   * Fetch configuration elements in the given account.
   * Account credentials were given in the constructor.
   */
  @logDuration('fetching account configuration')
  async fetch({ progressReporter }: FetchOptions): Promise<FetchResult> {
    log.debug('going to fetch workato account configuration..')
    progressReporter.reportProgress({ message: 'Fetching types and instances' })
    const { elements, errors } = await this.getElements()
    log.debug('going to run filters on %d fetched elements', elements.length)
    progressReporter.reportProgress({ message: 'Running filters for additional information' })
    await this.createFiltersRunner().onFetch(elements)
    return { elements, errors }
  }

  @logDuration('updating cross-service references')
  async postFetch(args: PostFetchOptions): Promise<void> {
    args.progressReporter.reportProgress({ message: 'Adding references to other services post-fetch' })
    await this.createFiltersRunner().onPostFetch(args)
  }

  /**
   * Deploy configuration elements to the given account.
   */
  @logDuration('deploying account configuration')
  // eslint-disable-next-line class-methods-use-this
  async deploy({ changeGroup }: DeployOptions): Promise<DeployResult> {
    if (changeGroup.groupID !== DEPLOY_USING_RLM_GROUP || this.userConfig[ENABLE_DEPLOY_SUPPORT_FLAG] !== true) {
      throw new Error('Not implemented')
    }

    // resolving workato references
    const resolvedChanges = await awu(changeGroup.changes)
      .map(async change => resolveChangeElement(change, workatoLookUpName, resolveWorkatoValues))
      .toArray()

    const runner = this.createFiltersRunner()
    await runner.preDeploy(resolvedChanges)

    const instanceChanges = resolvedChanges.filter(isInstanceChange)
    const deployResult = await RLMDeploy(instanceChanges, this.client)

    const appliedChangesBeforeRestore: Change[] = [...deployResult.appliedChanges]
    await runner.onDeploy(appliedChangesBeforeRestore)

    const appliedChangeIDsBeforeRestore = new Set(
      appliedChangesBeforeRestore.map(change => getChangeData(change).elemID.getFullName()),
    )

    /* We don't need to update the id of the new recipes because rlm don't return the new id
     * It looks like Workato just works with the full path of the recipe
     * When importing a recipe, the returned id is null (probably a bug in the rlm)
     */
    const appliedChanges = changeGroup.changes.filter(change => {
      const changeData = getChangeData(change)
      return appliedChangeIDsBeforeRestore.has(
        isInstanceChange(change) && changeData.elemID.typeName === RECIPE_CODE_TYPE && hasValidParent(changeData)
          ? getParent(changeData).elemID.getFullName()
          : changeData.elemID.getFullName(),
      )
    })

    return {
      appliedChanges,
      errors: deployResult.errors,
    }
  }

  // eslint-disable-next-line class-methods-use-this
  public get deployModifiers(): DeployModifiers {
    return {
      changeValidator: changeValidator(this.userConfig),
      getChangeGroupIds,
    }
  }
}
