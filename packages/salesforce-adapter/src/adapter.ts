import {
  BuiltinTypes, Type, ObjectType, ElemID, InstanceElement, isModificationDiff,
  isRemovalDiff, isAdditionDiff, Field, Element, isObjectType, isInstanceElement, AdapterCreator,
  Value, Change, getChangeElement, isField, isElement, ElemIdGetter, ADAPTER,
} from 'adapter-api'
import {
  SaveResult, MetadataInfo, Field as SObjField, DescribeSObjectResult, QueryResult,
} from 'jsforce'
import _ from 'lodash'
import { logger } from '@salto/logging'
import wu from 'wu'
import { decorators, collections } from '@salto/lowerdash'
import SalesforceClient, { Credentials } from './client/client'
import * as constants from './constants'
import {
  toCustomField, toCustomObject, apiName, sfCase, fieldFullName, Types,
  getSObjectFieldElement, toMetadataInfo, createInstanceElement,
  metadataType, toMetadataPackageZip, toInstanceElements, createMetadataTypeElements,
  instanceElementstoRecords, elemIDstoRecords, getCompoundChildFields,
} from './transformer'
import layoutFilter from './filters/layouts'
import fieldPermissionsFilter from './filters/field_permissions'
import validationRulesFilter from './filters/validation_rules'
import assignmentRulesFilter from './filters/assignment_rules'
import convertListsFilter from './filters/convert_lists'
import convertTypeFilter from './filters/convert_types'
import missingFieldsFilter from './filters/missing_fields'
import standardValueSetFilter from './filters/standard_value_sets'
import flowFilter from './filters/flow'
import leadConvertSettingsFilter from './filters/lead_convert_settings'
import lookupFiltersFilter from './filters/lookup_filters'
import samlInitMethodFilter from './filters/saml_initiation_method'
import settingsFilter from './filters/settings_type'
import listOrderFilter from './filters/list_order'
import {
  FilterCreator, Filter, FilterWith, filtersWith,
} from './filter'

const { makeArray } = collections.array

const log = logger(module)

const RECORDS_CHUNK_SIZE = 10000

// Add elements defaults
const addLabel = (elem: Type | Field): void => {
  const name = isField(elem) ? elem.name : elem.elemID.name
  const { annotations } = elem
  if (!annotations[constants.LABEL]) {
    annotations[constants.LABEL] = sfCase(name)
    log.debug(`added LABEL=${sfCase(name)} to ${name}`)
  }
}

const addApiName = (elem: Type | Field, name: string): void => {
  if (!elem.annotations[constants.API_NAME]) {
    elem.annotations[constants.API_NAME] = name
    log.debug(`added API_NAME=${name} to ${isField(elem) ? elem.name : elem.elemID.name}`)
  }
  if (!isField(elem) && !elem.annotationTypes[constants.API_NAME]) {
    elem.annotationTypes[constants.API_NAME] = BuiltinTypes.SERVICE_ID
  }
}

const addMetadataType = (elem: ObjectType, metadataTypeValue = constants.CUSTOM_OBJECT): void => {
  const { annotations, annotationTypes } = elem
  if (!annotationTypes[constants.METADATA_TYPE]) {
    annotationTypes[constants.METADATA_TYPE] = BuiltinTypes.SERVICE_ID
  }
  if (!annotations[constants.METADATA_TYPE]) {
    annotations[constants.METADATA_TYPE] = metadataTypeValue
    log.debug(`added METADATA_TYPE=${sfCase(metadataTypeValue)} to ${
      elem.elemID.getFullName()}`)
  }
}

const addDefaults = (element: ObjectType): void => {
  addApiName(element, sfCase(element.elemID.name, true))
  addMetadataType(element)
  addLabel(element)
  Object.values(element.fields).forEach(field => {
    addApiName(field, sfCase(field.name, true))
    addLabel(field)
  })
}

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
  // Metadata types that we want to treat as top level types (fetch instances of them)
  // even though they are not returned as top level metadata types from the API
  metadataAdditionalTypes?: string[]

  // Metadata types that we do not want to fetch even though they are returned as top level
  // types from the API
  metadataTypeBlacklist?: string[]

  // Metadata types that we have to update using the deploy API endpoint
  metadataToUpdateWithDeploy?: string[]

  // Filters to deploy to all adapter operations
  filterCreators?: FilterCreator[]

  // client to use
  client: SalesforceClient

  // callback function to get an existing elemId or create a new one by the ServiceIds values
  getElemIdFunc?: ElemIdGetter}

const logDuration = (message?: string): decorators.InstanceMethodDecorator =>
  decorators.wrapMethodWith(
    async (original: decorators.OriginalCall): Promise<unknown> => {
      const start = Date.now()
      const result = await original.call()
      const element = original.args.find(isElement)
      const defaultMessage = `finished running salesforce.${original.name} ${
        element ? `element=${element.elemID.getFullName()}` : ''} `
      log.debug(`${message || defaultMessage} [took=${Date.now() - start} ms]`)
      return result
    }
  )

export default class SalesforceAdapter {
  private metadataTypeBlacklist: string[]
  private metadataToUpdateWithDeploy: string[]
  private filterCreators: FilterCreator[]

  public constructor({
    metadataTypeBlacklist = [
      'ReportType', // See SALTO-76
      'ApexClass', 'ApexTrigger', // For some reason we cannot access this from the metadata API
      // See also SALTO-168.
      'InstalledPackage', // Instances of this don't actually have an ID and they contain duplicates
      'CustomObject', 'CustomField', // We have special treatment for those type
      'Settings',
      'StaticResource',
      // readMetadata fails on those and pass on the parents (AssignmentRules and EscalationRules)
      'AssignmentRule', 'EscalationRule',
    ],
    metadataToUpdateWithDeploy = [
      'AssignmentRules',
    ],
    filterCreators = [
      fieldPermissionsFilter,
      layoutFilter,
      validationRulesFilter,
      assignmentRulesFilter,
      standardValueSetFilter,
      missingFieldsFilter,
      flowFilter,
      leadConvertSettingsFilter,
      lookupFiltersFilter,
      samlInitMethodFilter,
      settingsFilter,
      listOrderFilter,
      // The following filters should remain last in order to make sure they fix all elements
      convertListsFilter,
      convertTypeFilter,
    ],
    client,
    getElemIdFunc,
  }: SalesforceAdapterParams) {
    this.metadataTypeBlacklist = metadataTypeBlacklist
    this.metadataToUpdateWithDeploy = metadataToUpdateWithDeploy
    this.filterCreators = filterCreators
    this.client = client
    if (getElemIdFunc) {
      Types.setElemIdGetter(getElemIdFunc)
    }
  }

  private client: SalesforceClient

  /**
   * Fetch configuration elements (types and instances in the given salesforce account)
   * Account credentials were given in the constructor.
   */
  @logDuration('finished fetching account configuration')
  public async fetch(): Promise<Element[]> {
    log.debug('going to fetch salesforce account configuration..')
    const fieldTypes = Types.getAllFieldTypes()
    const metadataTypeNames = this.listMetadataTypes()
    const metadataTypes = this.fetchMetadataTypes(metadataTypeNames)
    const metadataInstances = this.fetchMetadataInstances(metadataTypeNames, metadataTypes)

    // Filter out types returned as both metadata types and SObjects
    const sObjects = this.fetchSObjects().then(
      async types => {
        // All metadata type names include subtypes as well as the "top level" type names
        const allMetadataTypeNames = new Set(
          (await metadataTypes).map(elem => elem.elemID.getFullName()),
        )
        return types.filter(t => !allMetadataTypeNames.has(t.elemID.getFullName()))
      }
    )

    const elements = _.flatten(
      await Promise.all([fieldTypes, metadataTypes, sObjects, metadataInstances]) as Element[][]
    )

    await this.runFiltersOnFetch(elements)
    return elements
  }

  /**
   * Retrieve all the instances of a given type.
   * The function returns an iterator because each API call retrieves the next 2000 instances
   * @param type the object type of which to retrieve instances
   */
  public async *getInstancesOfType(type: ObjectType): AsyncIterable<InstanceElement[]> {
    let results = await this.getFirstBatchOfInstances(type)

    while (true) {
      yield toInstanceElements(type, results)
      if (results.nextRecordsUrl !== undefined) {
        // eslint-disable-next-line no-await-in-loop
        results = await this.client.queryMore(results.nextRecordsUrl)
      } else break
    }
  }

  /**
   * Imports instances of type from the data stream
   * @param type the object type of which to import
   * @param instancesIterator the iterator that provides the instances to delete
   * @returns a promise that represents action completion
   */
  public async importInstancesOfType(
    instancesIterator: AsyncIterable<InstanceElement>
  ): Promise<void> {
    let instances: InstanceElement[] = []
    // eslint-disable-next-line no-restricted-syntax
    for await (const instance of instancesIterator) {
      // Aggregate the instance elements for the proper bulk size
      const length = instances.push(instance)
      if (length === RECORDS_CHUNK_SIZE) {
        // Convert the instances in the transformer to SfRecord[] and send to bulk API
        await this.client.updateBulk(apiName(instances[0].type), 'upsert', instanceElementstoRecords(instances))
        instances = []
      }
    }
    // Send the remaining instances
    if (instances.length > 0) {
      await this.client.updateBulk(apiName(instances[0].type), 'upsert', instanceElementstoRecords(instances))
    }
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
  ): Promise<void> {
    let elemIds: ElemID[] = []
    // eslint-disable-next-line no-restricted-syntax
    for await (const elemId of elemIdIterator) {
      // Aggregate the instance elements for the proper bulk size
      const length = elemIds.push(elemId)
      if (length === RECORDS_CHUNK_SIZE) {
        // Convert the instances in the transformer to SfRecord[] and send to bulk API
        await this.client.updateBulk(apiName(type), 'delete', elemIDstoRecords(elemIds))
        elemIds = []
      }
    }
    // Send the remaining instances
    if (elemIds.length > 0) {
      await this.client.updateBulk(apiName(type), 'delete', elemIDstoRecords(elemIds))
    }
  }

  /**
   * Add new element
   * @param element the object/instance to add
   * @returns the updated element with extra info like api name, label and metadata type
   * @throws error in case of failure
   */
  public async add(element: Element): Promise<Element> {
    let post: Element
    if (isObjectType(element)) {
      post = await this.addObject(element)
    } else {
      post = await this.addInstance(element as InstanceElement)
    }

    await this.runFiltersOnAdd(post)
    return post
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

    await this.client.create(constants.CUSTOM_OBJECT, toCustomObject(post))

    return post
  }

  /**
   * Add new Instance
   * @param element to add
   * @returns the updated instance
   * @throws error in case of failure
   */
  private async addInstance(element: InstanceElement): Promise<InstanceElement> {
    await this.client.create(
      metadataType(element),
      toMetadataInfo(apiName(element), element.value)
    )

    return element
  }

  /**
   * Remove an element (object/instance)
   * @param element to remove
   */
  @logDuration()
  public async remove(element: Element): Promise<void> {
    await this.client.delete(metadataType(element), apiName(element))
    await this.runFiltersOnRemove(element)
  }

  /**
   * Updates an Element
   * @param prevElement The metadata of the old element
   * @param newElement The new metadata of the element to replace
   * @returns the updated element
   */
  @logDuration()
  public async update(before: Element, after: Element,
    changes: Iterable<Change>): Promise<Element> {
    let result = after

    if (isObjectType(before) && isObjectType(after)) {
      result = await this.updateObject(before, after,
        wu(changes).toArray() as Change<ObjectType | Field>[])
    }

    if (isInstanceElement(before) && isInstanceElement(after)) {
      result = await this.updateInstance(before, after)
    }

    // Aspects should be updated once all object related properties updates are over
    await this.runFiltersOnUpdate(before, result, changes)

    return result
  }

  /**
   * Update a custom object
   * @param prevObject The metadata of the old object
   * @param newObject The new metadata of the object to replace
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
      .forEach(f => {
        addLabel(clonedObject.fields[f.name])
        addApiName(clonedObject.fields[f.name], sfCase(f.name, true))
      })

    const fieldChanges = changes.filter(c => isField(getChangeElement(c))) as Change<Field>[]

    // There are fields that are not equal but their transformation
    // to CustomField is (e.g. lookup field with LookupFilter).
    const shouldUpdateField = (beforeField: Field, afterField: Field): boolean =>
      !_.isEqual(toCustomField(before, beforeField, true),
        toCustomField(clonedObject, afterField, true))

    await Promise.all([
      // Retrieve the custom fields for deletion and delete them
      this.deleteCustomFields(clonedObject, fieldChanges
        .filter(isRemovalDiff)
        .map(getChangeElement)),
      // Retrieve the custom fields for addition and than create them
      this.createFields(clonedObject, fieldChanges
        .filter(isAdditionDiff)
        .map(c => clonedObject.fields[c.data.after.name])),
      // Update the remaining fields that were changed
      this.updateFields(clonedObject, fieldChanges
        .filter(isModificationDiff)
        .filter(c => shouldUpdateField(c.data.before, c.data.after))
        .map(c => clonedObject.fields[c.data.after.name])),
    ])

    // Update the annotation values - this can't be done asynchronously with the previous
    // operations because the update API expects to receive the updated list of fields,
    // hence the need to perform the fields deletion and creation first, and then update the
    // object.
    // IMPORTANT: We don't update a built-in object (such as Lead, Customer, etc.)
    // The update API currently allows us to add/remove custom fields to such objects, but not
    // to update them.
    if (apiName(clonedObject).endsWith(constants.SALESFORCE_CUSTOM_SUFFIX)
      // Don't update the object unless its changed
      && changes.find(c => isObjectType(getChangeElement(c)))) {
      await this.client.update(
        metadataType(clonedObject),
        toCustomObject(clonedObject, false)
      ) // Update the object without its fields
    }

    return clonedObject
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
    if (this.metadataToUpdateWithDeploy.includes(typeName)) {
      await this.client.deploy(await toMetadataPackageZip(newInstance))
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
   * @param object the object that the fields belong to
   * @param fieldsToUpdate The fields to update
   * @returns successfully managed to update all fields
   */
  private async updateFields(object: ObjectType, fieldsToUpdate: Field[]): Promise<SaveResult[]> {
    return this.client.update(
      constants.CUSTOM_FIELD,
      fieldsToUpdate.map(f => toCustomField(object, f, true)),
    )
  }

  /**
   * Creates custom fields and their corresponding field permissions
   * @param object the object that the fields belong to
   * @param fieldsToAdd The fields to create
   * @returns successfully managed to create all fields with their permissions or not
   */
  private async createFields(object: ObjectType, fieldsToAdd: Field[]): Promise<SaveResult[]> {
    return this.client.create(
      constants.CUSTOM_FIELD,
      fieldsToAdd.map(f => toCustomField(object, f, true)),
    )
  }

  /**
   * Deletes custom fields
   * @param element the object api name those fields reside in
   * @param fields the custom fields we wish to delete
   */
  private async deleteCustomFields(element: ObjectType, fields: Field[]): Promise<SaveResult[]> {
    return this.client.delete(constants.CUSTOM_FIELD, fields
      .map(field => fieldFullName(element, field)))
  }

  private async listMetadataTypes(): Promise<string[]> {
    return this.client.listMetadataTypes().then(
      types => _.flatten(types
        .map(x => [x.xmlName, ...makeArray(x.childXmlNames)]))
        .filter(name => !this.metadataTypeBlacklist.includes(name))
    )
  }


  @logDuration('finish fetching metadata types')
  private async fetchMetadataTypes(typeNames: Promise<string[]>): Promise<Type[]> {
    const knownTypes = new Map<string, Type>()
    return _.flatten(await Promise.all((await typeNames)
      .map(obj => this.fetchMetadataType(obj, knownTypes))))
  }

  private async fetchMetadataType(objectName: string, knownTypes: Map<string, Type>):
    Promise<Type[]> {
    const fields = await this.client.describeMetadataType(objectName)
    return createMetadataTypeElements(objectName, fields, knownTypes)
  }

  @logDuration('finish fetching instances')
  private async fetchMetadataInstances(typeNames: Promise<string[]>, types: Promise<Type[]>):
    Promise<InstanceElement[]> {
    const topLevelTypeNames = await typeNames
    const instances = await Promise.all((await types)
      .filter(isObjectType)
      .filter(t => topLevelTypeNames.includes(sfCase(t.elemID.name)))
      .map(t => this.createInstanceElements(t)))
    return _.flatten(instances)
  }


  private async createInstanceElements(type: ObjectType): Promise<InstanceElement[]> {
    const typeName = sfCase(type.elemID.name)
    const instances = await this.listMetadataInstances(typeName)
    return instances
      .filter(i => i.fullName !== undefined)
      .map(i => createInstanceElement(i, type))
  }


  private async fetchSObjects(): Promise<Type[]> {
    const getSobjectDescriptions = async (): Promise<DescribeSObjectResult[]> => {
      const sobjectsList = await this.client.listSObjects()
      const sobjectNames = sobjectsList.map(sobj => sobj.name)
      return this.client.describeSObjects(sobjectNames)
    }

    const getCustomObjectNames = async (): Promise<Set<string>> => {
      const customObjects = await this.client.listMetadataObjects(constants.CUSTOM_OBJECT)
      return new Set(customObjects.map(o => o.fullName))
    }

    const [customObjectNames, sobjectsDescriptions] = await Promise.all([
      getCustomObjectNames(), getSobjectDescriptions(),
    ])

    const sobjects = sobjectsDescriptions.map(
      ({ name, custom, fields }) => SalesforceAdapter.createSObjectTypes(
        name, custom, fields, customObjectNames
      )
    )

    return _.flatten(sobjects)
  }

  private static createSObjectTypes(
    objectName: string,
    isCustom: boolean,
    fields: SObjField[],
    customObjectNames: Set<string>,
  ): Type[] {
    const serviceIds = {
      [ADAPTER]: constants.SALESFORCE,
      [constants.API_NAME]: objectName,
      [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
    }

    const element = Types.get(objectName, true, false, serviceIds) as ObjectType
    addApiName(element, objectName)
    addMetadataType(element)

    // Filter out nested fields of compound fields
    const filteredFields = fields.filter(field => !field.compoundFieldName)

    // Set standard fields on element
    filteredFields
      .filter(f => !f.custom)
      .map(f => getSObjectFieldElement(element.elemID, f, serviceIds))
      .forEach(field => {
        element.fields[field.name] = field
      })

    // Create custom fields (if any)
    const customFields = filteredFields
      .filter(f => f.custom)
      .map(f => getSObjectFieldElement(element.elemID, f, serviceIds))

    if (!customObjectNames.has(objectName)) {
      // This is not a custom object type, no need to separate standard part from custom part
      customFields.forEach(field => {
        element.fields[field.name] = field
      })
      element.path = ['types', 'object', element.elemID.name]
      return [element]
    }

    if (isCustom) {
      // This is custom object, we treat standard fields as if they were custom as well
      // so we put all fields in the same element definition
      customFields.forEach(field => {
        element.fields[field.name] = field
      })
      element.path = ['objects', 'custom', element.elemID.name]
      return [element]
    }

    // This is a standard object
    element.path = ['objects', 'standard', element.elemID.name]

    if (_.isEmpty(customFields)) {
      // No custom parts, only standard element needed
      return [element]
    }

    // Custom fields go in a separate element
    const customPart = Types.get(objectName, true, false, serviceIds) as ObjectType
    customFields.forEach(field => {
      customPart.fields[field.name] = field
    })
    customPart.path = ['objects', 'custom', customPart.elemID.name]
    return [element, customPart]
  }

  /**
   * List all the instances of specific metadataType
   * @param type the metadata type
   */
  private async listMetadataInstances(type: string): Promise<MetadataInfo[]> {
    const objs = await this.client.listMetadataObjects(type)
    if (!objs) {
      return []
    }

    return this.client.readMetadata(type, objs.map(obj => obj.fullName))
  }

  private filtersWith<M extends keyof Filter>(m: M): FilterWith<M>[] {
    const allFilters = this.filterCreators.map(f => f({ client: this.client }))
    return filtersWith(m, allFilters)
  }

  // Filter related functions

  private async runFiltersOnFetch(elements: Element[]): Promise<void> {
    // Fetch filters order is important so they should run one after the other
    return this.filtersWith('onFetch').reduce(
      (prevRes, filter) => prevRes.then(() => filter.onFetch(elements)),
      Promise.resolve(),
    )
  }

  private async runFiltersInParallel<M extends keyof Filter>(
    m: M,
    run: (f: FilterWith<M>) => Promise<SaveResult[]>
  ): Promise<SaveResult[]> {
    return _.flatten(
      await Promise.all(this.filtersWith(m).map(run))
    )
  }

  private async runFiltersOnAdd(after: Element): Promise<SaveResult[]> {
    return this.runFiltersInParallel('onAdd', filter => filter.onAdd(after))
  }

  private async runFiltersOnUpdate(before: Element, after: Element,
    changes: Iterable<Change>): Promise<SaveResult[]> {
    return this.runFiltersInParallel('onUpdate', filter => filter.onUpdate(before, after, changes))
  }

  private async runFiltersOnRemove(before: Element): Promise<SaveResult[]> {
    return this.runFiltersInParallel('onRemove', filter => filter.onRemove(before))
  }

  private async getFirstBatchOfInstances(type: ObjectType): Promise<QueryResult<Value>> {
    // build the initial query and populate the fields names list in the query
    const queryString = `SELECT ${getCompoundChildFields(type).map(apiName)} FROM ${apiName(type)}`
    return this.client.runQuery(queryString)
  }
}

const configID = new ElemID('salesforce')

const configType = new ObjectType({
  elemID: configID,
  fields: {
    username: new Field(configID, 'username', BuiltinTypes.STRING),
    password: new Field(configID, 'password', BuiltinTypes.STRING),
    token: new Field(configID, 'token', BuiltinTypes.STRING),
    sandbox: new Field(configID, 'sandbox', BuiltinTypes.BOOLEAN),
  },
  annotationTypes: {},
  annotations: {},
})

const credentialsFromConfig = (config: InstanceElement): Credentials => ({
  username: config.value.username,
  password: config.value.password,
  apiToken: config.value.token,
  isSandbox: config.value.sandbox,
})

const clientFromConfig = (config: InstanceElement): SalesforceClient =>
  new SalesforceClient({
    credentials: credentialsFromConfig(config),
  })

export const creator: AdapterCreator = {
  create: ({ config, getElemIdFunc }) => new SalesforceAdapter({
    client: clientFromConfig(config),
    getElemIdFunc,
  }),
  configType,
}
