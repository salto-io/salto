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
  TypeElement,
  ObjectType,
  InstanceElement,
  isAdditionChange,
  getChangeData,
  Change,
  ElemIdGetter,
  FetchResult,
  FixElementsFunc,
  AdapterOperations,
  DeployResult,
  FetchOptions,
  DeployOptions,
  ReadOnlyElementsSource,
  ElemID,
  PartialFetchData,
  Element,
  ProgressReporter,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { filter, logDuration, safeJsonStringify } from '@salto-io/adapter-utils'
import {
  resolveChangeElement,
  restoreChangeElement,
} from '@salto-io/adapter-components'
import { MetadataObject } from '@salto-io/jsforce'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections, values, promises, objects } from '@salto-io/lowerdash'
import SalesforceClient from './client/client'
import * as constants from './constants'
import {
  apiName,
  Types,
  isMetadataObjectType,
  MetadataObjectType,
  createInstanceElement,
  isCustom,
} from './transformers/transformer'
import layoutFilter from './filters/layouts'
import customObjectsFromDescribeFilter from './filters/custom_objects_from_soap_describe'
import customObjectsToObjectTypeFilter, {
  NESTED_INSTANCE_VALUE_TO_TYPE_NAME,
} from './filters/custom_objects_to_object_type'
import customSettingsFilter from './filters/custom_settings_filter'
import customTypeSplit from './filters/custom_type_split'
import customObjectAuthorFilter from './filters/author_information/custom_objects'
import dataInstancesAuthorFilter from './filters/author_information/data_instances'
import sharingRulesAuthorFilter from './filters/author_information/sharing_rules'
import profileInstanceSplitFilter from './filters/profile_instance_split'
import customObjectsInstancesFilter from './filters/custom_objects_instances'
import profilePermissionsFilter from './filters/profile_permissions'
import emailTemplateFilter from './filters/email_template_static_files'
import minifyDeployFilter from './filters/minify_deploy'
import convertListsFilter from './filters/convert_lists'
import convertTypeFilter from './filters/convert_types'
import removeFieldsAndValuesFilter from './filters/remove_fields_and_values'
import removeRestrictionAnnotationsFilter from './filters/remove_restriction_annotations'
import standardValueSetFilter from './filters/standard_value_sets'
import flowFilter from './filters/flow'
import addMissingIdsFilter from './filters/add_missing_ids'
import animationRulesFilter from './filters/animation_rules'
import samlInitMethodFilter from './filters/saml_initiation_method'
import settingsFilter from './filters/settings_type'
import workflowFilter, { WORKFLOW_FIELD_TO_TYPE } from './filters/workflow'
import topicsForObjectsFilter from './filters/topics_for_objects'
import globalValueSetFilter from './filters/global_value_sets'
import referenceAnnotationsFilter from './filters/reference_annotations'
import fieldReferencesFilter from './filters/field_references'
import customObjectInstanceReferencesFilter from './filters/custom_object_instances_references'
import foreignKeyReferencesFilter from './filters/foreign_key_references'
import cpqLookupFieldsFilter from './filters/cpq/lookup_fields'
import cpqCustomScriptFilter from './filters/cpq/custom_script'
import cpqReferencableFieldReferencesFilter from './filters/cpq/referencable_field_references'
import hideReadOnlyValuesFilter from './filters/cpq/hide_read_only_values'
import extraDependenciesFilter from './filters/extra_dependencies'
import staticResourceFileExtFilter from './filters/static_resource_file_ext'
import xmlAttributesFilter from './filters/xml_attributes'
import profilePathsFilter from './filters/profile_paths'
import replaceFieldValuesFilter from './filters/replace_instance_field_values'
import valueToStaticFileFilter from './filters/value_to_static_file'
import convertMapsFilter from './filters/convert_maps'
import elementsUrlFilter from './filters/elements_url'
import territoryFilter from './filters/territory'
import customMetadataRecordsFilter from './filters/custom_metadata'
import currencyIsoCodeFilter from './filters/currency_iso_code'
import enumFieldPermissionsFilter from './filters/field_permissions_enum'
import splitCustomLabels from './filters/split_custom_labels'
import flowsFilter from './filters/flows_filter'
import hideTypesFolder from './filters/hide_types_folder'
import customMetadataToObjectTypeFilter from './filters/custom_metadata_to_object_type'
import installedPackageGeneratedDependencies from './filters/installed_package_generated_dependencies'
import createMissingInstalledPackagesInstancesFilter from './filters/create_missing_installed_packages_instances'
import metadataInstancesAliasesFilter from './filters/metadata_instances_aliases'
import formulaDepsFilter from './filters/formula_deps'
import removeUnixTimeZeroFilter from './filters/remove_unix_time_zero'
import organizationWideDefaults from './filters/organization_settings'
import centralizeTrackingInfoFilter from './filters/centralize_tracking_info'
import changedAtSingletonFilter from './filters/changed_at_singleton'
import importantValuesFilter from './filters/important_values_filter'
import omitStandardFieldsNonDeployableValuesFilter from './filters/omit_standard_fields_non_deployable_values'
import generatedDependenciesFilter from './filters/generated_dependencies'
import {
  CUSTOM_REFS_CONFIG,
  FetchElements,
  FetchProfile,
  MetadataQuery,
  SalesforceConfig,
} from './types'
import mergeProfilesWithSourceValuesFilter from './filters/merge_profiles_with_source_values'
import { getConfigFromConfigChanges } from './config_change'
import {
  LocalFilterCreator,
  Filter,
  FilterResult,
  RemoteFilterCreator,
  LocalFilterCreatorDefinition,
  RemoteFilterCreatorDefinition,
  FilterContext,
} from './filter'
import {
  addDefaults,
  apiNameSync,
  buildDataRecordsSoqlQueries,
  getFLSProfiles,
  getFullName,
  instanceInternalId,
  isCustomObjectSync,
  isCustomType,
  isInstanceOfCustomObjectSync,
  isMetadataInstanceElementSync,
  listMetadataObjects,
  metadataTypeSync,
  queryClient,
} from './filters/utils'
import {
  retrieveMetadataInstances,
  fetchMetadataType,
  fetchMetadataInstances,
  retrieveMetadataInstanceForFetchWithChangesDetection,
} from './fetch'
import {
  isCustomObjectInstanceChanges,
  deployCustomObjectInstancesGroup,
} from './custom_object_instances_deploy'
import {
  getLookUpName,
  getLookupNameForDataInstances,
} from './transformers/reference_mapping'
import { deployMetadata, NestedMetadataTypeInfo } from './metadata_deploy'
import nestedInstancesAuthorInformation from './filters/author_information/nested_instances'
import { buildFetchProfile } from './fetch_profile/fetch_profile'
import {
  ArtificialTypes,
  CUSTOM_FIELD,
  CUSTOM_OBJECT,
  CUSTOM_OBJECT_ID_FIELD,
  FLOW_METADATA_TYPE,
  LAST_MODIFIED_DATE,
  OWNER_ID,
  PROFILE_METADATA_TYPE,
} from './constants'
import {
  buildFilePropsMetadataQuery,
  buildMetadataQuery,
  buildMetadataQueryForFetchWithChangesDetection,
} from './fetch_profile/metadata_query'
import { getLastChangeDateOfTypesWithNestedInstances } from './last_change_date_of_types_with_nested_instances'
import { fixElementsFunc } from './custom_references/handlers'

const { awu } = collections.asynciterable
const { partition } = promises.array
const { concatObjects } = objects
const { isDefined } = values

const log = logger(module)

export const allFilters: Array<
  LocalFilterCreatorDefinition | RemoteFilterCreatorDefinition
> = [
  {
    creator: createMissingInstalledPackagesInstancesFilter,
    addsNewInformation: true,
  },
  { creator: settingsFilter, addsNewInformation: true },
  // should run before customObjectsFilter
  { creator: workflowFilter },
  // fetchFlowsFilter should run before flowFilter
  { creator: flowsFilter, addsNewInformation: true },
  // customMetadataToObjectTypeFilter should run before customObjectsFromDescribeFilter
  { creator: customMetadataToObjectTypeFilter },
  // customObjectsFilter depends on missingFieldsFilter and settingsFilter
  { creator: customObjectsFromDescribeFilter, addsNewInformation: true },
  { creator: organizationWideDefaults, addsNewInformation: true },
  // customSettingsFilter depends on customObjectsFilter
  { creator: customSettingsFilter, addsNewInformation: true },
  { creator: customObjectsToObjectTypeFilter },
  // customObjectsInstancesFilter depends on customObjectsToObjectTypeFilter
  { creator: customObjectsInstancesFilter, addsNewInformation: true },
  { creator: removeFieldsAndValuesFilter },
  { creator: removeRestrictionAnnotationsFilter },
  // addMissingIdsFilter should run after customObjectsFilter
  { creator: addMissingIdsFilter, addsNewInformation: true },
  { creator: customMetadataRecordsFilter },
  { creator: layoutFilter },
  // profilePermissionsFilter depends on layoutFilter because layoutFilter
  // changes ElemIDs that the profile references
  { creator: profilePermissionsFilter },
  // emailTemplateFilter should run before convertMapsFilter
  { creator: emailTemplateFilter },
  // convertMapsFilter should run before profile fieldReferencesFilter
  { creator: convertMapsFilter },
  { creator: standardValueSetFilter, addsNewInformation: true },
  { creator: flowFilter },
  { creator: customObjectInstanceReferencesFilter, addsNewInformation: true },
  { creator: cpqReferencableFieldReferencesFilter },
  { creator: cpqCustomScriptFilter },
  { creator: cpqLookupFieldsFilter },
  { creator: animationRulesFilter },
  { creator: samlInitMethodFilter },
  { creator: topicsForObjectsFilter },
  { creator: globalValueSetFilter },
  { creator: staticResourceFileExtFilter },
  { creator: profilePathsFilter, addsNewInformation: true },
  { creator: territoryFilter },
  { creator: elementsUrlFilter, addsNewInformation: true },
  { creator: nestedInstancesAuthorInformation, addsNewInformation: true },
  { creator: customObjectAuthorFilter, addsNewInformation: true },
  { creator: dataInstancesAuthorFilter, addsNewInformation: true },
  { creator: sharingRulesAuthorFilter, addsNewInformation: true },
  { creator: hideReadOnlyValuesFilter },
  { creator: currencyIsoCodeFilter },
  { creator: splitCustomLabels },
  { creator: xmlAttributesFilter },
  { creator: minifyDeployFilter },
  { creator: formulaDepsFilter },
  // centralizeTrackingInfoFilter depends on customObjectsToObjectTypeFilter and must run before customTypeSplit
  { creator: centralizeTrackingInfoFilter },
  // The following filters should remain last in order to make sure they fix all elements
  { creator: convertListsFilter },
  { creator: convertTypeFilter },
  // should be after convertTypeFilter & convertMapsFilter and before profileInstanceSplitFilter
  { creator: enumFieldPermissionsFilter },
  // should run after convertListsFilter
  { creator: replaceFieldValuesFilter },
  { creator: valueToStaticFileFilter },
  { creator: fieldReferencesFilter },
  // should run after customObjectsInstancesFilter for now
  { creator: referenceAnnotationsFilter },
  // foreignLeyReferences should come after referenceAnnotationsFilter
  { creator: foreignKeyReferencesFilter },
  // extraDependenciesFilter should run after addMissingIdsFilter
  { creator: extraDependenciesFilter, addsNewInformation: true },
  { creator: installedPackageGeneratedDependencies },
  { creator: omitStandardFieldsNonDeployableValuesFilter },
  // customTypeSplit should run after omitStandardFieldsNonDeployableValuesFilter
  { creator: customTypeSplit },
  { creator: mergeProfilesWithSourceValuesFilter },
  // profileInstanceSplitFilter should run after mergeProfilesWithSourceValuesFilter
  { creator: profileInstanceSplitFilter },
  // Any filter that relies on _created_at or _changed_at should run after removeUnixTimeZero
  { creator: removeUnixTimeZeroFilter },
  { creator: metadataInstancesAliasesFilter },
  { creator: importantValuesFilter },
  { creator: hideTypesFolder },
  { creator: generatedDependenciesFilter },
  // createChangedAtSingletonInstanceFilter should run last
  { creator: changedAtSingletonFilter },
]

// By default we run all filters and provide a client
const defaultFilters = allFilters.map(({ creator }) => creator)

export interface SalesforceAdapterParams {
  // Max items to fetch in one retrieve request
  maxItemsInRetrieveRequest?: number

  // Metadata types that are being fetched in the filters
  metadataTypesOfInstancesFetchedInFilters?: string[]

  // Metadata types that we have to fetch using the retrieve API
  metadataToRetrieve?: string[]

  // Metadata types that we should not create, update or delete in the main adapter code
  metadataTypesToSkipMutation?: string[]

  // Metadata types that that include metadata types inside them
  nestedMetadataTypes?: Record<string, NestedMetadataTypeInfo>

  // Filters to deploy to all adapter operations
  filterCreators?: Array<LocalFilterCreator | RemoteFilterCreator>

  // client to use
  client: SalesforceClient

  // callback function to get an existing elemId or create a new one by the ServiceIds values
  getElemIdFunc?: ElemIdGetter

  // System fields that salesforce may add to custom objects - to be ignored when creating objects
  systemFields?: string[]

  // Unsupported System fields that salesforce may add to custom objects
  // to not be fetched and managed
  unsupportedSystemFields?: string[]

  config: SalesforceConfig

  elementsSource: ReadOnlyElementsSource
}

const METADATA_TO_RETRIEVE = [
  // Metadata with content - we use retrieve to get the StaticFiles properly
  'ApexClass', // contains encoded zip content
  'ApexComponent', // contains encoded zip content
  'ApexPage', // contains encoded zip content
  'ApexTrigger', // contains encoded zip content
  'AssignmentRules', // contains encoded zip content
  'AuraDefinitionBundle', // Has several fields with base64Binary encoded content
  'Certificate', // contains encoded zip content
  'ContentAsset', // contains encoded zip content
  'CustomApplication',
  'CustomMetadata', // For the XML attributes
  'CustomObject',
  'CustomPermission',
  'Dashboard', // contains encoded zip content, is under a folder
  'DashboardFolder',
  'Document', // contains encoded zip content, is under a folder
  'DocumentFolder',
  'EclairGeoData', // contains encoded zip content
  'EmailFolder',
  'EmailTemplate', // contains encoded zip content, is under a folder
  'EmbeddedServiceConfig',
  'ExperienceBundle',
  'ExternalDataSource',
  'FlexiPage',
  'FlowDefinition',
  'LightningComponentBundle', // Has several fields with base64Binary encoded content
  'NetworkBranding', // contains encoded zip content
  'Profile',
  'PermissionSet',
  'Report', // contains encoded zip content, is under a folder
  'ReportFolder',
  'ReportType',
  'Scontrol', // contains encoded zip content
  'SharingRules',
  'SiteDotCom', // contains encoded zip content
  'StaticResource', // contains encoded zip content
  // Other types that need retrieve / deploy to work
  'InstalledPackage', // listMetadataObjects of this types returns duplicates
  'Territory2', // All Territory2 types do not support CRUD
  'Territory2Model', // All Territory2 types do not support CRUD
  'Territory2Rule', // All Territory2 types do not support CRUD
  'Territory2Type', // All Territory2 types do not support CRUD
  'TopicsForObjects',
  'Layout', // retrieve returns more information about relatedLists
  'Workflow',
]

// See: https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/sforce_api_objects_custom_object__c.htm
export const SYSTEM_FIELDS = [
  'ConnectionReceivedId',
  'ConnectionSentId',
  'CreatedById',
  'CreatedDate',
  'Id',
  'IsDeleted',
  'LastActivityDate',
  LAST_MODIFIED_DATE,
  'LastModifiedById',
  'LastReferencedDate',
  'LastViewedDate',
  'Name',
  'RecordTypeId',
  'SystemModstamp',
  OWNER_ID,
  'SetupOwnerId',
]

export const UNSUPPORTED_SYSTEM_FIELDS = [
  'LastReferencedDate',
  'LastViewedDate',
]

const getMetadataTypesFromElementsSource = async (
  elementsSource: ReadOnlyElementsSource,
): Promise<MetadataObjectType[]> =>
  awu(await elementsSource.getAll())
    .filter(isMetadataObjectType)
    // standard and custom objects
    .filter((metadataType) => !isCustomObjectSync(metadataType))
    // custom types (CustomMetadata / CustomObject (non standard) / CustomSettings)
    .filter((metadataType) => !isCustomType(metadataType))
    // settings types
    .filter((metadataType) => !metadataType.isSettings)
    .toArray()

type CreateFiltersRunnerParams = {
  fetchProfile: FetchProfile
  contextOverrides?: Partial<FilterContext>
}

export default class SalesforceAdapter implements AdapterOperations {
  private maxItemsInRetrieveRequest: number
  private metadataToRetrieve: string[]
  private metadataTypesOfInstancesFetchedInFilters: string[]
  private nestedMetadataTypes: Record<string, NestedMetadataTypeInfo>
  private createFiltersRunner: (
    params: CreateFiltersRunnerParams,
  ) => Required<Filter>

  private client: SalesforceClient
  private userConfig: SalesforceConfig
  private elementsSource: ReadOnlyElementsSource
  private listedInstancesByType: collections.map.DefaultMap<string, Set<string>>
  private fixElementsFunc: FixElementsFunc

  public constructor({
    metadataTypesOfInstancesFetchedInFilters = [FLOW_METADATA_TYPE],
    maxItemsInRetrieveRequest = constants.DEFAULT_MAX_ITEMS_IN_RETRIEVE_REQUEST,
    metadataToRetrieve = METADATA_TO_RETRIEVE,
    nestedMetadataTypes = {
      CustomLabels: {
        nestedInstanceFields: ['labels'],
        isNestedApiNameRelative: false,
      },
      AssignmentRules: {
        nestedInstanceFields: ['assignmentRule'],
        isNestedApiNameRelative: true,
      },
      AutoResponseRules: {
        nestedInstanceFields: ['autoresponseRule'],
        isNestedApiNameRelative: true,
      },
      EscalationRules: {
        nestedInstanceFields: ['escalationRule'],
        isNestedApiNameRelative: true,
      },
      MatchingRules: {
        nestedInstanceFields: ['matchingRules'],
        isNestedApiNameRelative: true,
      },
      SharingRules: {
        nestedInstanceFields: [
          'sharingCriteriaRules',
          'sharingGuestRules',
          'sharingOwnerRules',
          'sharingTerritoryRules',
        ],
        isNestedApiNameRelative: true,
      },
      Workflow: {
        nestedInstanceFields: Object.keys(WORKFLOW_FIELD_TO_TYPE),
        isNestedApiNameRelative: true,
      },
      CustomObject: {
        nestedInstanceFields: [
          ...Object.keys(NESTED_INSTANCE_VALUE_TO_TYPE_NAME),
          'fields',
        ],
        isNestedApiNameRelative: true,
      },
    },
    filterCreators = defaultFilters,
    client,
    getElemIdFunc,
    elementsSource,
    systemFields = SYSTEM_FIELDS,
    unsupportedSystemFields = UNSUPPORTED_SYSTEM_FIELDS,
    config,
  }: SalesforceAdapterParams) {
    this.maxItemsInRetrieveRequest =
      config.maxItemsInRetrieveRequest ?? maxItemsInRetrieveRequest
    this.metadataToRetrieve = metadataToRetrieve
    this.userConfig = config
    this.metadataTypesOfInstancesFetchedInFilters =
      metadataTypesOfInstancesFetchedInFilters
    this.nestedMetadataTypes = nestedMetadataTypes
    this.listedInstancesByType = new collections.map.DefaultMap(() => new Set())
    this.client = new Proxy(client, {
      get: (target, propertyKey) => {
        if (propertyKey === 'listMetadataObjects') {
          // This proxy populates the listedInstancesByType
          // which is later used to detect deleted elements in partial fetch
          const proxyListMetadataObjects: SalesforceClient['listMetadataObjects'] =
            (...args) =>
              target
                .listMetadataObjects(...args)
                .then((listMetadataObjectsResult) => {
                  _(listMetadataObjectsResult.result)
                    .groupBy(({ type }) => type)
                    .forEach((props, typeName) => {
                      const listedInstances =
                        this.listedInstancesByType.get(typeName)
                      props.forEach((prop) =>
                        listedInstances.add(getFullName(prop)),
                      )
                    })
                  return listMetadataObjectsResult
                })
          return proxyListMetadataObjects
        }
        return target[propertyKey as keyof SalesforceClient]
      },
    })
    this.elementsSource = elementsSource
    this.createFiltersRunner = ({
      fetchProfile,
      contextOverrides = {},
    }: CreateFiltersRunnerParams) =>
      filter.filtersRunner(
        {
          client: this.client,
          config: {
            unsupportedSystemFields,
            systemFields,
            enumFieldPermissions:
              config.enumFieldPermissions ??
              constants.DEFAULT_ENUM_FIELD_PERMISSIONS,
            fetchProfile,
            elementsSource,
            separateFieldToFiles:
              config.fetch?.metadata?.objectsToSeperateFieldsToFiles,
            flsProfiles: getFLSProfiles(config),
            ...contextOverrides,
          },
        },
        filterCreators,
        concatObjects,
      )
    if (getElemIdFunc) {
      Types.setElemIdGetter(getElemIdFunc)
    }
    this.fixElementsFunc = fixElementsFunc({ elementsSource, config })
  }

  private async getCustomObjectsWithDeletedFields(): Promise<Set<string>> {
    await listMetadataObjects(this.client, CUSTOM_FIELD)
    const listedFields = this.listedInstancesByType.get(constants.CUSTOM_FIELD)
    const fieldsFromElementsSource = await awu(
      await this.elementsSource.getAll(),
    )
      .filter(isCustomObjectSync)
      .flatMap((obj) => Object.values(obj.fields))
      .filter((field) => isCustom(apiNameSync(field)))
      .toArray()
    return new Set(
      fieldsFromElementsSource
        .filter((field) => !listedFields.has(apiNameSync(field) ?? ''))
        .map((field) => apiNameSync(field.parent))
        .filter(isDefined),
    )
  }

  /**
   * Fetch configuration elements (types and instances in the given salesforce account)
   * Account credentials were given in the constructor.
   */
  @logDuration('fetching account configuration')
  async fetch({
    progressReporter,
    withChangesDetection = false,
  }: FetchOptions): Promise<FetchResult> {
    const fetchParams = this.userConfig.fetch ?? {}
    const baseQuery = buildMetadataQuery({ fetchParams })
    const lastChangeDateOfTypesWithNestedInstances =
      await getLastChangeDateOfTypesWithNestedInstances({
        client: this.client,
        metadataQuery: buildFilePropsMetadataQuery(baseQuery),
      })
    const metadataQuery = withChangesDetection
      ? await buildMetadataQueryForFetchWithChangesDetection({
          fetchParams,
          elementsSource: this.elementsSource,
          lastChangeDateOfTypesWithNestedInstances,
          customObjectsWithDeletedFields:
            await this.getCustomObjectsWithDeletedFields(),
        })
      : buildMetadataQuery({ fetchParams })
    const fetchProfile = buildFetchProfile({
      fetchParams,
      customReferencesSettings: this.userConfig[CUSTOM_REFS_CONFIG],
      metadataQuery,
      maxItemsInRetrieveRequest: this.maxItemsInRetrieveRequest,
    })
    if (!fetchProfile.isFeatureEnabled('fetchCustomObjectUsingRetrieveApi')) {
      // We have to fetch custom objects using retrieve in order to be able to fetch the field-level permissions
      // in profiles. If custom objects are fetched via the read API, we have to fetch profiles using that API too.
      _.pull(this.metadataToRetrieve, CUSTOM_OBJECT, PROFILE_METADATA_TYPE)
    }
    if (fetchProfile.isFeatureEnabled('fetchProfilesUsingReadApi')) {
      _.pull(this.metadataToRetrieve, PROFILE_METADATA_TYPE)
    }
    log.debug('going to fetch salesforce account configuration..')
    const fieldTypes = Types.getAllFieldTypes()
    const hardCodedTypes = [
      // Missing Metadata subtypes will come from the elementsSource. We want to avoid duplicates
      ...(withChangesDetection ? [] : Types.getAllMissingTypes()),
      ...Types.getAnnotationTypes(),
      ...Object.values(ArtificialTypes),
    ]
    const metadataTypeInfosPromise = this.listMetadataTypes(
      fetchProfile.metadataQuery,
    )
    const metadataTypesPromise = withChangesDetection
      ? getMetadataTypesFromElementsSource(this.elementsSource)
      : this.fetchMetadataTypes(metadataTypeInfosPromise, hardCodedTypes)
    progressReporter.reportProgress({ message: 'Fetching types' })
    const metadataTypes = await metadataTypesPromise

    const metadataInstancesPromise = this.fetchMetadataInstances(
      metadataTypeInfosPromise,
      metadataTypesPromise,
      fetchProfile,
    )
    progressReporter.reportProgress({ message: 'Fetching instances' })
    const {
      elements: metadataInstancesElements,
      configChanges: metadataInstancesConfigInstances,
    } = await metadataInstancesPromise
    const elements = [
      ...fieldTypes,
      ...hardCodedTypes,
      ...metadataTypes,
      ...metadataInstancesElements,
    ]
    progressReporter.reportProgress({
      message: 'Running filters for additional information',
    })
    const fetchFiltersRunner = this.createFiltersRunner({
      fetchProfile,
      contextOverrides: { lastChangeDateOfTypesWithNestedInstances },
    })
    const onFetchFilterResult = (await fetchFiltersRunner.onFetch(
      elements,
    )) as FilterResult
    const configChangeSuggestions = [
      ...metadataInstancesConfigInstances,
      ...(onFetchFilterResult.configSuggestions ?? []),
    ]
    const updatedConfig = getConfigFromConfigChanges(
      configChangeSuggestions,
      this.userConfig,
    )
    const getPartialFetchData = async (): Promise<
      PartialFetchData | undefined
    > => {
      if (!fetchProfile.metadataQuery.isPartialFetch()) {
        return undefined
      }
      const deletedElemIds = await this.getDeletedElemIdsForPartialFetch({
        fetchProfile,
        fetchElements: elements,
      })
      if (deletedElemIds.length > 0) {
        log.debug(
          'The following elemIDs were deleted in partial fetch: %s',
          safeJsonStringify(deletedElemIds.map((e) => e.getFullName())),
        )
      }
      return { isPartial: true, deletedElements: deletedElemIds }
    }

    if (withChangesDetection) {
      const relevantFetchedElementIds = elements
        .filter(
          (element) =>
            isCustomObjectSync(element) || isInstanceElement(element),
        )
        .map((element) => element.elemID.getFullName())
      ;(relevantFetchedElementIds.length > 100 ? log.trace : log.debug)(
        'Fetched the following elements in quick fetch: %s',
        safeJsonStringify(relevantFetchedElementIds),
      )
    }
    metadataQuery.logData()
    return {
      elements,
      errors: onFetchFilterResult.errors ?? [],
      updatedConfig,
      partialFetchData: await getPartialFetchData(),
    }
  }

  private async deployOrValidate(
    { changeGroup, progressReporter }: DeployOptions,
    checkOnly: boolean,
  ): Promise<DeployResult> {
    const fetchParams = this.userConfig.fetch ?? {}
    const fetchProfile = buildFetchProfile({
      fetchParams,
      customReferencesSettings: this.userConfig[CUSTOM_REFS_CONFIG],
    })
    log.debug(
      `about to ${checkOnly ? 'validate' : 'deploy'} group ${changeGroup.groupID} with scope (first 100): ${safeJsonStringify(
        changeGroup.changes
          .slice(0, 100)
          .map(getChangeData)
          .map((e) => e.elemID.getFullName()),
      )}`,
    )
    const isDataDeployGroup = await isCustomObjectInstanceChanges(
      changeGroup.changes,
    )
    const getLookupNameFunc = isDataDeployGroup
      ? getLookupNameForDataInstances
      : getLookUpName
    const resolvedChanges = await awu(changeGroup.changes)
      .map((change) => resolveChangeElement(change, getLookupNameFunc))
      .toArray()

    await awu(resolvedChanges)
      .filter(isAdditionChange)
      .map(getChangeData)
      .forEach(addDefaults)
    const filtersRunner = this.createFiltersRunner({ fetchProfile })
    await filtersRunner.preDeploy(resolvedChanges)
    log.debug(`preDeploy of group ${changeGroup.groupID} finished`)

    let deployResult: DeployResult
    if (isDataDeployGroup) {
      if (checkOnly) {
        return {
          appliedChanges: [],
          errors: [
            {
              message:
                'Cannot deploy CustomObject Records as part of check-only deployment',
              severity: 'Error',
            },
          ],
        }
      }
      deployResult = await deployCustomObjectInstancesGroup(
        resolvedChanges as Change<InstanceElement>[],
        this.client,
        changeGroup.groupID,
        fetchProfile.dataManagement,
      )
    } else {
      const nullProgressReporter: ProgressReporter = {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        reportProgress: () => {},
      }
      deployResult = await deployMetadata(
        resolvedChanges,
        this.client,
        this.nestedMetadataTypes,
        progressReporter ?? nullProgressReporter,
        this.userConfig.client?.deploy?.deleteBeforeUpdate,
        checkOnly,
        this.userConfig.client?.deploy?.quickDeployParams,
      )
    }
    log.debug(`received deployResult for group ${changeGroup.groupID}`)
    // onDeploy can change the change list in place, so we need to give it a list it can modify
    const appliedChangesBeforeRestore = [...deployResult.appliedChanges]
    await filtersRunner.onDeploy(appliedChangesBeforeRestore)
    log.debug(`onDeploy of group ${changeGroup.groupID} finished`)

    const sourceChanges = _.keyBy(changeGroup.changes, (change) =>
      getChangeData(change).elemID.getFullName(),
    )

    const appliedChanges = await awu(appliedChangesBeforeRestore)
      .map((change) =>
        restoreChangeElement(change, sourceChanges, getLookupNameFunc),
      )
      .toArray()
    return {
      appliedChanges,
      errors: deployResult.errors,
      extraProperties: deployResult.extraProperties,
    }
  }

  async deploy(deployOptions: DeployOptions): Promise<DeployResult> {
    // Check old configuration flag for backwards compatibility (SALTO-2700)
    const checkOnly = this.userConfig?.client?.deploy?.checkOnly ?? false
    const result = await this.deployOrValidate(deployOptions, checkOnly)
    // If we got here with checkOnly we must not return any applied changes
    // to maintain the old deploy interface (SALTO-2700)
    if (checkOnly) {
      return {
        ...result,
        appliedChanges: [],
      }
    }
    return result
  }

  async validate(deployOptions: DeployOptions): Promise<DeployResult> {
    return this.deployOrValidate(deployOptions, true)
  }

  private async listMetadataTypes(
    metadataQuery: MetadataQuery,
  ): Promise<MetadataObject[]> {
    return (await this.client.listMetadataTypes()).filter((info) =>
      metadataQuery.isTypeMatch(info.xmlName),
    )
  }

  @logDuration('fetching metadata types')
  private async fetchMetadataTypes(
    typeInfoPromise: Promise<MetadataObject[]>,
    knownMetadataTypes: TypeElement[],
  ): Promise<TypeElement[]> {
    const typeInfos = await typeInfoPromise
    const knownTypes = new Map<string, TypeElement>(
      await awu(knownMetadataTypes)
        .map(
          async (mdType) =>
            [await apiName(mdType), mdType] as [string, TypeElement],
        )
        .toArray(),
    )
    const baseTypeNames = new Set(typeInfos.map((type) => type.xmlName))
    const childTypeNames = new Set(
      typeInfos.flatMap((type) => type.childXmlNames).filter(values.isDefined),
    )
    return (
      await Promise.all(
        typeInfos.map((typeInfo) =>
          fetchMetadataType(
            this.client,
            typeInfo,
            knownTypes,
            baseTypeNames,
            childTypeNames,
          ),
        ),
      )
    ).flat()
  }

  @logDuration('fetching instances')
  private async fetchMetadataInstances(
    typeInfoPromise: Promise<MetadataObject[]>,
    types: Promise<TypeElement[]>,
    fetchProfile: FetchProfile,
  ): Promise<FetchElements<InstanceElement[]>> {
    const readInstances = async (
      metadataTypes: ObjectType[],
    ): Promise<FetchElements<InstanceElement[]>> => {
      const metadataTypesToRead = await awu(metadataTypes)
        .filter(
          async (type) =>
            !this.metadataTypesOfInstancesFetchedInFilters.includes(
              await apiName(type),
            ),
        )
        .toArray()
      const result = await Promise.all(
        metadataTypesToRead.map((type) =>
          this.createMetadataInstances(type, fetchProfile),
        ),
      )
      return {
        elements: _.flatten(result.map((r) => r.elements)),
        configChanges: _.flatten(result.map((r) => r.configChanges)),
      }
    }

    const typeInfos = await typeInfoPromise
    const topLevelTypeNames = typeInfos.map((info) => info.xmlName)
    const topLevelTypes = await awu(await types)
      .filter(isMetadataObjectType)
      .filter(
        async (t) =>
          topLevelTypeNames.includes(await apiName(t)) ||
          t.annotations.folderContentType !== undefined,
      )
      .toArray()

    const [metadataTypesToRetrieve, metadataTypesToRead] = await partition(
      topLevelTypes,
      async (t) => this.metadataToRetrieve.includes(await apiName(t)),
    )

    const retrieveMetadataInstancesFunc =
      fetchProfile.metadataQuery.isFetchWithChangesDetection()
        ? retrieveMetadataInstanceForFetchWithChangesDetection
        : retrieveMetadataInstances

    const allInstances = await Promise.all([
      retrieveMetadataInstancesFunc({
        client: this.client,
        types: metadataTypesToRetrieve,
        fetchProfile,
        typesToSkip: new Set(this.metadataTypesOfInstancesFetchedInFilters),
      }),
      readInstances(metadataTypesToRead),
    ])
    return {
      elements: _.flatten(allInstances.map((instances) => instances.elements)),
      configChanges: _.flatten(
        allInstances.map((instances) => instances.configChanges),
      ),
    }
  }

  private async createMetadataInstances(
    type: ObjectType,
    fetchProfile: FetchProfile,
  ): Promise<FetchElements<InstanceElement[]>> {
    const typeName = await apiName(type)
    const { elements: fileProps, configChanges } = await listMetadataObjects(
      this.client,
      typeName,
    )

    const instances = await fetchMetadataInstances({
      client: this.client,
      fileProps,
      metadataType: type,
      metadataQuery: fetchProfile.metadataQuery,
      maxInstancesPerType: fetchProfile.maxInstancesPerType,
      addNamespacePrefixToFullName: fetchProfile.addNamespacePrefixToFullName,
    })
    return {
      elements: instances.elements,
      configChanges: [...instances.configChanges, ...configChanges],
    }
  }

  private async getElemIdsByTypeFromSource(): Promise<
    Record<string, ElemID[]>
  > {
    const metadataElements = (
      await awu(await this.elementsSource.getAll()).toArray()
    )
      .filter(
        (element) =>
          !constants.NON_LISTED_ELEMENT_IDS.includes(
            element.elemID.getFullName(),
          ),
      )
      .filter(
        (element) =>
          isMetadataInstanceElementSync(element) || isCustomObjectSync(element),
      )
    return _(metadataElements)
      .groupBy(metadataTypeSync)
      .mapValues((elements) => elements.map((e) => e.elemID))
      .value()
  }

  private async getDeletedMetadataForPartialFetch(
    fetchElements: ReadonlyArray<Element>,
    fetchProfile: FetchProfile,
  ): Promise<Required<PartialFetchData>['deletedElements']> {
    const createElemId = (type: ObjectType, fullName: string): ElemID => {
      const typeName = apiNameSync(type)
      return typeName === CUSTOM_OBJECT
        ? // CustomObjects are converted to types and do not remain instances
          Types.getElemId(fullName, true)
        : createInstanceElement({ fullName }, type).elemID
    }
    const metadataTypesByName = _.keyBy(
      fetchElements.filter(isMetadataObjectType),
      (type) => apiNameSync(type) ?? 'unknown',
    )
    const elemIdsByTypeFromSource = await this.getElemIdsByTypeFromSource()
    const deletedElemIds = new Set<ElemID>()
    Object.entries(elemIdsByTypeFromSource)
      // We only want to check types that are included. This is especially relevant for targeted fetch
      .filter(([typeName]) => fetchProfile.metadataQuery.isTypeMatch(typeName))
      .forEach(([typeName, elemIdsFromSource]) => {
        const metadataType = metadataTypesByName[typeName]
        if (metadataType === undefined) {
          log.warn(
            'Skipping deletion detections for type %s since the metadata ObjectType was not found',
            typeName,
          )
          return
        }
        const listedElemIdsFullNames = new Set(
          Array.from(this.listedInstancesByType.getOrUndefined(typeName) ?? [])
            // We invoke createInstanceElement to have the correct elemID that we calculate in fetch
            .map((fullName) =>
              createElemId(metadataType, fullName).getFullName(),
            ),
        )

        elemIdsFromSource.forEach((sourceElemId) => {
          if (!listedElemIdsFullNames.has(sourceElemId.getFullName())) {
            deletedElemIds.add(sourceElemId)
          }
        })
      })
    return Array.from(deletedElemIds)
  }

  private async getDeletedDataRecordsForPartialFetch(
    fetchElements: ReadonlyArray<Element>,
  ): Promise<Required<PartialFetchData>['deletedElements']> {
    const querySalesforceForRecordIdsOfInstances = async (
      instances: ReadonlyArray<InstanceElement>,
    ): Promise<string[]> => {
      const instancesByType = _(instances)
        .filter(isInstanceOfCustomObjectSync)
        .groupBy((instance) => apiNameSync(instance.getTypeSync()) ?? '')
        .value()
      _.unset(instancesByType, '')

      const queries = awu(Object.entries(instancesByType)).map(
        async ([typeName, instancesOfType]) =>
          buildDataRecordsSoqlQueries(
            typeName,
            [instancesOfType[0].getTypeSync().fields[CUSTOM_OBJECT_ID_FIELD]],
            instancesOfType.map(instanceInternalId),
          ),
      )

      return awu(queries)
        .flatMap(async (typeQueries) => queryClient(this.client, typeQueries))
        .map((record) => record[CUSTOM_OBJECT_ID_FIELD])
        .toArray()
    }

    const getCustomObjectInstancesFromElementSource = async (
      elementsSource: ReadOnlyElementsSource,
      instancesToDiscard: ReadonlyArray<Element>,
    ): Promise<InstanceElement[]> => {
      // We implement a small optimization of not querying for IDs we just fetched, because we know these IDs couldn't
      // have been deleted.
      const idsToDiscard = new Set(
        instancesToDiscard
          .filter(isInstanceOfCustomObjectSync)
          .map(instanceInternalId),
      )
      return awu(await elementsSource.getAll())
        .filter(isInstanceOfCustomObjectSync)
        .filter((instance) => !idsToDiscard.has(instanceInternalId(instance)))
        .toArray()
    }

    const workspaceInstances = await getCustomObjectInstancesFromElementSource(
      this.elementsSource,
      fetchElements,
    )

    const instanceIdsInSalesforce = new Set(
      await querySalesforceForRecordIdsOfInstances(workspaceInstances),
    )

    return workspaceInstances
      .filter(
        (instance) =>
          !instanceIdsInSalesforce.has(instanceInternalId(instance)),
      )
      .map((instance) => instance.elemID)
  }

  private async getDeletedElemIdsForPartialFetch({
    fetchProfile,
    fetchElements,
  }: {
    fetchElements: ReadonlyArray<Element>
    fetchProfile: FetchProfile
  }): Promise<Required<PartialFetchData>['deletedElements']> {
    const deletedMetadata = await this.getDeletedMetadataForPartialFetch(
      fetchElements,
      fetchProfile,
    )
    const deletedDataRecords =
      await this.getDeletedDataRecordsForPartialFetch(fetchElements)
    return deletedMetadata.concat(deletedDataRecords)
  }

  fixElements: FixElementsFunc = (elements) => this.fixElementsFunc(elements)
}
