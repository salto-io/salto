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
import {
  TypeElement, ObjectType, ElemID, InstanceElement, isModificationDiff,
  isRemovalDiff, isAdditionDiff, Field, Element, isObjectType, isInstanceElement,
  Value, Change, getChangeElement, isField, isElement, ElemIdGetter,
  DataModificationResult, Values, resolveReferences, restoreReferences,
} from '@salto-io/adapter-api'
import {
  SaveResult, MetadataInfo, QueryResult, FileProperties, BatchResultInfo, BulkLoadOperation,
  Record as SfRecord, ListMetadataQuery, UpsertResult, RetrieveResult, RetrieveRequest,
} from 'jsforce'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { decorators, collections } from '@salto-io/lowerdash'
import SalesforceClient, { API_VERSION } from './client/client'
import * as constants from './constants'
import {
  toCustomField, toCustomObject, apiName, Types, toMetadataInfo, createInstanceElement,
  metadataType, createMetadataTypeElements,
  instanceElementstoRecords, elemIDstoRecords, getCompoundChildFields,
  defaultApiName, getLookUpName,
} from './transformers/transformer'
import { fromRetrieveResult, toMetadataPackageZip } from './transformers/xml_transformer'
import layoutFilter from './filters/layouts'
import customObjectsFilter from './filters/custom_objects'
import profilePermissionsFilter from './filters/profile_permissions'
import convertListsFilter from './filters/convert_lists'
import convertTypeFilter from './filters/convert_types'
import missingFieldsFilter from './filters/missing_fields'
import removeFieldsFilter from './filters/remove_fields'
import standardValueSetFilter from './filters/standard_value_sets'
import flowFilter from './filters/flow'
import lookupFiltersFilter from './filters/lookup_filters'
import animationRulesFilter from './filters/animation_rules'
import samlInitMethodFilter from './filters/saml_initiation_method'
import settingsFilter from './filters/settings_type'
import workflowFilter from './filters/workflow'
import topicsForObjectsFilter from './filters/topics_for_objects'
import globalValueSetFilter from './filters/global_value_sets'
import instanceReferences from './filters/instance_references'
import valueSetFilter from './filters/value_set'
import {
  FilterCreator, Filter, filtersRunner,
} from './filter'
import { id, addApiName, addMetadataType, addLabel } from './filters/utils'

const { makeArray } = collections.array
const log = logger(module)

export const MAX_ITEMS_IN_RETRIEVE_REQUEST = 10000
const RECORDS_CHUNK_SIZE = 10000
export const DEFAULT_FILTERS = [
  missingFieldsFilter,
  settingsFilter,
  // should run before customObjectsFilter
  workflowFilter,
  // customObjectsFilter depends on missingFieldsFilter and settingsFilter
  customObjectsFilter,
  removeFieldsFilter,
  profilePermissionsFilter,
  layoutFilter,
  standardValueSetFilter,
  flowFilter,
  lookupFiltersFilter,
  animationRulesFilter,
  samlInitMethodFilter,
  topicsForObjectsFilter,
  valueSetFilter,
  globalValueSetFilter,
  // The following filters should remain last in order to make sure they fix all elements
  convertListsFilter,
  convertTypeFilter,
  instanceReferences,
]

const absoluteIDMetadataTypes: Record<string, string[]> = {
  CustomLabels: ['labels'],
}

const nestedIDMetadataTypes: Record<string, string[]> = {
  AssignmentRules: ['assignmentRule'],
  AutoResponseRules: ['autoresponseRule'],
  EscalationRules: ['escalationRule'],
  MatchingRules: ['matchingRules'],
  SharingRules: ['sharingCriteriaRules', 'sharingGuestRules',
    'sharingOwnerRules', 'sharingTerritoryRules'],
}

// Add elements defaults
const addDefaults = (element: ObjectType): void => {
  addApiName(element)
  addMetadataType(element)
  addLabel(element)
  Object.values(element.fields).forEach(field => {
    addApiName(field, undefined, apiName(element))
    addLabel(field)
  })
}

const instanceNameMatchRegex = (name: string, regex: RegExp[]): boolean =>
  regex.some(re => re.test(name))

const validateApiName = (prevElement: Element, newElement: Element): void => {
  if (apiName(prevElement) !== apiName(newElement)) {
    throw Error(
      `Failed to update element as api names prev=${apiName(
        prevElement
      )} and new=${apiName(newElement)} are different`
    )
  }
}

export interface SalesforceAdapterParams {
  // Metadata types that we want to fetch that exist in the SOAP API but not in the metadata API
  metadataAdditionalTypes?: string[]

  // Regular expressions for instances that we want to exclude from readMetadata
  // The regular expression would be matched against instances of the format METADATA_TYPE.INSTANCE
  // For example: CustomObject.Lead
  instancesRegexBlacklist?: string[]

  // Metadata types that we do not want to fetch even though they are returned as top level
  // types from the API
  metadataTypeBlacklist?: string[]

  // Metadata types that we have to fetch using the retrieve API endpoint and add update or remove
  // using the deploy API endpoint
  metadataToRetrieveAndDeploy?: Record<string, string | undefined>

  // Metadata types that we should not create, update or delete in the main adapter code
  metadataTypesToSkipMutation?: string[]

  // Metadata types that we should not use client.update but client.upsert upon instance update
  metadataTypesToUseUpsertUponUpdate?: string[]

  // Metadata types that that include metadata types inside them
  nestedMetadataTypes?: Record<string, string[]>

  // Filters to deploy to all adapter operations
  filterCreators?: FilterCreator[]

  // client to use
  client: SalesforceClient

  // callback function to get an existing elemId or create a new one by the ServiceIds values
  getElemIdFunc?: ElemIdGetter

  // System fields that salesforce may add to custom objects - to be ignored when creating objects
  systemFields?: string[]

  config: SalesforceConfig
}

const logDuration = (message?: string): decorators.InstanceMethodDecorator =>
  decorators.wrapMethodWith(
    async (original: decorators.OriginalCall): Promise<unknown> => {
      const element = original.args.find(isElement)
      const defaultMessage = `running salesforce.${original.name} ${
        element ? `element=${id(element)}` : ''} `
      return log.time(original.call, message || defaultMessage)
    }
  )

type NamespaceAndInstances = { namespace?: string; instanceInfo: MetadataInfo }
type RetrieveMember = {
  type: string
  name: string
}

export type SalesforceConfig = {
  metadataTypesBlacklist?: string[]
  instancesRegexBlacklist?: string[]
}

export default class SalesforceAdapter {
  private metadataTypeBlacklist: string[]
  private instancesRegexBlacklist: RegExp[]
  private metadataToRetrieveAndDeploy: Record<string, string | undefined>
  private metadataAdditionalTypes: string[]
  private metadataTypesToSkipMutation: string[]
  private metadataTypesToUseUpsertUponUpdate: string[]
  private nestedMetadataTypes: Record<string, string[]>
  private filtersRunner: Required<Filter>
  private client: SalesforceClient
  private systemFields: string[]

  public constructor({
    metadataTypeBlacklist = [
      'CustomField', // We have special treatment for this type
      'Settings',
      'StaticResource',
      'NetworkBranding',
      'FlowDefinition', // Only has the active flow version but we cant get flow versions anyway
      // readMetadata fails on those and pass on the parents (AssignmentRules and EscalationRules)
      'AssignmentRule', 'EscalationRule',
    ],
    instancesRegexBlacklist = [],
    metadataToRetrieveAndDeploy = {
      ApexClass: undefined, // readMetadata is not supported, contains encoded zip content
      ApexTrigger: undefined, // readMetadata is not supported, contains encoded zip content
      ApexPage: undefined, // contains encoded zip content
      ApexComponent: undefined, // contains encoded zip content
      AssignmentRules: undefined,
      InstalledPackage: undefined, // listMetadataObjects of this types returns duplicates
      EmailTemplate: 'EmailFolder', // contains encoded zip content, is under a folder
      ReportType: undefined,
      Report: 'ReportFolder',
      Dashboard: 'DashboardFolder',
    },
    metadataAdditionalTypes = [
      'ProfileUserPermission',
      'EmailFolder',
      'ReportFolder',
      'DashboardFolder',
      'WorkflowAlert',
      'WorkflowFieldUpdate',
      'WorkflowFlowAction',
      'WorkflowKnowledgePublish',
      'WorkflowOutboundMessage',
      'WorkflowTask',
    ],
    metadataTypesToSkipMutation = [
      'Workflow', // handled in workflow filter
    ],
    metadataTypesToUseUpsertUponUpdate = [
      'Flow', // update fails for Active flows
    ],
    nestedMetadataTypes = {
      ...absoluteIDMetadataTypes,
      ...nestedIDMetadataTypes,
    },
    filterCreators = DEFAULT_FILTERS,
    client,
    getElemIdFunc,
    // See: https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/sforce_api_objects_custom_object__c.htm
    systemFields = [
      'ConnectionReceivedId',
      'ConnectionSentId',
      'CreatedById',
      'CreatedDate',
      'CurrencyIsoCode',
      'Id',
      'IsDeleted',
      'LastActivityDate',
      'LastModifiedDate',
      'LastModifiedById',
      'LastReferencedDate',
      'LastViewedDate',
      'Name',
      'RecordTypeId',
      'SystemModstamp',
      'OwnerId',
    ],
    config,
  }: SalesforceAdapterParams) {
    this.metadataTypeBlacklist = metadataTypeBlacklist
      .concat(makeArray(config.metadataTypesBlacklist))
    this.instancesRegexBlacklist = instancesRegexBlacklist
      .concat(makeArray(config.instancesRegexBlacklist))
      .map(e => new RegExp(e))
    this.metadataToRetrieveAndDeploy = metadataToRetrieveAndDeploy
    this.metadataAdditionalTypes = metadataAdditionalTypes
    this.metadataTypesToSkipMutation = metadataTypesToSkipMutation
    this.metadataTypesToUseUpsertUponUpdate = metadataTypesToUseUpsertUponUpdate
    this.nestedMetadataTypes = nestedMetadataTypes
    this.client = client
    this.filtersRunner = filtersRunner(this.client, filterCreators)
    this.systemFields = systemFields
    if (getElemIdFunc) {
      Types.setElemIdGetter(getElemIdFunc)
    }
  }

  /**
   * Fetch configuration elements (types and instances in the given salesforce account)
   * Account credentials were given in the constructor.
   */
  @logDuration('fetching account configuration')
  public async fetch(): Promise<Element[]> {
    log.debug('going to fetch salesforce account configuration..')
    const fieldTypes = Types.getAllFieldTypes()
    const annotationTypes = Types.getAnnotationTypes()
    const metadataTypeNames = this.listMetadataTypes()
    const metadataTypes = this.fetchMetadataTypes(metadataTypeNames, annotationTypes)
    const metadataInstances = this.fetchMetadataInstances(metadataTypeNames, metadataTypes)

    const elements = _.flatten(
      await Promise.all([annotationTypes, fieldTypes,
        metadataTypes, metadataInstances]) as Element[][]
    )
    await this.filtersRunner.onFetch(elements)
    return elements
  }

  /**
   * Retrieve all the instances of a given type.
   * The function returns an iterator because each API call retrieves the next 2000 instances
   * @param type the object type of which to retrieve instances
   */
  public async *getInstancesOfType(type: ObjectType): AsyncIterable<InstanceElement[]> {
    const toInstanceElements = (queryResult: QueryResult<Value>):
InstanceElement[] => {
      // Omit the "attributes" field from the objects
      const results = queryResult.records.map(obj => _.pickBy(obj, (_value, key) =>
        key !== 'attributes'))

      // Convert the result to Instance Elements
      return results.map(res => new InstanceElement(res.Id, type, res))
    }

    let results = await this.getFirstBatchOfInstances(type)

    while (true) {
      yield toInstanceElements(results)
      if (results.nextRecordsUrl !== undefined) {
        // eslint-disable-next-line no-await-in-loop
        results = await this.client.queryMore(results.nextRecordsUrl)
      } else break
    }
  }

  /**
   * Imports instances of type from the data stream
   * @param type the object type of which to import instances
   * @param instancesIterator the iterator that provides the instances to import
   * @returns a promise that represents action completion
   */
  public async importInstancesOfType(
    type: ObjectType,
    instancesIterator: AsyncIterable<InstanceElement>
  ): Promise<DataModificationResult> {
    return this.iterateBulkOperation(
      type,
      instancesIterator,
      'upsert',
      instanceElementstoRecords
    )
  }

  /**
   * Deletes instances of type from the data stream
   * @param type the object type of which to delete instances
   * @param elemIdIterator the iterator that provides the instances to delete
   * @returns a promise that represents action completion
   */
  public async deleteInstancesOfType(
    type: ObjectType,
    elemIdIterator: AsyncIterable<ElemID>
  ): Promise<DataModificationResult> {
    return this.iterateBulkOperation(
      type,
      elemIdIterator,
      'delete',
      elemIDstoRecords
    )
  }

  private async iterateBulkOperation(
    type: ObjectType,
    iterator: AsyncIterable<Value>,
    bulkOperation: BulkLoadOperation,
    transformFuction: (values: Value[]) => SfRecord[]
  ): Promise<DataModificationResult> {
    const returnResult = {
      successfulRows: 0,
      failedRows: 0,
      errors: new Set<string>(),
    }
    const updateReturnResult = (
      retResult: DataModificationResult,
      bulkResult: BatchResultInfo[],
      batchNumber: number
    ): void => {
      retResult.successfulRows += bulkResult.filter(result => result.success).length
      retResult.failedRows = bulkResult.length - retResult.successfulRows
      // Log the errors for each row
      bulkResult.forEach((result, index) => {
        if (!result.success) {
          // Emit the error to the log
          const rowNumber = RECORDS_CHUNK_SIZE * batchNumber + index + 1
          if (result.errors && result.errors.length > 0) {
            log.error('Failed to perform %o on row %o with the following errors:\n%o',
              bulkOperation,
              rowNumber,
              result.errors?.join('\n'))
          } else {
            log.error('Failed to perform %o on row %o',
              bulkOperation,
              rowNumber)
          }

          // Add the error string to the set if it doesn't appear there already
          // eslint-disable-next-line no-unused-expressions
          result.errors?.forEach(error => {
            if (!returnResult.errors.has(error)) {
              returnResult.errors.add(error)
            }
          })
        }
      })
    }
    let batch: Value[] = []
    let batchNumber = 0

    // eslint-disable-next-line no-restricted-syntax
    for await (const element of iterator) {
      // Aggregate the instance elements for the proper bulk size
      const length = batch.push(element)
      if (length === RECORDS_CHUNK_SIZE) {
        // Convert the instances in the transformer to SfRecord[] and send to bulk API
        const result = await this.client.updateBulk(
          apiName(type),
          bulkOperation,
          transformFuction(batch)
        )
        batch = []
        // Update the return result
        updateReturnResult(returnResult, result, batchNumber)
        batchNumber += 1
      }
    }
    // Send the remaining instances
    if (batch.length > 0) {
      const result = await this.client.updateBulk(
        apiName(type),
        bulkOperation,
        transformFuction(batch)
      )
      // Update the return result
      updateReturnResult(returnResult, result, batchNumber)
    }
    return returnResult
  }

  /**
   * Add new element
   * @param element the object/instance to add
   * @returns the updated element with extra info like api name, label and metadata type
   * @throws error in case of failure
   */
  public async add(element: Element): Promise<Element> {
    let post: Element
    const resolved = resolveReferences(element, getLookUpName)
    if (isObjectType(resolved)) {
      post = await this.addObject(resolved)
    } else {
      post = await this.addInstance(resolved as InstanceElement)
    }

    await this.filtersRunner.onAdd(post)
    return restoreReferences(element, post, getLookUpName)
  }

  /**
   * Add new object
   * @param element of ObjectType to add
   * @returns the updated object with extra info like api name, label and metadata type
   * @throws error in case of failure
   */
  private async addObject(element: ObjectType): Promise<ObjectType> {
    const post = element.clone()
    addDefaults(post)

    await this.client.upsert(
      constants.CUSTOM_OBJECT, toCustomObject(post, true, this.systemFields),
    )

    return post
  }

  /**
   * Add new Instance
   * @param element to add
   * @returns the updated instance
   * @throws error in case of failure
   */
  private async addInstance(element: InstanceElement): Promise<InstanceElement> {
    const addInstanceDefaults = (elem: InstanceElement): void => {
      if (elem.value[constants.INSTANCE_FULL_NAME_FIELD] === undefined) {
        elem.value[constants.INSTANCE_FULL_NAME_FIELD] = defaultApiName(elem)
      }
    }

    const post = element.clone()
    const type = metadataType(post)
    addInstanceDefaults(post)
    if (this.isMetadataTypeToRetrieveAndDeploy(type)) {
      await this.deployInstance(post)
    } else if (!this.metadataTypesToSkipMutation.includes(metadataType(post))) {
      await this.client.upsert(type, toMetadataInfo(apiName(post), post.value))
    }
    return post
  }

  private async deployInstance(instance: InstanceElement, deletion = false): Promise<void> {
    const zip = await toMetadataPackageZip(apiName(instance), metadataType(instance),
      instance.value, deletion)
    if (zip) {
      await this.client.deploy(zip)
    } else {
      log.warn('Skipped deploying instance %s of type %s', apiName(instance), metadataType(instance))
    }
  }

  /**
   * Remove an element (object/instance)
   * @param element to remove
   */
  @logDuration()
  public async remove(element: Element): Promise<void> {
    const resolved = resolveReferences(element, getLookUpName)
    const type = metadataType(resolved)
    if (isInstanceElement(resolved)
      && this.isMetadataTypeToRetrieveAndDeploy(type)) {
      await this.deployInstance(resolved, true)
    } else if (!(isInstanceElement(resolved) && this.metadataTypesToSkipMutation.includes(type))) {
      await this.client.delete(type, apiName(resolved))
    }
    await this.filtersRunner.onRemove(resolved)
  }

  /**
   * Updates an Element
   * @param before The metadata of the old element
   * @param after The new metadata of the element to replace
   * @param changes to apply
   * @returns the updated element
   */
  @logDuration()
  public async update(before: Element, after: Element,
    changes: ReadonlyArray<Change>): Promise<Element> {
    const resBefore = resolveReferences(before, getLookUpName)
    const resAfter = resolveReferences(after, getLookUpName)
    const resChanges = changes.map(c => ({
      action: c.action,
      data: _.mapValues(c.data, (x => resolveReferences(x, getLookUpName))),
    })) as ReadonlyArray<Change<Field | ObjectType>>
    let result = resAfter
    if (isObjectType(resBefore) && isObjectType(resAfter)) {
      result = await this.updateObject(
        resBefore,
        resAfter,
        resChanges
      )
    }

    if (isInstanceElement(resBefore) && isInstanceElement(resAfter)) {
      result = await this.updateInstance(resBefore, resAfter)
    }

    // Aspects should be updated once all object related properties updates are over
    await this.filtersRunner.onUpdate(resBefore, result, resChanges)
    return restoreReferences(after, result, getLookUpName)
  }

  /**
   * Update a custom object
   * @param before The metadata of the old element
   * @param after The new metadata of the element to replace
   * @param changes to apply
   * @returns the updated object
   */
  private async updateObject(before: ObjectType, after: ObjectType,
    changes: ReadonlyArray<Change<Field | ObjectType>>): Promise<ObjectType> {
    validateApiName(before, after)
    const clonedObject = after.clone()
    changes
      .filter(isAdditionDiff)
      .map(getChangeElement)
      .filter(isField)
      .map(fieldChange => clonedObject.fields[fieldChange.name])
      .forEach(field => {
        addLabel(field)
        addApiName(field, undefined, apiName(clonedObject))
      })

    const fieldChanges = changes.filter(c => isField(getChangeElement(c))) as Change<Field>[]

    // There are fields that are not equal but their transformation
    // to CustomField is (e.g. lookup field with LookupFilter).
    const shouldUpdateField = (beforeField: Field, afterField: Field): boolean =>
      !_.isEqual(toCustomField(beforeField, true),
        toCustomField(afterField, true))

    await Promise.all([
      // Retrieve the custom fields for deletion and delete them
      this.deleteCustomFields(fieldChanges.filter(isRemovalDiff).map(getChangeElement)),
      // Retrieve the custom fields for addition and than create them
      this.createFields(fieldChanges
        .filter(isAdditionDiff)
        .filter(c => !this.systemFields.includes(getChangeElement(c).name))
        .map(c => clonedObject.fields[c.data.after.name])),
      // Update the remaining fields that were changed
      this.updateFields(fieldChanges
        .filter(isModificationDiff)
        .filter(c => shouldUpdateField(c.data.before, c.data.after))
        .map(c => clonedObject.fields[c.data.after.name])),
      this.updateObjectAnnotations(before, clonedObject, changes),
    ])
    return clonedObject
  }

  private async updateObjectAnnotations(before: ObjectType, clonedObject: ObjectType,
    changes: ReadonlyArray<Change<Field | ObjectType>>): Promise<SaveResult[]> {
    if (changes.some(c => isObjectType(getChangeElement(c)))
      && !_.isEqual(toCustomObject(before, false), toCustomObject(clonedObject, false))) {
      // Update object without its fields
      return this.client.update(
        metadataType(clonedObject),
        toCustomObject(clonedObject, false)
      )
    }
    return []
  }

  private async deleteRemovedMetadataObjects(oldInstance: InstanceElement,
    newInstance: InstanceElement, fieldName: string, withObjectPrefix: boolean): Promise<void> {
    const getDeletedObjectsNames = (oldObjects: Values[], newObjects: Values[]): string[] => {
      const newObjectsNames = newObjects.map(o => o.fullName)
      const oldObjectsNames = oldObjects.map(o => o.fullName)
      return oldObjectsNames.filter(o => !newObjectsNames.includes(o))
    }

    const fieldType = newInstance.type.fields[fieldName]?.type
    if (_.isUndefined(fieldType)) {
      return
    }
    const metadataTypeName = metadataType(fieldType)
    const deletedObjects = getDeletedObjectsNames(
      makeArray(oldInstance.value[fieldName]), makeArray(newInstance.value[fieldName])
    ).map(o => (withObjectPrefix ? [oldInstance.value.fullName, o] : [o])
      .join(constants.API_NAME_SEPERATOR))
    if (!_.isEmpty(deletedObjects)) {
      await this.client.delete(metadataTypeName, deletedObjects)
    }
  }

  /**
   * Update an instance
   * @param prevInstance The metadata of the old instance
   * @param newInstance The new metadata of the instance to replace
   * @returns the updated instance
   */
  private async updateInstance(prevInstance: InstanceElement, newInstance: InstanceElement):
    Promise<InstanceElement> {
    validateApiName(prevInstance, newInstance)
    const typeName = metadataType(newInstance)
    if (this.metadataTypesToSkipMutation.includes(typeName)) {
      return newInstance
    }

    if (Object.keys(this.nestedMetadataTypes).includes(typeName)) {
      // Checks if we need to delete metadata objects
      this.nestedMetadataTypes[typeName]
        .forEach(fieldName =>
          this.deleteRemovedMetadataObjects(
            prevInstance,
            newInstance,
            fieldName,
            Object.keys(nestedIDMetadataTypes).includes(typeName)
          ))
    }

    if (this.isMetadataTypeToRetrieveAndDeploy(typeName)) {
      await this.deployInstance(newInstance)
    } else if (this.metadataTypesToUseUpsertUponUpdate.includes(typeName)) {
      await this.client.upsert(typeName, toMetadataInfo(apiName(newInstance), newInstance.value))
    } else {
      await this.client.update(typeName, toMetadataInfo(
        apiName(newInstance),
        // As SALTO-79 Conclusions we decided to send the entire newInstance to salesforce API
        // instead of only the delta (changes between newInstance & prevInstance).
        // until we have a better understanding of update behavior for all fields types.
        newInstance.value
      ))
    }

    return newInstance
  }

  /**
   * Updates custom fields
   * @param fieldsToUpdate The fields to update
   * @returns successfully managed to update all fields
   */
  private async updateFields(fieldsToUpdate: Field[]): Promise<SaveResult[]> {
    return this.client.update(
      constants.CUSTOM_FIELD,
      fieldsToUpdate.map(f => toCustomField(f, true)),
    )
  }

  /**
   * Creates custom fields and their corresponding field permissions
   * @param fieldsToAdd The fields to create
   * @returns successfully managed to create all fields with their permissions or not
   */
  private async createFields(fieldsToAdd: Field[]): Promise<UpsertResult[]> {
    return this.client.upsert(
      constants.CUSTOM_FIELD,
      fieldsToAdd.map(f => toCustomField(f, true)),
    )
  }

  /**
   * Deletes custom fields
   * @param fields the custom fields we wish to delete
   */
  private async deleteCustomFields(fields: Field[]): Promise<SaveResult[]> {
    return this.client.delete(constants.CUSTOM_FIELD, fields
      .map(field => apiName(field)))
  }

  private async listMetadataTypes(): Promise<string[]> {
    return this.client.listMetadataTypes().then(
      types => types
        .map(x => x.xmlName)
        .concat(this.metadataAdditionalTypes)
        .filter(name => !this.metadataTypeBlacklist.includes(name))
    )
  }

  @logDuration('fetching metadata types')
  private async fetchMetadataTypes(typeNamesPromise: Promise<string[]>,
    knownMetadataTypes: TypeElement[]): Promise<TypeElement[]> {
    const typeNames = await typeNamesPromise
    const knownTypes = new Map<string, TypeElement>(
      knownMetadataTypes.map(mdType => [apiName(mdType), mdType])
    )
    return _.flatten(await Promise.all((typeNames)
      .map(typeName => this.fetchMetadataType(typeName, knownTypes, new Set(typeNames)))))
  }

  private async fetchMetadataType(
    objectName: string,
    knownTypes: Map<string, TypeElement>,
    baseTypeNames: Set<string>
  ): Promise<TypeElement[]> {
    const fields = await this.client.describeMetadataType(objectName)
    return createMetadataTypeElements(objectName, fields, knownTypes, baseTypeNames, this.client)
  }

  private async retrieveMetadata(metadataTypes: string[]):
    Promise<Record<string, NamespaceAndInstances[]>> {
    const getFolders = async (typeToRetrieve: string): Promise<FileProperties[]> => {
      const folderType = this.metadataToRetrieveAndDeploy[typeToRetrieve]
      if (folderType) {
        return this.client.listMetadataObjects({ type: folderType })
      }
      return []
    }

    const isFolder = (type: string): boolean =>
      Object.values(this.metadataToRetrieveAndDeploy).includes(type)

    const retrieveMetadataTypes = metadataTypes.filter(type => !isFolder(type))
    const retrieveTypeToFiles: Record<string, FileProperties[]> = await Promise.all(
      retrieveMetadataTypes
        .map(async type => {
          const folders = await getFolders(type)
          let listMetadataQuery: ListMetadataQuery | ListMetadataQuery[]
          if (_.isEmpty(folders)) {
            listMetadataQuery = { type }
          } else {
            listMetadataQuery = folders.map(folder => ({ type, folder: folder.fullName }))
          }
          return [type, [...(await this.client.listMetadataObjects(listMetadataQuery)), ...folders]]
        })
    ).then(pairs => _(pairs).fromPairs().value())

    const retrieveMembers: RetrieveMember[] = _(retrieveTypeToFiles)
      .entries()
      .map(([type, files]) => _(files)
        .map(constants.INSTANCE_FULL_NAME_FIELD)
        .uniq()
        .filter(name => !instanceNameMatchRegex(`${type}.${name}`, this.instancesRegexBlacklist))
        .map(name => ({ type, name }))
        .value())
      .flatten()
      .value()

    const typeToInstanceInfos = await this.retrieveChunked(retrieveMembers, metadataTypes)
    const fullNameToNamespace: Record<string, string> = _(Object.values(retrieveTypeToFiles))
      .flatten()
      .map(file => [file.fullName, file.namespacePrefix])
      .fromPairs()
      .value()
    return _(Object.entries(typeToInstanceInfos))
      .map(([type, instanceInfos]) =>
        [type, instanceInfos.map(instanceInfo =>
          ({ namespace: fullNameToNamespace[instanceInfo.fullName], instanceInfo }))])
      .fromPairs()
      .value()
  }

  private async retrieveChunked(retrieveMembers: RetrieveMember[], metadataTypes: string[]):
    Promise<Record<string, MetadataInfo[]>> {
    const fromRetrieveResults = async (retrieveResults: RetrieveResult[]):
      Promise<Record<string, MetadataInfo[]>> => {
      const typesToInstances = await Promise.all(retrieveResults
        .map(async retrieveResult => fromRetrieveResult(retrieveResult, metadataTypes)))
      return _.mergeWith({}, ...typesToInstances,
        (objValue: MetadataInfo[], srcValue: MetadataInfo[]) =>
          _.concat(makeArray(objValue), srcValue))
    }

    const createRetrieveRequest = (membersChunk: RetrieveMember[]): RetrieveRequest => {
      const typeToMembers = _.groupBy(membersChunk, retrieveMember => retrieveMember.type)
      return {
        apiVersion: API_VERSION,
        singlePackage: false,
        unpackaged: {
          types: Object.entries(typeToMembers).map(([type, members]) =>
            ({
              name: type,
              members: members.map(member => member.name),
            })),
        },
      }
    }

    const retrieveResults = await _.chunk(retrieveMembers, MAX_ITEMS_IN_RETRIEVE_REQUEST)
      .reduce(async (prevResults, membersChunk) => {
        // Wait for prev results before triggering another request to avoid passing the API limit
        const results = await prevResults
        return [...results, await this.client.retrieve(createRetrieveRequest(membersChunk))]
      },
      Promise.resolve<RetrieveResult[]>([]))
    return fromRetrieveResults(retrieveResults)
  }

  @logDuration('fetching instances')
  private async fetchMetadataInstances(typeNames: Promise<string[]>, types: Promise<TypeElement[]>):
    Promise<InstanceElement[]> {
    type TypeAndInstances = { type: ObjectType; namespaceAndInstances: NamespaceAndInstances[] }
    const readInstances = async (metadataTypesToRead: ObjectType[]):
      Promise<TypeAndInstances[]> =>
      Promise.all(metadataTypesToRead.map(async type => {
        let namespaceAndInstances: NamespaceAndInstances[] = []
        // Just fetch metadata instances of the types that we receive from the describe call
        if (!this.metadataAdditionalTypes.includes(apiName(type))) {
          namespaceAndInstances = await this.listMetadataInstances(apiName(type))
        }
        return { type, namespaceAndInstances }
      }))

    const retrieveInstances = async (metadataTypesToRetrieve: ObjectType[]):
      Promise<TypeAndInstances[]> => {
      const nameToType: Record<string, ObjectType> = _(metadataTypesToRetrieve)
        .map(t => [apiName(t), t])
        .fromPairs()
        .value()
      const typeNameToNamespaceAndInfos = await this.retrieveMetadata(Object.keys(nameToType))
      return Object.entries(typeNameToNamespaceAndInfos)
        .map(([typeName, namespaceAndInstances]) =>
          ({ type: nameToType[typeName], namespaceAndInstances }))
    }

    const topLevelTypeNames = await typeNames
    const topLevelTypes = (await types)
      .filter(isObjectType)
      .filter(t => topLevelTypeNames.includes(apiName(t)))

    const [metadataTypesToRetrieve, metadataTypesToRead] = _.partition(
      topLevelTypes,
      t => this.isMetadataTypeToRetrieveAndDeploy(metadataType(t)),
    )

    const typesAndInstances = _.flatten(await Promise.all(
      [retrieveInstances(metadataTypesToRetrieve), readInstances(metadataTypesToRead)]
    ))
    return _(typesAndInstances)
      .map(typeAndInstances => typeAndInstances.namespaceAndInstances
        .filter(namespaceAndInstance => namespaceAndInstance.instanceInfo.fullName !== undefined)
        .map(namespaceAndInstance => createInstanceElement(namespaceAndInstance.instanceInfo,
          typeAndInstances.type, namespaceAndInstance.namespace)))
      .flatten()
      .value()
  }

  private isMetadataTypeToRetrieveAndDeploy(type: string): boolean {
    return [...Object.keys(this.metadataToRetrieveAndDeploy),
      ...Object.values(this.metadataToRetrieveAndDeploy)].includes(type)
  }

  /**
   * List all the instances of specific metadataType
   * @param type the metadata type
   */
  private async listMetadataInstances(type: string): Promise<NamespaceAndInstances[]> {
    const objs = await this.client.listMetadataObjects({ type })
    if (!objs) {
      return []
    }
    const getFullName = (obj: FileProperties): string => {
      const namePrefix = obj.namespacePrefix
        ? `${obj.namespacePrefix}${constants.NAMESPACE_SEPARATOR}` : ''
      return obj.fullName.startsWith(namePrefix) ? obj.fullName : `${namePrefix}${obj.fullName}`
    }
    const fullNameToNamespace = _(objs)
      .map(obj => [getFullName(obj), obj.namespacePrefix])
      .fromPairs()
      .value()

    const instancesFullNames = objs.map(getFullName)
      .filter(name => !instanceNameMatchRegex(`${type}.${name}`, this.instancesRegexBlacklist))
    const instanceInfos = await this.client.readMetadata(type, instancesFullNames)
      .catch(err => {
        log.error('failed to read metadata for type %s', type)
        throw err
      })
    return instanceInfos.map(instanceInfo =>
      ({ namespace: fullNameToNamespace[instanceInfo.fullName], instanceInfo }))
  }

  private async getFirstBatchOfInstances(type: ObjectType): Promise<QueryResult<Value>> {
    // build the initial query and populate the fields names list in the query
    const queryString = `SELECT ${
      getCompoundChildFields(type).map(f => apiName(f))
    } FROM ${apiName(type)}`
    return this.client.runQuery(queryString)
  }
}
