import {
  Type,
  ElementsRegistry,
  ObjectType,
  ElemID,
  PrimitiveTypes,
  InstanceElement,
  Values,
  Field,
} from 'adapter-api'
import { SaveResult } from 'jsforce'
import { isArray } from 'util'
import _ from 'lodash'
import SalesforceClient from './client/client'
import * as constants from './constants'
import {
  ProfileInfo, CompleteSaveResult, SfError, FieldLevelSecurity,
} from './client/types'
import {
  toCustomField, toCustomObject, apiName, sfCase, bpCase, fieldFullName, Types,
  getValueTypeFieldAnnotations, getFieldAnnotations, toProfiles, fromProfiles,
  FieldPermission as FieldPermissions,
} from './transformer'

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
  const innerAnnotate = (annotations: Values, name: string): void => {
    if (!annotations[constants.API_NAME]) {
      annotations[constants.API_NAME] = sfCase(name, true)
    }
    if (!annotations[constants.LABEL]) {
      annotations[constants.LABEL] = sfCase(name)
    }
  }

  innerAnnotate(element.annotationsValues, element.elemID.name)
  Object.values(element.fields).forEach(field => {
    innerAnnotate(field.annotationsValues, field.name)
  })
}

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

    const persmissionsResult = await this.updatePermissions(post, Object.values(post.fields))
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
      new ElemID('', 'string'),
      PrimitiveTypes.STRING
    )

    const simpleBoolean = registery.getElement(
      new ElemID('', 'boolean'),
      PrimitiveTypes.BOOLEAN
    )

    const configID = new ElemID('salesforce')
    const config = new ObjectType({
      elemID: configID,
      fields: {
        username: new Field(configID, 'username', simpleString),
        password: new Field(configID, 'password', simpleString),
        token: new Field(configID, 'token', simpleString),
        sandbox: new Field(configID, 'sandbox', simpleBoolean),
      },
      annotations: {},
      annotationsValues: {},
    })

    return config
  }

  /**
   * Remove an element
   * @param element The provided element to remove
   * @returns true for success, false for failure
   */
  public async remove(element: ObjectType): Promise<void> {
    const result = await this.client.delete(constants.CUSTOM_OBJECT, apiName(element))
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
    const deletedFields = prevElement.getFieldsThatAreNotInOther(post)
    const deleteResult = this.deleteCustomFields(prevElement, deletedFields)

    // Retrieve the custom fields for addition, create them and update the permissions
    const newFields = post.getFieldsThatAreNotInOther(prevElement)
    const createResult = this.createFields(post, newFields)

    // Update the permissions of the fields that remain
    const updatePermissionsResult = this.updateFieldsPermissions(prevElement, post)

    await Promise.all([deleteResult, createResult])

    // Update the annotation values - this can't be done asynchronously with the previous
    // operations beacause the update API expects to receive the updated list of fields,
    // hence the need to perform the fields deletion and creation first, and then update the
    // object.
    // We also await here on the updateFieldPermissions which we started before awaiting on the
    // fields creation/deletion to minimize runtime
    const updateObjectResult = this.updateObject(post)
    await Promise.all([updatePermissionsResult, updateObjectResult])

    return post
  }

  /**
   * Updates required explicit field permissions in new object by comparing the field permissions
   * in the new and old objects. Explicit field permissions are required for removed permissions
   * @param oldElementAnnotations The old field annotation values
   * @param newElementAnnotations The new field annotation values
   */
  private static updateFieldPermissionsInNewObject(
    oldElementAnnotations: Values,
    newElementAnnotations: Values
  ): void {
    const newFieldLevelSecurity = newElementAnnotations[constants.FIELD_LEVEL_SECURITY]
    const oldFieldLevelSecurity = oldElementAnnotations[constants.FIELD_LEVEL_SECURITY]
    // If there aren't any permissions on the new object's field, we copy them to the new one
    // and update them to be not editable and not readable (remove them explicitly)
    if (!newFieldLevelSecurity) {
      // eslint-disable-next-line no-param-reassign
      const emptyFieldLevelSecurity: FieldLevelSecurity = {}
      newElementAnnotations[constants.FIELD_LEVEL_SECURITY] = emptyFieldLevelSecurity
      Object.keys(oldFieldLevelSecurity).forEach(securityUser => {
        emptyFieldLevelSecurity[securityUser] = { editable: false, readable: false }
      })
    } else if (oldFieldLevelSecurity && newFieldLevelSecurity) {
      // If some permissions were removed, we will need to remove the permissions from the
      // field explicitly
      const newPermissions = new Set<string>(Object.keys(newFieldLevelSecurity))
      const removedPermissions = Object.keys(
        oldFieldLevelSecurity
      ).filter(f => !newPermissions.has(f))
      removedPermissions.forEach(securityUser => {
        newFieldLevelSecurity[securityUser] = { editable: false, readable: false }
      })
    }
  }

  /**
   * Updates the fields permissions for an object's fields
   * @param prevElement The previous object
   * @param newElement The new object
   */
  private async updateFieldsPermissions(
    prevElement: ObjectType,
    newElement: ObjectType,
  ): Promise<void> {
    // Intersect between the 2 objects, and update the permissions of the fields that remain,
    // if they have changed
    const remainingFields = newElement.getMutualFieldsWithOther(prevElement).map(f => f.name)
    const fieldsToUpdate = remainingFields.filter(field => (
      !_.isEqual(
        prevElement.fields[field].annotationsValues[constants.FIELD_LEVEL_SECURITY],
        newElement.fields[field].annotationsValues[constants.FIELD_LEVEL_SECURITY]
      )
    ))
    if (fieldsToUpdate.length === 0) {
      return
    }
    // For each field, Update its permissions in the new element
    fieldsToUpdate.forEach(field => {
      SalesforceAdapter.updateFieldPermissionsInNewObject(
        prevElement.fields[field].annotationsValues,
        newElement.fields[field].annotationsValues
      )
    })
    // Create the permissions
    // Build the permissions in a Profile object for all the custom fields we will add
    const permissionsResult = await this.updatePermissions(
      newElement,
      Object.values(newElement.fields).filter(f => fieldsToUpdate.includes(f.name)),
    )
    diagnose(permissionsResult)
  }

  /**
   * Updates the object in SFDC
   * @param element the updated version of the object we wish to update its annotation values
   */
  private async updateObject(element: ObjectType): Promise<void> {
    const updateResult = await this.client.update(
      constants.CUSTOM_OBJECT,
      toCustomObject(element)
    )
    diagnose(updateResult)
  }

  /**
   * Creates custom fields and their corresponding field permissions
   * @param object the object that the fields belong to
   * @param fieldsToAdd The fields to create
   * @returns successfully managed to create all fields with their permissions or not
   */
  private async createFields(object: ObjectType, fieldsToAdd: Field[]): Promise<void> {
    if (fieldsToAdd.length === 0) return

    // Create the custom fields
    const result = await this.client.create(constants.CUSTOM_FIELD,
      fieldsToAdd.map(f => toCustomField(object, f, true)))
    diagnose(result)

    // Create the permissions
    // Build the permissions in a Profile object for all the custom fields we will add
    const permissionsResult = await this.updatePermissions(object, fieldsToAdd)
    diagnose(permissionsResult)
  }

  /**
   * Creates permissions in a Profile object for custom fields and update it
   * @param element The object api name
   * @param fields The custom fields
   * @returns the update result
   */
  private async updatePermissions(element: ObjectType, fields: Field[]):
    Promise<SaveResult | SaveResult[]> {
    const profiles = toProfiles(element, fields)
    if (profiles.length > 0) {
      return this.client.update(constants.METADATA_PROFILE_OBJECT, profiles)
    }
    return []
  }

  /**
   * Deletes custom fields
   * @param objectApiName the object api name those fields reside in
   * @param fieldsApiName the custom fields we wish to delete
   */
  private async deleteCustomFields(element: ObjectType, fields: Field[]): Promise<void> {
    if (fields.length === 0) {
      return
    }

    const result = await this.client.delete(constants.CUSTOM_FIELD,
      fields.map(field => fieldFullName(element, field)))
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
        element.fields[bpCase(field.name)] = new Field(
          element.elemID,
          field.name,
          Types.get(field.soapType),
          {
            [constants.API_NAME]: field.name,
            ...getValueTypeFieldAnnotations(field),
          },
        )
      }
    })
    return element
  }

  private async discoverSObjects(): Promise<Type[]> {
    const sobjects = await Promise.all(
      (await this.client.listSObjects()).map(
        obj => this.createSObjectTypeElement(obj.name)
      )
    )
    // discover permissions per field - we do this post element creation as we
    // fetch permssions for all fields in single call.
    const permissions = await this.discoverPermissions()
    // add field permissions to all discovered elements
    sobjects.forEach(sobject => {
      Object.values(sobject.fields).forEach(field => {
        const fieldPermission = permissions.get(fieldFullName(sobject, field))
        if (fieldPermission) {
          field.annotationsValues[constants.FIELD_LEVEL_SECURITY] = {}
          fieldPermission.forEach((profilePermission, profile) => {
            field.annotationsValues[constants.FIELD_LEVEL_SECURITY][
              bpCase(profile)] = profilePermission
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
      element.fields[bpCase(field.name)] = new Field(
        element.elemID,
        bpCase(field.name),
        Types.get(field.type),
        {
          [constants.API_NAME]: field.name,
          ...getFieldAnnotations(field),
        },
      )
    })
    return element
  }

  /**
   * Discover all sobject field permissions
   * return fullFieldName -> (profile -> permissions)
   */
  private async discoverPermissions(): Promise<
    Map<string, Map<string, FieldPermissions>>> {
    const profiles = await this.client.listMetadataObjects(
      constants.METADATA_PROFILE_OBJECT
    )
    const profilesInfo = await Promise.all(
      profiles.map(prof => this.client.readMetadata(
        constants.METADATA_PROFILE_OBJECT,
        prof.fullName
      ) as Promise<ProfileInfo>)
    )
    return fromProfiles(profilesInfo)
  }
}
