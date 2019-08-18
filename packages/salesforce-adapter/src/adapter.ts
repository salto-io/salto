import {
  BuiltinTypes, Type, ObjectType, ElemID, InstanceElement, Values,
  Field, Element, isObjectType, isInstanceElement, isPrimitiveType,
} from 'adapter-api'
import {
  SaveResult, ValueTypeField, MetadataInfo, Field as SObjField,
} from 'jsforce'
import { isArray } from 'util'
import _ from 'lodash'
import SalesforceClient from './client/client'
import * as constants from './constants'
import {
  CompleteSaveResult, SfError,
} from './client/types'
import {
  toCustomField, toCustomObject, apiName, sfCase, fieldFullName, Types,
  getValueTypeFieldElement, getSObjectFieldElement, fromMetadataInfo,
  bpCase, toMetadataInfo, metadataType,
} from './transformer'
import { filter as layoutFilter } from './filters/layouts'
import { filter as fieldPermissionsFilter } from './filters/field_permissions'

// Diagnose client results
const diagnose = (result: SaveResult | SaveResult[]): void => {
  const errorMessage = (error: SfError | SfError[]): string => {
    if (isArray(error)) {
      return error.map(e => e.message).join('\n')
    }
    return error.message
  }

  if (!result) {
    return
  }
  let errors: string[] = []
  if (isArray(result)) {
    errors = errors.concat(
      (result as CompleteSaveResult[])
        .filter(r => r && r.errors)
        .map(r => errorMessage(r.errors))
    )
  } else if ((result as CompleteSaveResult).errors) {
    errors.push(errorMessage((result as CompleteSaveResult).errors))
  }

  if (errors.length > 0) {
    // TODO: use CrudError
    throw Error(errors.join('\n'))
  }
}

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
  innerAnnotate(element.getAnnotationsValues(), element.elemID.name)
  Object.values(element.fields).forEach(field => {
    innerAnnotate(field.getAnnotationsValues(), field.name)
  })
}

export default class SalesforceAdapter {
  private static DISCOVER_METADATA_TYPES_BLACKLIST = [
    'ApexClass', // For some reason we cannot access this from the metadata API
    'InstalledPackage', // Instances of this don't actually have an ID and they contain duplicates
    'CustomObject', // We have special treatment for this type
  ]

  filters = [fieldPermissionsFilter, layoutFilter]

  private innerClient?: SalesforceClient
  public get client(): SalesforceClient {
    return this.innerClient as SalesforceClient
  }

  init(conf: InstanceElement): void {
    this.innerClient = new SalesforceClient(
      conf.value.username,
      conf.value.password + conf.value.token,
      conf.value.sandbox
    )
  }

  /**
   * @return {ObjectType} - The configuration type for the adapter.
   * This is used by core to:
   * 1) Locate the proper configuration type for the adapter,
   * 2) Prompt the user in order to create an instance of it if it can't
   *    find it in the blueprints
   */
  // disable class method use as we need this function for Adapter interface
  // eslint-disable-next-line class-methods-use-this
  public getConfigType(): ObjectType {
    const configID = new ElemID('salesforce')
    const config = new ObjectType({
      elemID: configID,
      fields: {
        username: new Field(configID, 'username', BuiltinTypes.STRING),
        password: new Field(configID, 'password', BuiltinTypes.STRING),
        token: new Field(configID, 'token', BuiltinTypes.STRING),
        sandbox: new Field(configID, 'sandbox', BuiltinTypes.BOOLEAN),
      },
      annotations: {},
      annotationsValues: {},
    })

    return config
  }

  /**
   * Discover configuration elements (types and instances in the given salesforce account)
   * Account credentials were given in the constructor.
   */
  public async discover(): Promise<Element[]> {
    const fieldTypes = Types.getAllFieldTypes()
    const metadataTypeNames = (await this.client.listMetadataTypes()).map(x => x.xmlName)
    const metadataTypes = this.discoverMetadataTypes(metadataTypeNames)
    const sObjects = this.discoverSObjects(await metadataTypes)
    const metadataInstances = this.discoverMetadataInstances(metadataTypeNames, await metadataTypes)

    const elements = _.flatten(
      await Promise.all([fieldTypes, metadataTypes, sObjects, metadataInstances]) as Element[][]
    )

    SalesforceAdapter.fixListsDiscovery(elements)
    await this.runFiltersOnDiscover(elements)
    return elements
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
    diagnose(await this.runFiltersOnAdd(post))

    return post
  }

  /**
   * Add new object
   * @param element of ObjectType to add
   * @returns the updated object with extra info like api name, label and metadata type
   * @throws error in case of failure
   */
  private async addObject(element: ObjectType): Promise<Element> {
    const post = element.clone()
    annotateApiNameAndLabel(post)

    diagnose(await this.client.create(constants.CUSTOM_OBJECT, toCustomObject(post)))

    return post as Element
  }

  /**
   * Add new Instance
   * @param instance to add
   * @returns the updated instance
   * @throws error in case of failure
   */
  private async addInstance(element: InstanceElement): Promise<Element> {
    const result = await this.client.create(
      element.getAnnotationsValues()[constants.METADATA_TYPE],
      toMetadataInfo(sfCase(element.elemID.name), element.value, element.type as ObjectType)
    )
    diagnose(result)

    return element
  }

  /**
   * Remove an element (object/instance)
   * @param element to remove
   */
  public async remove(element: Element): Promise<void> {
    diagnose(await this.client.delete(metadataType(element), apiName(element)))
    diagnose(await this.runFiltersOnRemove(element))
  }

  /**
   * Updates a custom object
   * @param prevElement The metadata of the old object
   * @param newElement The new metadata of the object to replace
   * @returns true for success, false for failure
   */
  public async update(prevElement: ObjectType, newElement: ObjectType): Promise<ObjectType> {
    const post = newElement.clone()
    annotateApiNameAndLabel(post)

    if (apiName(post) !== apiName(prevElement)) {
      throw Error(
        `Failed to update element as api names pre=${apiName(
          prevElement
        )} and post=${apiName(post)} are different`
      )
    }

    const fieldsUpdateResult = await Promise.all([
      // Retrieve the custom fields for deletion and delete them
      this.deleteCustomFields(prevElement, prevElement.getFieldsThatAreNotInOther(post)),
      // Retrieve the custom fields for addition and than create them
      this.createFields(post, post.getFieldsThatAreNotInOther(prevElement))])
    // Update the annotation values - this can't be done asynchronously with the previous
    // operations beacause the update API expects to receive the updated list of fields,
    // hence the need to perform the fields deletion and creation first, and then update the
    // object.
    // We also await here on the updateFieldPermissions which we started before awaiting on the
    // fields creation/deletion to minimize runtime
    const objectUpdateResult = await this.client.update(constants.CUSTOM_OBJECT,
      toCustomObject(post))
    // Aspects should be updated once all object related properties updates are over
    const filtersResult = await this.runFiltersOnUpdate(prevElement, post)
    diagnose([..._.flatten(fieldsUpdateResult), objectUpdateResult as SaveResult,
      ...filtersResult])

    return post
  }

  /**
   * Creates custom fields and their corresponding field permissions
   * @param object the object that the fields belong to
   * @param fieldsToAdd The fields to create
   * @returns successfully managed to create all fields with their permissions or not
   */
  private async createFields(object: ObjectType, fieldsToAdd: Field[]): Promise<SaveResult[]> {
    if (fieldsToAdd.length === 0) return []
    // Create the custom fields
    return this.client.create(constants.CUSTOM_FIELD,
      fieldsToAdd.map(f => toCustomField(object, f, true))) as Promise<SaveResult[]>
  }

  /**
   * Deletes custom fields
   * @param objectApiName the object api name those fields reside in
   * @param fieldsApiName the custom fields we wish to delete
   */
  private async deleteCustomFields(element: ObjectType, fields: Field[]): Promise<SaveResult[]> {
    if (fields.length === 0) return []
    return this.client.delete(constants.CUSTOM_FIELD,
      fields.map(field => fieldFullName(element, field))) as Promise<SaveResult[]>
  }

  private async discoverMetadataTypes(typeNames: string[]): Promise<Type[]> {
    const knownTypes = new Map<string, Type>()
    return _.flatten(await Promise.all(typeNames
      .filter(name => !SalesforceAdapter.DISCOVER_METADATA_TYPES_BLACKLIST.includes(name))
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
    isSubtype: boolean = false,
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
        Array.isArray(field.fields) ? field.fields : [field.fields],
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

  private async discoverMetadataInstances(typeNames: string[], types: Type[]):
    Promise<InstanceElement[]> {
    const instances = await Promise.all(types
      .filter(isObjectType)
      .filter(t => typeNames.includes(sfCase(t.elemID.name)))
      .map(t => this.createInstanceElements(t)))
    return _.flatten(instances)
  }

  private async createInstanceElements(type: ObjectType): Promise<InstanceElement[]> {
    const typeName = sfCase(type.elemID.name)
    const isSettings = typeName === constants.SETTINGS_METADATA_TYPE
    const instances = await this.listMetadataInstances(typeName)
    return instances.filter(i => i.fullName !== undefined)
      .map(i => new InstanceElement(
        new ElemID(constants.SALESFORCE, type.elemID.name, bpCase(i.fullName)),
        type,
        fromMetadataInfo(i, type, !isSettings), // Transfom of settings values shouldn't be strict
        isSettings ? ['settings'] : ['records', type.elemID.name, bpCase(i.fullName)],
      ))
  }

  private async discoverSObjects(metadataTypes: Type[]): Promise<Type[]> {
    const customObjectNames = new Set(
      (await this.client.listMetadataObjects(constants.CUSTOM_OBJECT))
        .map(obj => obj.fullName)
    )
    const metadataTypeNames = new Set(metadataTypes.map(elem => elem.elemID.name))

    const sobjects = await Promise.all(_.flatten(await Promise.all(
      _(await this.client.listSObjects())
        .map(obj => obj.name)
        .filter(name => !metadataTypeNames.has(bpCase(name)))
        .chunk(100)
        .map(nameChunk => this.client.describeSObjects(nameChunk))
        .map(async objects => (await objects).map(
          async ({ name, fields }) => SalesforceAdapter.createSObjectTypeElement(
            name, fields, await customObjectNames
          )
        ))
        .value()
    )))
    return sobjects
  }

  private static createSObjectTypeElement(
    objectName: string,
    fields: SObjField[],
    customObjectNames: Set<string>,
  ): Type {
    const element = Types.get(objectName) as ObjectType
    element.annotate({ [constants.API_NAME]: objectName })
    element.annotate({ [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT })
    element.path = [
      ...(customObjectNames.has(objectName) ? ['objects'] : ['types', 'object']),
      element.elemID.name,
    ]
    const fieldElements = fields.map(field => getSObjectFieldElement(element.elemID, field))

    // Set fields on elements
    fieldElements.forEach(field => {
      element.fields[field.name] = field
    })
    return element
  }

  /**
   * This method mark fields as list if we see instance with list values.
   * After marking the field as list it will look for values with single value
   * and fix the value to be list with single element.
   * The method change the element inline and not create new element.
   * @param elements the discovered elements.
   */
  private static fixListsDiscovery(elements: Element[]): void {
    // This method iterate on types and corresponding values and run innerChange
    // on every "node".
    const applyRecursive = (type: ObjectType, value: Values,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      innerChange: (field: Field, value: any) => void): any => {
      Object.keys(type.fields).forEach(key => {
        if (!value || !value[key]) return
        value[key] = innerChange(type.fields[key], value[key])
        const fieldType = type.fields[key].type
        if (isObjectType(fieldType)) {
          if (_.isArray(value[key])) {
            value[key].forEach((val: Values) => applyRecursive(fieldType, val, innerChange))
          } else {
            applyRecursive(fieldType, value[key], innerChange)
          }
        }
      })
    }

    // First mark all lists as isList=true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markList = (field: Field, value: any): any => {
      if (_.isArray(value)) {
        field.isList = true
      }
      return value
    }
    elements.filter(isInstanceElement).forEach(instnace =>
      applyRecursive(instnace.type as ObjectType, instnace.value, markList))


    // Cast all lists to list
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const castLists = (field: Field, value: any): any => {
      if (field.isList && !_.isArray(value)) {
        return [value]
      }
      // We get from sfdc api list with empty strings for empty object (possibly jsforce issue)
      if (field.isList && _.isArray(value) && _.isEmpty(value.filter(v => !_.isEmpty(v)))) {
        return []
      }
      return value
    }
    elements.filter(isInstanceElement).forEach(instnace =>
      applyRecursive(instnace.type as ObjectType, instnace.value, castLists))
  }

  /**
   * List all the instances of specific metatatype
   * @param type the metadata type
   */
  private async listMetadataInstances(type: string): Promise<MetadataInfo[]> {
    const objs = await this.client.listMetadataObjects(type)
    if (!objs) {
      return []
    }
    const names = objs.map(obj => obj.fullName)
    // For some unknown reason, for metadata type = 'Settings', when calling readMetadata we should
    // use type = OBJNAME+'Settings'
    if (type === constants.SETTINGS_METADATA_TYPE) {
      return Promise.all(names
        .map(name => this.client.readMetadata(name + type, name) as Promise<MetadataInfo>))
    }
    return _.flatten(await Promise.all(_.chunk(names, 10)
      .map(chunk => this.client.readMetadata(type, chunk) as Promise<MetadataInfo[]>)))
  }

  // Filter related functions
  private async runFiltersOnDiscover(elements: Element[]): Promise<void[]> {
    return Promise.all(this.filters.map(filter =>
      filter.onDiscover(this.client, elements)))
  }

  private async runFiltersOnAdd(after: Element): Promise<SaveResult[]> {
    return _.flatten(await Promise.all(this.filters.map(filter =>
      filter.onAdd(this.client, after))))
  }


  private async runFiltersOnUpdate(before: Element, after: Element): Promise<SaveResult[]> {
    return _.flatten(await Promise.all(this.filters.map(filter =>
      filter.onUpdate(this.client, before, after))))
  }

  private async runFiltersOnRemove(before: Element): Promise<SaveResult[]> {
    return _.flatten(await Promise.all(this.filters.map(filter =>
      filter.onRemove(this.client, before))))
  }
}
