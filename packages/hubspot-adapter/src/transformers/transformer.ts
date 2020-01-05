import _ from 'lodash'
import {
  ElemID, ObjectType,
  PrimitiveType, PrimitiveTypes,
  Field as TypeField, BuiltinTypes, InstanceElement, Values,
  isObjectType, Type, CORE_ANNOTATIONS,
} from 'adapter-api'
import {
  FIELD_TYPE_NAMES, FORM_FIELD_NAMES,
  HUBSPOT, OBJECTS_NAMES,
} from '../constants'
import {
  Form,
} from '../client/types'


const formElemID = new ElemID(HUBSPOT, OBJECTS_NAMES.FORM)


export class Types {
  public static hubspotTypes: ObjectType[] = [
    new ObjectType({
      elemID: formElemID,
      fields: {
        portalId: new TypeField(
          formElemID, FORM_FIELD_NAMES.PORTALID, BuiltinTypes.NUMBER, {
            name: FORM_FIELD_NAMES.PORTALID,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        guid: new TypeField(
          formElemID, FORM_FIELD_NAMES.GUID, BuiltinTypes.STRING, {
            name: FORM_FIELD_NAMES.GUID,
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        name: new TypeField(
          formElemID, FORM_FIELD_NAMES.NAME, BuiltinTypes.STRING, {
            name: FORM_FIELD_NAMES.NAME,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        ),
        method: new TypeField(
          formElemID, FORM_FIELD_NAMES.METHOD, BuiltinTypes.STRING, {
            name: FORM_FIELD_NAMES.METHOD,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        cssClass: new TypeField(
          formElemID, FORM_FIELD_NAMES.CSSCLASS, BuiltinTypes.STRING, {
            name: FORM_FIELD_NAMES.CSSCLASS,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        redirect: new TypeField(
          formElemID, FORM_FIELD_NAMES.REDIRECT, BuiltinTypes.STRING, {
            name: FORM_FIELD_NAMES.REDIRECT,
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        submitText: new TypeField(
          formElemID, 'submitText', BuiltinTypes.STRING, {
            name: 'submitText',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        notifyRecipients: new TypeField(
          formElemID, 'notifyRecipients', BuiltinTypes.STRING, {
            name: 'notifyRecipients',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        ignoreCurrentValues: new TypeField(
          formElemID, 'ignoreCurrentValues', BuiltinTypes.BOOLEAN, {
            name: 'ignoreCurrentValues',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        deletable: new TypeField(
          formElemID, 'deletable', BuiltinTypes.BOOLEAN, {
            name: 'deletable',
            _readOnly: true,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        inlineMessage: new TypeField(
          formElemID, 'inlineMessage', BuiltinTypes.STRING, {
            name: 'inlineMessage',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
    }),
  ]

  public static fieldTypes: Record<string, Type> = {
    textarea: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPE_NAMES.TEXTAREA),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
      },
    }),
    text: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPE_NAMES.TEXT),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
      },
    }),
    date: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPE_NAMES.DATE),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
      },
    }),
    file: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPE_NAMES.FILE),
      primitive: PrimitiveTypes.STRING,
      annotationTypes: {
      },
    }),
    number: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPE_NAMES.NUMBER),
      primitive: PrimitiveTypes.NUMBER,
      annotationTypes: {
      },
    }),
    select: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPE_NAMES.SELECT),
      primitive: PrimitiveTypes.NUMBER,
      annotationTypes: {
      },
    }),
    radio: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPE_NAMES.RADIO),
      primitive: PrimitiveTypes.NUMBER,
      annotationTypes: {
      },
    }),
    checkbox: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPE_NAMES.CHECKBOX),
      primitive: PrimitiveTypes.NUMBER,
      annotationTypes: {
      },
    }),
    booleancheckbox: new PrimitiveType({
      elemID: new ElemID(HUBSPOT, FIELD_TYPE_NAMES.BOOLEANCHECKBOX),
      primitive: PrimitiveTypes.NUMBER,
      annotationTypes: {
      },
    }),
  }

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

export const fromHubspotObj = (info: Form, infoType: ObjectType): Values => {
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

export const createHubspotInstanceElement = (
  hubspotInfo: Form,
  type: ObjectType
): InstanceElement => {
  const typeName = type.elemID.name
  const values = fromHubspotObj(hubspotInfo, type)
  return new InstanceElement(
    new ElemID(HUBSPOT, hubspotInfo.name).name,
    type,
    values,
    [HUBSPOT, 'records', typeName, hubspotInfo.name],
  )
}
