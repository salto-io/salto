/* eslint-disable class-methods-use-this */
import { Field, SaveResult, ValueTypeField } from 'jsforce'
import {
  Type,
  TypesRegistry,
  ObjectType,
  TypeID,
  PrimitiveTypes
} from 'adapter-api'
import SalesforceClient from './client'
import * as constants from './constants'
import {
  CustomObject,
  FieldPermissions,
  ProfileInfo,
  CustomField
} from './salesforce_types'

// TODO: handle snakeCase and __c
// should this be in TypeElement?
// import { snakeCase } from 'lodash'

// TODO: this should be replaced with Elements from core once ready
type Config = Record<string, any>

/**
 * Return type for salesforce type name
 *
 * @param type name of salesforce type
 */

export default class SalesforceAdapter {
  readonly client: SalesforceClient
  // type registery used in discover
  readonly types = new TypesRegistry()

  constructor(conf: Config) {
    this.client = new SalesforceClient(
      conf.username,
      conf.password + conf.token,
      conf.sandbox
    )
  }

  private getType(name: string): Type {
    switch (name.toLowerCase()) {
      case 'string': {
        return this.types
          .getType(new TypeID({ adapter: '', name }), PrimitiveTypes.STRING)
          .clone()
      }
      case 'number': {
        // TODO: validate indeed we have this type in SFDC API
        return this.types
          .getType(new TypeID({ adapter: '', name }), PrimitiveTypes.NUMBER)
          .clone()
      }
      case 'boolean': {
        return this.types
          .getType(
            // TODO: take checkbox from constans
            new TypeID({ adapter: constants.SALESFORCE, name: 'checkbox' })
          )
          .clone()
      }
      default: {
        return this.types
          .getType(new TypeID({ adapter: constants.SALESFORCE, name }))
          .clone()
      }
    }
  }

  /**
   * Discover configuration elements (types and instances in the given salesforce account)
   * Account credentials were given in the constructor.
   */
  public async discover(): Promise<Type[]> {
    // TODO: add here salesforce primitive data types
    const result = await Promise.all([
      this.discoverSObjects(),
      this.discoverMetadataTypes()
    ])
    return result[0].concat(result[1])
  }

  /**
   * Add new type element
   */
  public async add(element: ObjectType): Promise<boolean> {
    // TODO: handle permissions
    const customObject = new CustomObject(element)
    const result = await this.client.create(
      constants.CUSTOM_OBJECT,
      customObject
    )
    const saveResult = this.isSaveResultsSuccessful(result)

    let permissionsResult: boolean
    if (saveResult) {
      permissionsResult = await this.updatePermissions(customObject)
    }

    return saveResult && permissionsResult
  }

  /**
   * Remove an element
   * @param type The metadata type of the element to remove
   * @param element The provided element to remove
   * @returns true for success, false for failure
   */
  public async remove(element: ObjectType): Promise<boolean> {
    // Build the custom object to retrieve the full name from
    const customObject = new CustomObject(element)
    const result = await this.client.delete(
      constants.CUSTOM_OBJECT,
      customObject.fullName
    )
    return (result as SaveResult).success
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
  ): Promise<boolean> {
    const oldObject = new CustomObject(prevElement)
    const newObject = new CustomObject(newElement)
    // Verify the objects are the same (same full name)
    if (oldObject.fullName !== newObject.fullName) {
      return false
    }
    // Retrieve the custom fields for deletion (those that appear in the old object and not in the new)
    const fieldsToDelete = this.getFieldsThatAreNotInOther(oldObject, newObject)
    // Delete them
    const deleteResult = await this.deleteCustomFields(
      oldObject,
      fieldsToDelete
    )

    // Retrieve the custom fields for addition (those that appear in the new object and not in the old)
    const fieldsToAdd = this.getFieldsThatAreNotInOther(newObject, oldObject)

    // Create the custom fields and update the permissions
    const createResult = await this.createFields(newObject, fieldsToAdd)

    return deleteResult && createResult

    // TODO: Update the rest of the attributes in the retrieved old object and call the update method
  }

  /**
   * A helper method that returns the fields that appera in the first object and not in other
   * @param theObject The object from which we return fields that do not appear in the other
   * @param otherObject the other object we compare to
   * @returns The fields that appear in the first object and not in the second
   */
  private getFieldsThatAreNotInOther(
    theObject: CustomObject,
    otherObject: CustomObject
  ): CustomField[] {
    const newObjFieldsNames = otherObject.fields.map(field => field.fullName)
    return theObject.fields.filter(field => {
      return !newObjFieldsNames.includes(field.fullName)
    })
  }

  /**
   * Creates custom fields and their corresponding field permissions
   * @param relatedObject the object that the fields belong to
   * @param fieldsToAdd The fields to create
   * @returns successfully managed to create all fields with their permissions or not
   */
  private async createFields(
    relatedObject: CustomObject,
    fieldsToAdd: CustomField[]
  ): Promise<boolean> {
    if (fieldsToAdd.length === 0) {
      return true
    }
    // Build the permissions in a Profile object for all the custom fields we will add
    const permissions = this.createPermissionsAndPrepareFields(
      relatedObject,
      fieldsToAdd
    )

    // Create the custom fields
    const createResult = await this.client.create(
      constants.CUSTOM_FIELD,
      fieldsToAdd
    )
    if (!this.isSaveResultsSuccessful(createResult)) {
      return false
    }

    // Create the permissions
    const permissionResult = await this.client.update(
      constants.METADATA_PROFILE_OBJECT,
      permissions
    )
    return this.isSaveResultsSuccessful(permissionResult)
  }

  /**
   * Creates permissions in a Profile object for custom fields
   * @param fieldsForAddition The custom fields we create the permissions for
   * @returns A ProfileInfo object that contains all the required permissions
   */
  private createPermissionsAndPrepareFields(
    relatedObject: CustomObject,
    fieldsForAddition: CustomField[]
  ): ProfileInfo {
    fieldsForAddition.forEach(field => {
      // We modify fullname of the custom fields to include that of the object name
      // eslint-disable-next-line no-param-reassign
      field.fullName = `${relatedObject.fullName}.${field.fullName}`
    })
    const profile = new ProfileInfo(constants.PROFILE_NAME_SYSTEM_ADMINISTRATOR)
    fieldsForAddition.forEach(field => {
      profile.fieldPermissions.push({
        field: field.fullName,
        editable: true,
        readable: true
      })
    })
    return profile
  }

  /**
   * Deletes custom fields
   * @param oldObject the custom object those fields reside in
   * @param fieldsForDeletion the custom fields we wish to delete
   * @returns successfully managed to delete all fields or not
   */
  private async deleteCustomFields(
    oldObject: CustomObject,
    fieldsForDeletion: CustomField[]
  ): Promise<boolean> {
    if (fieldsForDeletion.length === 0) {
      return true
    }
    const fullNamesForDeletion = fieldsForDeletion.map(
      field => `${oldObject.fullName}.${field.fullName}`
    )
    const saveResult = await this.client.delete(
      constants.CUSTOM_FIELD,
      fullNamesForDeletion
    )
    return this.isSaveResultsSuccessful(saveResult)
  }

  private async discoverMetadataTypes(): Promise<Type[]> {
    const objects = await this.client.listMetadataTypes()
    return Promise.all(
      objects
        .filter(obj => {
          return obj.xmlName !== constants.CUSTOM_OBJECT
        })
        .map(async obj => this.createMetadataTypeElement(obj.xmlName))
    )
  }

  private async createMetadataTypeElement(objectName: string): Promise<Type> {
    const element = this.getType(objectName) as ObjectType
    const fields = await this.client.discoverMetadataObject(objectName)
    if (!fields) {
      return element
    }
    fields.forEach(field => {
      if (field.name !== constants.METADATA_OBJECT_NAME_FIELD) {
        element.fields[field.name] = this.createMetadataFieldTypeElement(field)
      }
    })
    return element
  }

  private createMetadataFieldTypeElement(field: ValueTypeField): Type {
    const element = this.getType(field.soapType) as ObjectType
    element.annotationsValues.required = field.valueRequired

    if (field.picklistValues && field.picklistValues.length > 0) {
      element.annotationsValues.values = field.picklistValues.map(
        val => val.value
      )
      const defaults = field.picklistValues
        .filter(val => {
          return val.defaultValue === true
        })
        .map(val => val.value)
      if (defaults.length === 1) {
        // eslint-disable-next-line no-underscore-dangle
        element.annotationsValues[Type.DEFAULT] = defaults.pop()
      } else {
        // eslint-disable-next-line no-underscore-dangle
        element.annotationsValues[Type.DEFAULT] = defaults
      }
    }

    return element
  }

  private async discoverSObjects(): Promise<Type[]> {
    const sobjects = await Promise.all(
      (await this.client.listSObjects()).map(async obj =>
        this.createSObjectTypeElement(obj.name)
      )
    )
    // discover permissions per field
    const permissions = await this.discoverPermissions()
    // add field permissions to all discovered elements
    // we don't use here forEach as we changed the element (linter issue)
    sobjects.forEach(sobject => {
      Object.entries(sobject.fields).forEach(([fieldName, field]) => {
        const fieldPermission = permissions.get(
          `${sobject.typeID.name}.${fieldName}`
        )
        if (fieldPermission) {
          // eslint-disable-next-line no-param-reassign
          field.annotationsValues[
            constants.FIELD_LEVEL_SECURITY_ANNOTATION
          ] = {}
          fieldPermission.forEach((profilePermission, profile) => {
            // eslint-disable-next-line no-param-reassign
            field.annotationsValues[constants.FIELD_LEVEL_SECURITY_ANNOTATION][
              profile
            ] = {
              editable: profilePermission.editable,
              readable: profilePermission.readable
            }
          })
        }
      })
    })
    return sobjects
  }

  private async updatePermissions(obj: CustomObject): Promise<boolean> {
    const profile = new ProfileInfo(constants.PROFILE_NAME_SYSTEM_ADMINISTRATOR)
    obj.fields.forEach(field => {
      profile.fieldPermissions.push({
        field: `${obj.fullName}.${field.fullName}`,
        editable: true,
        readable: true
      })
    })

    const result = await this.client.update(
      constants.METADATA_PROFILE_OBJECT,
      profile
    )
    return (result as SaveResult).success
  }

  private async createSObjectTypeElement(
    objectName: string
  ): Promise<ObjectType> {
    const element = this.getType(objectName) as ObjectType
    const fields = await this.client.discoverSObject(objectName)
    fields.forEach(field => {
      element.fields[field.name] = this.createSObjectFieldTypeElement(field)
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
      profiles.map(prof => {
        return this.client.readMetadata(
          constants.METADATA_PROFILE_OBJECT,
          prof.fullName
        ) as Promise<ProfileInfo>
      })
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

  private createSObjectFieldTypeElement(field: Field): Type {
    const element: Type = this.getType(field.type)
    const annotations = element.annotationsValues
    annotations[constants.LABEL] = field.label
    annotations[constants.REQUIRED] = field.nillable
    annotations[Type.DEFAULT] = field.defaultValue

    if (field.picklistValues && field.picklistValues.length > 0) {
      annotations[constants.PICKLIST_VALUES] = field.picklistValues.map(
        val => val.value
      )
      annotations[constants.RESTRICTED_PICKLIST] = false
      if (field.restrictedPicklist) {
        annotations[constants.RESTRICTED_PICKLIST] = field.restrictedPicklist
      }

      const defaults = field.picklistValues
        .filter(val => {
          return val.defaultValue === true
        })
        .map(val => val.value)
      if (defaults.length > 0) {
        if (field.type === 'picklist') {
          annotations[Type.DEFAULT] = defaults.pop()
        } else {
          annotations[Type.DEFAULT] = defaults
        }
      }
    }

    return element
  }

  /**
   * Checks whether an operation's SaveResult or SaveResult[] is successful
   * @param saveResult either a single SaveResult or an array of SaveResult
   * @returns true if all SaveResults are successful
   */
  private isSaveResultsSuccessful(
    saveResult: SaveResult | SaveResult[]
  ): boolean {
    if (Array.isArray(saveResult)) {
      return (saveResult as SaveResult[])
        .map(r => r.success)
        .every(result => result === true)
    }
    return (saveResult as SaveResult).success
  }
}
