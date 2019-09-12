import {
  BuiltinTypes, Type, ObjectType, ElemID, InstanceElement, Values,
  Field, Element, isObjectType, isInstanceElement, isPrimitiveType, AdapterCreator, Value,
} from 'adapter-api'
import {
  SaveResult, ValueTypeField, MetadataInfo, Field as SObjField, DescribeSObjectResult, QueryResult,
} from 'jsforce'
import _ from 'lodash'
import { collections } from '@salto/lowerdash'
import SalesforceClient, { Credentials } from './client/client'
import * as constants from './constants'
import {
  toCustomField, toCustomObject, apiName, sfCase, fieldFullName, Types,
  getValueTypeFieldElement, getSObjectFieldElement, fromMetadataInfo,
  bpCase, toMetadataInfo, metadataType, toMetadataPackageZip, toInstanceElements,
} from './transformer'
import layoutFilter from './filters/layouts'
import fieldPermissionsFilter from './filters/field_permissions'
import validationRulesFilter from './filters/validation_rules'
import assignmentRulesFilter from './filters/assignment_rules'
import convertListsFilter from './filters/convert_lists'
import convertTypeFilter from './filters/convert_types'
import missingFieldsFilter from './filters/missing_fields'
import {
  FilterCreator, Filter, FilterWith, filtersWith,
} from './filter'

const { makeArray } = collections.array

// Add API name and label annotation if missing
const annotateApiNameAndLabel = (element: ObjectType): void => {
  const innerAnnotate = (annotations: Values, name: string): void => {
    if (!annotations[constants.API_NAME]) {
      annotations[constants.API_NAME] = sfCase(name, true)
    }
    if (!annotations[constants.LABEL]) {
      annotations[constants.LABEL] = sfCase(name)
    }
  }

  element.annotate({ [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT })
  innerAnnotate(element.annotationValues, element.elemID.name)
  Object.values(element.fields).forEach(field => {
    innerAnnotate(field.annotationValues, field.name)
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
  // Metadata types that we want to treat as top level types (discover instances of them)
  // even though they are not returned as top level metadata types from the API
  metadataAdditionalTypes?: string[]

  // Metadata types that we do not want to discover even though they are returned as top level
  // types from the API
  metadataTypeBlacklist?: string[]

  // Metadata types that we have to update using the deploy API endpoint
  metadataToUpdateWithDeploy?: string[]

  // Filters to apply to all adapter operations
  filterCreators?: FilterCreator[]

  // client to use
  client: SalesforceClient
}

export default class SalesforceAdapter {
  private metadataAdditionalTypes: string[]
  private metadataTypeBlacklist: string[]
  private metadataToUpdateWithDeploy: string[]
  private filterCreators: FilterCreator[]

  public constructor({
    metadataAdditionalTypes = [
      'ValidationRule', // This is a subtype of CustomObject
    ],
    metadataTypeBlacklist = [
      'ApexClass', // For some reason we cannot access this from the metadata API
      'InstalledPackage', // Instances of this don't actually have an ID and they contain duplicates
      'CustomObject', // We have special treatment for this type
    ],
    metadataToUpdateWithDeploy = [
      'AssignmentRules',
    ],
    filterCreators: filterCreators = [
      fieldPermissionsFilter,
      layoutFilter,
      validationRulesFilter,
      assignmentRulesFilter,
      missingFieldsFilter,
      // The following filters should remain last in order to make sure they fix all elements
      convertListsFilter,
      convertTypeFilter,
    ],
    client,
  }: SalesforceAdapterParams) {
    this.metadataAdditionalTypes = metadataAdditionalTypes
    this.metadataTypeBlacklist = metadataTypeBlacklist
    this.metadataToUpdateWithDeploy = metadataToUpdateWithDeploy
    this.filterCreators = filterCreators
    this.client = client
  }

  private client: SalesforceClient

  /**
   * Discover configuration elements (types and instances in the given salesforce account)
   * Account credentials were given in the constructor.
   */
  public async discover(): Promise<Element[]> {
    const fieldTypes = Types.getAllFieldTypes()
    const metadataTypeNames = this.client.listMetadataTypes().then(
      types => types
        .map(x => x.xmlName)
        .concat(this.metadataAdditionalTypes)
    )
    const metadataTypes = this.discoverMetadataTypes(metadataTypeNames)
    const metadataInstances = this.discoverMetadataInstances(metadataTypeNames, metadataTypes)

    // Filter out types returned as both metadata types and SObjects
    const sObjects = this.discoverSObjects().then(
      async types => {
        // All metadata type names include subtypes as well as the "top level" type names
        const allMetadataTypeNames = new Set((await metadataTypes).map(elem => elem.elemID.name))
        return types.filter(t => !allMetadataTypeNames.has(t.elemID.name))
      }
    )

    const elements = _.flatten(
      await Promise.all([fieldTypes, metadataTypes, sObjects, metadataInstances]) as Element[][]
    )

    await this.runFiltersOnDiscover(elements)
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
    annotateApiNameAndLabel(post)

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
  public async update(prevElement: Element, newElement: Element): Promise<Element> {
    if (isObjectType(prevElement) && isObjectType(newElement)) {
      return this.updateObject(prevElement, newElement)
    }

    if (isInstanceElement(prevElement) && isInstanceElement(newElement)) {
      return this.updateInstance(prevElement, newElement)
    }

    return newElement
  }

  /**
   * Update a custom object
   * @param prevObject The metadata of the old object
   * @param newObject The new metadata of the object to replace
   * @returns the updated object
   */
  private async updateObject(prevObject: ObjectType, newObject: ObjectType): Promise<ObjectType> {
    const clonedObject = newObject.clone()
    annotateApiNameAndLabel(clonedObject)

    validateApiName(prevObject, clonedObject)

    const pre = prevObject.clone()
    annotateApiNameAndLabel(pre)

    await Promise.all([
      // Retrieve the custom fields for deletion and delete them
      this.deleteCustomFields(prevObject, prevObject.getFieldsThatAreNotInOther(clonedObject)),
      // Retrieve the custom fields for addition and than create them
      this.createFields(clonedObject, clonedObject.getFieldsThatAreNotInOther(prevObject)),
      // Update the remaining fields that were changed
      this.updateFields(clonedObject,
        clonedObject.getMutualFieldsWithOther(pre).filter(afterField =>
          !_.isEqual(afterField.annotationValues,
            pre.fields[afterField.name].annotationValues))),
    ])

    // Update the annotation values - this can't be done asynchronously with the previous
    // operations because the update API expects to receive the updated list of fields,
    // hence the need to perform the fields deletion and creation first, and then update the
    // object.
    // IMPORTANT: We don't update a built-in object (such as Lead, Customer, etc.)
    // The update API currently allows us to add/remove custom fields to such objects, but not
    // to update them.
    if (apiName(clonedObject).endsWith(constants.SALESFORCE_CUSTOM_SUFFIX)
      // Don't update the object unless its annotations values have changed
      && !_.isEqual(pre.annotationValues, clonedObject.annotationValues)) {
      await this.client.update(
        metadataType(clonedObject),
        toCustomObject(clonedObject, false)
      ) // Update the object without its fields
    }

    // Aspects should be updated once all object related properties updates are over
    await this.runFiltersOnUpdate(prevObject, clonedObject)

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
    // Create the custom fields
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
    return this.client.delete(
      constants.CUSTOM_FIELD,
      fields.map(field => fieldFullName(element, field)),
    )
  }

  private async discoverMetadataTypes(typeNames: Promise<string[]>): Promise<Type[]> {
    const knownTypes = new Map<string, Type>()
    return _.flatten(await Promise.all((await typeNames)
      .filter(name => !this.metadataTypeBlacklist.includes(name))
      .map(obj => this.discoverMetadataType(obj, knownTypes))))
  }

  private async discoverMetadataType(objectName: string, knownTypes: Map<string, Type>):
    Promise<Type[]> {
    const fields = await this.client.describeMetadataType(objectName)
    return SalesforceAdapter.createMetadataTypeElements(objectName, fields, knownTypes)
  }

  private static createMetadataTypeElements(
    objectName: string,
    fields: ValueTypeField[],
    knownTypes: Map<string, Type>,
    isSubtype = false,
  ): Type[] {
    if (knownTypes.has(objectName)) {
      // Already created this type, no new types to return here
      return []
    }
    const element = Types.get(objectName, false) as ObjectType
    knownTypes.set(objectName, element)
    element.annotate({ [constants.METADATA_TYPE]: objectName })
    element.path = ['types', ...(isSubtype ? ['subtypes'] : []), element.elemID.name]
    if (!fields) {
      return [element]
    }

    // We need to create embedded types BEFORE creating this element's fields
    // in order to make sure all internal types we may need are updated in the
    // knownTypes map
    const embeddedTypes = _.flatten(fields.filter(field => !_.isEmpty(field.fields)).map(
      field => this.createMetadataTypeElements(
        field.soapType,
        makeArray(field.fields),
        knownTypes,
        true,
      )
    ))

    // Enum fields sometimes show up with a type name that is not primitive but also does not
    // have fields (so we won't create an embedded type for it). it seems like these "empty" types
    // are always supposed to be a string with some restriction so we map all non primitive "empty"
    // types to string
    fields
      .filter(field => _.isEmpty(field.fields))
      .filter(field => !isPrimitiveType(Types.get(field.soapType, false)))
      .forEach(field => knownTypes.set(field.soapType, BuiltinTypes.STRING))

    const fieldElements = fields.map(field =>
      getValueTypeFieldElement(element.elemID, field, knownTypes))

    // Set fields on elements
    fieldElements.forEach(field => {
      element.fields[field.name] = field
    })

    return _.flatten([element, embeddedTypes])
  }

  private async discoverMetadataInstances(typeNames: Promise<string[]>, types: Promise<Type[]>):
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
    const isSettings = typeName === constants.SETTINGS_METADATA_TYPE
    const instances = await this.listMetadataInstances(typeName)
    return instances
      .filter(i => i.fullName !== undefined)
      .map(i => new InstanceElement(
        new ElemID(constants.SALESFORCE, type.elemID.name, bpCase(i.fullName)),
        type,
        fromMetadataInfo(i),
        isSettings ? ['settings'] : ['records', type.elemID.name, bpCase(i.fullName)],
      ))
  }

  private async discoverSObjects(): Promise<Type[]> {
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
    const element = Types.get(objectName) as ObjectType
    element.annotate({ [constants.API_NAME]: objectName })
    element.annotate({ [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT })

    // Set standard fields on element
    fields
      .filter(f => !f.custom)
      .map(f => getSObjectFieldElement(element.elemID, f))
      .forEach(field => {
        element.fields[field.name] = field
      })

    // Create custom fields (if any)
    const customFields = fields
      .filter(f => f.custom)
      .map(f => getSObjectFieldElement(element.elemID, f))

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
    const customPart = Types.get(objectName) as ObjectType
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
    const names = objs.map(obj => obj.fullName)

    // For some unknown reason, for metadata type = 'Settings', when calling readMetadata we
    // should use type = OBJNAME+'Settings'
    if (type === constants.SETTINGS_METADATA_TYPE) {
      return Promise.all(
        names.map(name => this.client.readMetadata(name + type, name))
      ).then(_.flatten)
    }

    return this.client.readMetadata(type, names)
  }

  private filtersWith<M extends keyof Filter>(m: M): FilterWith<M>[] {
    const allFilters = this.filterCreators.map(f => f({ client: this.client }))
    return filtersWith(m, allFilters)
  }

  // Filter related functions

  private async runFiltersOnDiscover(elements: Element[]): Promise<void> {
    // Discover filters order is important so they should run one after the other
    return this.filtersWith('onDiscover').reduce(
      (prevRes, filter) => prevRes.then(() => filter.onDiscover(elements)),
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


  private async runFiltersOnUpdate(before: Element, after: Element): Promise<SaveResult[]> {
    return this.runFiltersInParallel('onUpdate', filter => filter.onUpdate(before, after))
  }

  private async runFiltersOnRemove(before: Element): Promise<SaveResult[]> {
    return this.runFiltersInParallel('onRemove', filter => filter.onRemove(before))
  }

  private async getFirstBatchOfInstances(type: ObjectType): Promise <QueryResult<Value>> {
    // build the initial query and populate the fields names list in the query
    const queryString = `SELECT ${Object.values(type.fields).map(apiName)} FROM ${apiName(type)}`
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
  annotationsDescriptor: {},
  annotationValues: {},
})

const credentialsFromConfig = (config: InstanceElement): Credentials => ({
  username: config.value.username,
  password: config.value.password,
  apiToken: config.value.token,
  isSandbox: config.value.sandbox,
})

const clientFromConfig = (config: InstanceElement): SalesforceClient => new SalesforceClient({
  credentials: credentialsFromConfig(config),
})

export const creator: AdapterCreator = {
  create: ({ config }) => new SalesforceAdapter({
    client: clientFromConfig(config),
  }),
  configType,
}
