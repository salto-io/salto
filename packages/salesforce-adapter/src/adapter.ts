import {
  Type,
  ElementsRegistry,
  ObjectType,
  ElemID,
  PrimitiveTypes,
  InstanceElement,
} from 'adapter-api'
import { SaveResult } from 'jsforce'
import { isArray } from 'util'
import SalesforceClient from './client/client'
import * as constants from './constants'
import {
  FieldPermissions,
  ProfileInfo,
  CompleteSaveResult,
  SfError,
} from './client/types'
import {
  toCustomField,
  toCustomObject,
  toProfileInfo,
  sfCase,
  bpCase,
  fieldFullName,
  Types,
  fromValueTypeField,
  fromField,
} from './transformer'

// Diagnose client results
const diagnose = (result: SaveResult | SaveResult[]): void => {
  const errorMessage = (error: SfError | SfError[]): string => {
    if (isArray(error)) {
      return error.map(e => e.message).join('\n')
    }
    return error.message
  }

  let errors: string[] = []
  if (isArray(result)) {
    errors = errors.concat(
      (result as CompleteSaveResult[])
        .filter(r => r.errors !== undefined)
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
  const innerAnnotate = (obj: Type, name: string): void => {
    if (!obj.annotationsValues[constants.API_NAME]) {
      obj.annotate({
        [constants.API_NAME]: sfCase(name, true),
      })
    }
    if (!obj.annotationsValues[constants.LABEL]) {
      obj.annotate({ [constants.LABEL]: sfCase(name) })
    }
  }

  innerAnnotate(element, element.elemID.name)
  Object.entries(element.fields).forEach(([fieldName, field]): void => {
    innerAnnotate(field, fieldName)
  })
}

const apiName = (element: Type): string => element.annotationsValues[constants.API_NAME]

export default class SalesforceAdapter {
  readonly client: SalesforceClient

  constructor(conf: InstanceElement) {
    this.client = new SalesforceClient(
      conf.value.username,
      conf.value.password + conf.value.token,
      conf.value.sandbox
    )
  }

  /**
   * Discover configuration elements (types and instances in the given salesforce account)
   * Account credentials were given in the constructor.
   */
  public async discover(): Promise<Type[]> {
    // TODO: add here salesforce primitive data types
    const result = await Promise.all([
      this.discoverSObjects(),
      this.discoverMetadataTypes(),
    ])
    return result[0].concat(result[1])
  }

  /**
   * Add new type element
   * @param element the object to add
   * @returns the updated object with extra info like api name and label
   * @throws error in case of failure
   */
  public async add(element: ObjectType): Promise<ObjectType> {
    const post = element.clone()
    annotateApiNameAndLabel(post)

    const result = await this.client.create(
      constants.CUSTOM_OBJECT,
      toCustomObject(post)
    )
    diagnose(result)

    const persmissionsResult = await this.updatePermissions(
      apiName(post),
      Object.values(post.fields).map(f => apiName(f))
    )
    diagnose(persmissionsResult)

    return post
  }

  /**
   * @return {ObjectType} - The configuration type for the adapter.
   * This is used by core to:
   * 1) Locate the proper configuration type for the adapter,
   * 2) Prompt the user in order to create an instance of it if it can't
   *    find it in the blueprints
   */
  public static getConfigType(): ObjectType {
    const registery = new ElementsRegistry()
    const simpleString = registery.getElement(
      new ElemID({ adapter: '', name: 'string' }),
      PrimitiveTypes.STRING
    )

    const simpleBoolean = registery.getElement(
      new ElemID({ adapter: '', name: 'boolean' }),
      PrimitiveTypes.BOOLEAN
    )

    const config = new ObjectType({
      elemID: new ElemID({ adapter: 'salesforce' }),
      fields: {
        username: simpleString,
        password: simpleString,
        token: simpleString,
        sandbox: simpleBoolean,
      },
      annotations: {},
      annotationsValues: {},
    })

    return config
  }

  /**
   * Remove an element
   * @param type The metadata type of the element to remove
   * @param element The provided element to remove
   * @returns true for success, false for failure
   */
  public async remove(element: ObjectType): Promise<void> {
    const result = await this.client.delete(
      constants.CUSTOM_OBJECT,
      apiName(element)
    )
    diagnose(result)
  }

  /**
   * Updates a custom object
   * @param prevElement The metadata of the old object
   * @param newElement The new metadata of the object to replace
   * @returns true for success, false for failure
   */
  public async update(
    prevElement: ObjectType,
    newElement: ObjectType
  ): Promise<ObjectType> {
    const post = newElement.clone()
    annotateApiNameAndLabel(post)

    if (apiName(post) !== apiName(prevElement)) {
      throw Error(
        `Failed to update element as api names pre=${apiName(
          prevElement
        )} and post=${apiName(post)} are different`
      )
    }

    // Retrieve the custom fields for deletion and delete them
    await this.deleteCustomFields(
      apiName(prevElement),
      Object.entries(prevElement.fields)
        .filter(field =>
          prevElement.getFieldsThatAreNotInOther(post).includes(field[0]))
        .map(field => apiName(field[1]))
    )

    // Retrieve the custom fields for addition, create them and update the permissions
    await this.createFields(
      apiName(post),
      Object.entries(post.fields)
        .filter(field =>
          post.getFieldsThatAreNotInOther(prevElement).includes(field[0]))
        .map(field => field[1])
    )

    // TODO: Update the rest of the attributes in the retrieved old objects
    return post
  }

  /**
   * Creates custom fields and their corresponding field permissions
   * @param relatedObjectApiName the object that the fields belong to
   * @param fieldsToAdd The fields to create
   * @returns successfully managed to create all fields with their permissions or not
   */
  private async createFields(
    relatedObjectApiName: string,
    fieldsToAdd: Type[]
  ): Promise<void> {
    if (fieldsToAdd.length === 0) return

    // Create the custom fields
    const result = await this.client.create(
      constants.CUSTOM_FIELD,
      fieldsToAdd.map(f => toCustomField(f, true, relatedObjectApiName))
    )
    diagnose(result)

    // Create the permissions
    // Build the permissions in a Profile object for all the custom fields we will add
    const permissionsResult = await this.updatePermissions(
      relatedObjectApiName,
      fieldsToAdd.map(apiName)
    )
    diagnose(permissionsResult)
  }

  /**
   * Creates permissions in a Profile object for custom fields and update it
   * @param objectApiName The object api name
   * @param fieldsApiNames The custom fields names
   * @returns the update result
   */
  private async updatePermissions(
    objectApiName: string,
    fieldsApiNames: string[]
  ): Promise<SaveResult | SaveResult[]> {
    return this.client.update(
      constants.METADATA_PROFILE_OBJECT,
      toProfileInfo(
        constants.PROFILE_NAME_SYSTEM_ADMINISTRATOR,
        objectApiName,
        fieldsApiNames
      )
    )
  }

  /**
   * Deletes custom fields
   * @param objectApiName the object api name those fields reside in
   * @param fieldsApiName the custom fields we wish to delete
   */
  private async deleteCustomFields(
    objectApiName: string,
    fieldsApiName: string[]
  ): Promise<void> {
    if (fieldsApiName.length === 0) {
      return
    }

    const result = await this.client.delete(
      constants.CUSTOM_FIELD,
      fieldsApiName.map(field => fieldFullName(objectApiName, field))
    )
    diagnose(result)
  }

  private async discoverMetadataTypes(): Promise<Type[]> {
    const objects = await this.client.listMetadataTypes()
    return Promise.all(
      objects
        .filter(obj => obj.xmlName !== constants.CUSTOM_OBJECT)
        .map(async obj => this.createMetadataTypeElement(obj.xmlName))
    )
  }

  private async createMetadataTypeElement(objectName: string): Promise<Type> {
    const element = Types.get(objectName) as ObjectType
    element.annotate({ [constants.API_NAME]: objectName })
    const fields = await this.client.discoverMetadataObject(objectName)
    if (!fields) {
      return element
    }
    fields.forEach(field => {
      if (field.name !== constants.METADATA_OBJECT_NAME_FIELD) {
        const fieldElement = fromValueTypeField(field)
        fieldElement.annotate({ [constants.API_NAME]: field.name })
        element.fields[bpCase(field.name)] = fieldElement
      }
    })
    return element
  }

  private async discoverSObjects(): Promise<Type[]> {
    const sobjects = await Promise.all(
      (await this.client.listSObjects()).map(async obj =>
        this.createSObjectTypeElement(obj.name))
    )
    // discover permissions per field - we do this post element creation as we
    // fetch permssions for all fields in single call.
    const permissions = await this.discoverPermissions()
    // add field permissions to all discovered elements
    sobjects.forEach(sobject => {
      Object.values(sobject.fields).forEach(field => {
        const fieldPermission = permissions.get(
          `${sobject.annotationsValues[constants.API_NAME]}.${
            field.annotationsValues[constants.API_NAME]
          }`
        )
        if (fieldPermission) {
          // eslint-disable-next-line no-param-reassign
          field.annotationsValues[constants.FIELD_LEVEL_SECURITY] = {}
          fieldPermission.forEach((profilePermission, profile) => {
            // eslint-disable-next-line no-param-reassign
            field.annotationsValues[constants.FIELD_LEVEL_SECURITY][
              bpCase(profile)
            ] = {
              editable: profilePermission.editable,
              readable: profilePermission.readable,
            }
          })
        }
      })
    })
    return sobjects
  }

  private async createSObjectTypeElement(
    objectName: string
  ): Promise<ObjectType> {
    const element = Types.get(objectName) as ObjectType
    element.annotate({ [constants.API_NAME]: objectName })
    const fields = await this.client.discoverSObject(objectName)
    fields.forEach(field => {
      const fieldElement = fromField(field)
      fieldElement.annotate({ [constants.API_NAME]: field.name })
      element.fields[bpCase(field.name)] = fieldElement
    })
    return element
  }

  /**
   * Discover all sobject field permissions
   * return fullFieldName -> (profile -> permissions)
   */
  private async discoverPermissions(): Promise<
    Map<string, Map<string, FieldPermissions>>
    > {
    const profiles = await this.client.listMetadataObjects(
      constants.METADATA_PROFILE_OBJECT
    )
    const profilesInfo = await Promise.all(
      profiles.map(prof => this.client.readMetadata(
        constants.METADATA_PROFILE_OBJECT,
        prof.fullName
      ) as Promise<ProfileInfo>)
    )

    const permissions = new Map<string, Map<string, FieldPermissions>>()
    profilesInfo.forEach(info => {
      info.fieldPermissions.forEach(fieldPermission => {
        const name = fieldPermission.field
        if (!permissions.has(name)) {
          permissions.set(name, new Map<string, FieldPermissions>())
        }
        permissions.get(name).set(info.fullName, fieldPermission)
      })
    })

    return permissions
  }
}
