/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import {
  elements as elementUtils,
  fetch as fetchUtils,
  definitions as definitionsUtils,
  resolveChangeElement,
} from '@salto-io/adapter-components'
import { applyFunctionToChangeData, getParent, hasValidParent, logDuration } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import WorkatoClient from './client/client'
import fetchCriteria from './fetch_criteria'
import { FilterCreator, Filter, filterRunner } from './filter'
import addRootFolderFilter from './filters/add_root_folder'
import fieldReferencesFilter from './filters/field_references'
import jiraProjectIssueTypeFilter from './filters/cross_service/jira/project_issuetypes'
import recipeCrossServiceReferencesFilter from './filters/cross_service/recipe_references'
import serviceUrlFilter from './filters/service_url'
import commonFilters from './filters/common'
import { DEPLOY_USING_RLM_GROUP, RECIPE_CODE_TYPE, WORKATO } from './constants'
import changeValidator from './change_validator'
import { workatoLookUpName } from './reference_mapping'
import { resolveWorkatoValues, RLMDeploy } from './rlm'
import { getChangeGroupIds } from './group_change'
import { WorkatoOptions } from './definitions/types'
import { createClientDefinitions } from './definitions/requests/clients'
import { PAGINATION } from './definitions/requests/pagination'
import { createFetchDefinitions } from './definitions/fetch'
import { WorkatoUserConfig, ENABLE_DEPLOY_SUPPORT_FLAG } from './user_config'

const log = logger(module)
const { awu } = collections.asynciterable

const DEFAULT_FILTERS = [
  addRootFolderFilter,
  jiraProjectIssueTypeFilter,
  // fieldReferencesFilter should run after all element manipulations are done
  fieldReferencesFilter,
  recipeCrossServiceReferencesFilter,
  serviceUrlFilter,
  // referencedIdFieldsFilter and queryFilter should run after element references are resolved
  ...Object.values(commonFilters),
]

interface WorkatoAdapterParams {
  filterCreators?: FilterCreator[]
  client: WorkatoClient
  config: WorkatoUserConfig
  elementsSource: ReadOnlyElementsSource
  accountName?: string
  // callback function to get an existing elemId or create a new one by the ServiceIds values
  getElemIdFunc?: ElemIdGetter
}

export default class WorkatoAdapter implements AdapterOperations {
  private createFiltersRunner: () => Required<Filter>
  private client: WorkatoClient
  private userConfig: WorkatoUserConfig
  private getElemIdFunc?: ElemIdGetter
  private definitions: definitionsUtils.RequiredDefinitions<WorkatoOptions>
  private fetchQuery: elementUtils.query.ElementQuery
  private accountName?: string

  public constructor({
    filterCreators = DEFAULT_FILTERS,
    client,
    getElemIdFunc,
    config,
    accountName,
    elementsSource,
  }: WorkatoAdapterParams) {
    this.userConfig = config
    this.client = client
    this.getElemIdFunc = getElemIdFunc
    this.fetchQuery = elementUtils.query.createElementQuery(this.userConfig.fetch, fetchCriteria)
    this.accountName = accountName

    const definitions = {
      clients: createClientDefinitions({ main: this.client }),
      pagination: PAGINATION,
      fetch: createFetchDefinitions(this.userConfig),
    }

    this.definitions = definitionsUtils.mergeDefinitionsWithOverrides(
      {
        ...definitions,
        fetch: definitionsUtils.mergeWithUserElemIDDefinitions({
          userElemID: this.userConfig.fetch.elemID,
          fetchConfig: definitions.fetch,
        }),
      },
      this.accountName,
    )

    this.createFiltersRunner = () =>
      filterRunner(
        {
          config: {
            fetch: config.fetch,
          },
          getElemIdFunc,
          fetchQuery: this.fetchQuery,
          definitions: this.definitions,
          elementSource: elementsSource,
          sharedContext: {},
        },
        filterCreators,
      )
  }

  @logDuration('generating instances and types from service')
  private async getElements(): Promise<fetchUtils.FetchElements> {
    return fetchUtils.getElements({
      adapterName: WORKATO,
      fetchQuery: this.fetchQuery,
      definitions: this.definitions,
      getElemIdFunc: this.getElemIdFunc,
      // parent_id is used as a query param for /folders recursion
      additionalRequestContext: { parent_id: [''] },
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
  async deploy({ changeGroup }: DeployOptions): Promise<DeployResult> {
    if (changeGroup.groupID !== DEPLOY_USING_RLM_GROUP || this.userConfig[ENABLE_DEPLOY_SUPPORT_FLAG] !== true) {
      throw new Error('Not implemented')
    }

    const instanceChanges = await awu(changeGroup.changes)
      .filter(isInstanceChange)
      // resolving workato references
      .map(async change => resolveChangeElement(change, workatoLookUpName, resolveWorkatoValues))
      // revert nacl case applied during fetch
      .map(change =>
        applyFunctionToChangeData(change, instance => {
          instance.value = fetchUtils.element.recursiveNaclCase(instance.value, true)
          return instance
        }),
      )
      .toArray()

    const runner = this.createFiltersRunner()
    await runner.preDeploy(instanceChanges)

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

  public get deployModifiers(): DeployModifiers {
    return {
      changeValidator: changeValidator(this.userConfig),
      getChangeGroupIds,
    }
  }
}
