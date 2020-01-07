import _ from 'lodash'
import {
  ElemID, ObjectType,
  PrimitiveType, PrimitiveTypes,
  Field as TypeField, BuiltinTypes, InstanceElement, Values,
  isObjectType, Type, CORE_ANNOTATIONS,
} from 'adapter-api'
import {
  FIELD_TYPES, FORM_FIELDS,
  HUBSPOT, OBJECTS_NAMES, PROPERTY_FIELDS, PROPERTY_GROUP_FIELDS,
} from '../constants'
import {
  HubspotMetadata,
} from '../client/types'


const formElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.FORM)
const propertyGroupElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.PROPERTYGROUP)
const propertyElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.PROPERTY)

export class Types {
  public static propertyType: ObjectType =
    new ObjectType({
      elemID: propertyElemID,
      fields: {
        [PROPERTY_FIELDS.NAME]: new TypeField(
          propertyElemID, PROPERTY_FIELDS.NAME, BuiltinTypes.STRING, {
            name: PROPERTY_FIELDS.NAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [PROPERTY_FIELDS.LABEL]: new TypeField(
          propertyElemID, PROPERTY_FIELDS.LABEL, BuiltinTypes.STRING, {
            name: PROPERTY_FIELDS.LABEL,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [PROPERTY_FIELDS.DESCRIPTION]: new TypeField(
          propertyElemID, PROPERTY_FIELDS.DESCRIPTION, BuiltinTypes.STRING, {
            name: PROPERTY_FIELDS.DESCRIPTION,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [PROPERTY_FIELDS.GROUPNAME]: new TypeField(
          propertyElemID, PROPERTY_FIELDS.GROUPNAME, BuiltinTypes.STRING, {
            name: PROPERTY_FIELDS.GROUPNAME,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [PROPERTY_FIELDS.TYPE]: new TypeField(
          propertyElemID, PROPERTY_FIELDS.TYPE, BuiltinTypes.STRING, {
            name: PROPERTY_FIELDS.TYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [PROPERTY_FIELDS.FIELDTYPE]: new TypeField(
          propertyElemID, PROPERTY_FIELDS.FIELDTYPE, BuiltinTypes.STRING, {
            name: PROPERTY_FIELDS.FIELDTYPE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [PROPERTY_FIELDS.ISSMARTFIELD]: new TypeField(
          propertyElemID, PROPERTY_FIELDS.ISSMARTFIELD, BuiltinTypes.BOOLEAN, {
            name: PROPERTY_FIELDS.ISSMARTFIELD,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [PROPERTY_FIELDS.REQUIRED]: new TypeField(
          propertyElemID, PROPERTY_FIELDS.REQUIRED, BuiltinTypes.BOOLEAN, {
            name: PROPERTY_FIELDS.REQUIRED,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [PROPERTY_FIELDS.HIDDEN]: new TypeField(
          propertyElemID, PROPERTY_FIELDS.HIDDEN, BuiltinTypes.BOOLEAN, {
            name: PROPERTY_FIELDS.HIDDEN,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [PROPERTY_FIELDS.DEFAULTVALUE]: new TypeField(
          propertyElemID, PROPERTY_FIELDS.DEFAULTVALUE, BuiltinTypes.STRING, {
            name: PROPERTY_FIELDS.DEFAULTVALUE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [PROPERTY_FIELDS.SELECTEDOPTIONS]: new TypeField(
          propertyElemID, PROPERTY_FIELDS.SELECTEDOPTIONS, BuiltinTypes.STRING, {
            name: PROPERTY_FIELDS.SELECTEDOPTIONS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
      },
      path: ['hubspot', 'types', 'subtypes', propertyElemID.name],
    })

  public static propertyGroupType: ObjectType =
    new ObjectType({
      elemID: propertyGroupElemID,
      fields: {
        [PROPERTY_GROUP_FIELDS.DEFAULT]: new TypeField(
          propertyGroupElemID, PROPERTY_GROUP_FIELDS.DEFAULT, BuiltinTypes.BOOLEAN, {
            name: PROPERTY_GROUP_FIELDS.DEFAULT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [PROPERTY_GROUP_FIELDS.FIELDS]: new TypeField(
          propertyGroupElemID, PROPERTY_GROUP_FIELDS.FIELDS, Types.propertyType, {
            name: PROPERTY_GROUP_FIELDS.FIELDS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
        [PROPERTY_GROUP_FIELDS.ISSMARTGROUP]: new TypeField(
          propertyGroupElemID, PROPERTY_GROUP_FIELDS.ISSMARTGROUP, BuiltinTypes.BOOLEAN, {
            name: PROPERTY_GROUP_FIELDS.ISSMARTGROUP,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
      path: ['hubspot', 'types', 'subtypes', propertyGroupElemID.name],
    })

  /**
   * This method create array of all supported Hubspot objects.
   * This is static creation cause hubspot API support only instances.
   */
  public static hubspotObjects: ObjectType[] = [
    new ObjectType({
      elemID: formElemID,
      fields: {
        [FORM_FIELDS.GUID]: new TypeField(
          formElemID, FORM_FIELDS.GUID, BuiltinTypes.STRING, {
            name: FORM_FIELDS.GUID,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        [FORM_FIELDS.NAME]: new TypeField(
          formElemID, FORM_FIELDS.NAME, BuiltinTypes.STRING, {
            name: FORM_FIELDS.NAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        [FORM_FIELDS.METHOD]: new TypeField(
          formElemID, FORM_FIELDS.METHOD, BuiltinTypes.STRING, {
            name: FORM_FIELDS.METHOD,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.CSSCLASS]: new TypeField(
          formElemID, FORM_FIELDS.CSSCLASS, BuiltinTypes.STRING, {
            name: FORM_FIELDS.CSSCLASS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.REDIRECT]: new TypeField(
          formElemID, FORM_FIELDS.REDIRECT, BuiltinTypes.STRING, {
            name: FORM_FIELDS.REDIRECT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.SUBMITTEXT]: new TypeField(
          formElemID, FORM_FIELDS.SUBMITTEXT, BuiltinTypes.STRING, {
            name: FORM_FIELDS.SUBMITTEXT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.NOTIFYRECIPIENTS]: new TypeField(
          formElemID, FORM_FIELDS.NOTIFYRECIPIENTS, BuiltinTypes.STRING, {
            name: FORM_FIELDS.NOTIFYRECIPIENTS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.IGNORECURRENTVALUES]: new TypeField(
          formElemID, FORM_FIELDS.IGNORECURRENTVALUES, BuiltinTypes.BOOLEAN, {
            name: FORM_FIELDS.IGNORECURRENTVALUES,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.DELETABLE]: new TypeField(
          formElemID, FORM_FIELDS.DELETABLE, BuiltinTypes.BOOLEAN, {
            name: FORM_FIELDS.DELETABLE,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.INLINEMESSAGE]: new TypeField(
          formElemID, FORM_FIELDS.INLINEMESSAGE, BuiltinTypes.STRING, {
            name: FORM_FIELDS.INLINEMESSAGE,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        [FORM_FIELDS.FORMFIELDGROUPS]: new TypeField(
          formElemID, FORM_FIELDS.FORMFIELDGROUPS, Types.propertyGroupType, {
            name: FORM_FIELDS.FORMFIELDGROUPS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
      },
      path: [HUBSPOT, 'objects', formElemID.name],
    }),
  ]


  public static hubspotSubTypes: ObjectType[] = [
    Types.propertyGroupType,
    Types.propertyType,
  ]

  public static fieldTypes: Record<string, Type> = {
    [FIELD_TYPES.TEXTAREA]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.TEXTAREA),
      primitive: PrimitiveTypes.STRING,
    }),
    [FIELD_TYPES.TEXT]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.TEXT),
      primitive: PrimitiveTypes.STRING,
    }),
    [FIELD_TYPES.DATE]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.DATE),
      primitive: PrimitiveTypes.STRING,
    }),
    [FIELD_TYPES.FILE]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.FILE),
      primitive: PrimitiveTypes.STRING,
    }),
    [FIELD_TYPES.NUMBER]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.NUMBER),
      primitive: PrimitiveTypes.NUMBER,
    }),
    [FIELD_TYPES.SELECT]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.SELECT),
      primitive: PrimitiveTypes.NUMBER,
    }),
    [FIELD_TYPES.RADIO]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.RADIO),
      primitive: PrimitiveTypes.NUMBER,
    }),
    [FIELD_TYPES.CHECKBOX]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.CHECKBOX),
      primitive: PrimitiveTypes.NUMBER,
    }),
    [FIELD_TYPES.BOOLEANCHECKBOX]: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPES.BOOLEANCHECKBOX),
      primitive: PrimitiveTypes.NUMBER,
    }),
  }

  /**
   * This method create all the (basic) field types
   */
  static getAllFieldTypes(): Type[] {
    return _.concat(
      Object.values(Types.fieldTypes),
    ).map(type => {
      const fieldType = type.clone()
      fieldType.path = [HUBSPOT, 'types', 'field_types']
      return fieldType
    })
  }
}

/**
 * This method generate (instance) values by iterating hubspot object fields.
 * Also ensure that only expected fields will shown
 * @param info
 * @param infoType
 */
export const fromHubspotObject = (
  info: HubspotMetadata,
  infoType: ObjectType
): Values => {
  const transform = (obj: Values, type: ObjectType): Values =>
    _(obj).mapKeys((_value, key) => key).mapValues((value, key) => {
      const field = type.fields[key]
      if (field !== undefined) {
        const fieldType = field.type
        if (isObjectType(fieldType)) {
          return _.isArray(value)
            ? (value as []).map(v => transform(v, fieldType))
            : transform(value, fieldType)
        }
        return value
      }
      return undefined
    }).omitBy(_.isUndefined)
      .value()
  return transform(info as Values, infoType)
}

/**
 * Creating all the instance for specific type
 * @param hubspotMetadata the instance metadata from hubspot
 * @param type the objectType
 */
export const createHubspotInstanceElement = (
  hubspotMetadata: HubspotMetadata,
  type: ObjectType
): InstanceElement => {
  const typeName = type.elemID.name
  const values = fromHubspotObject(hubspotMetadata, type)
  return new InstanceElement(
    new ElemID(HUBSPOT, hubspotMetadata.name).name,
    type,
    values,
    [HUBSPOT, 'records', typeName, hubspotMetadata.name],
  )
}
