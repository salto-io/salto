/*
*                      Copyright 2021 Salto Labs Ltd.
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
  ChangeDataType,
  ElemID, FieldDefinition,
  InstanceElement,
  ObjectType,
  PrimitiveType,
  PrimitiveTypes, TypeElement,
  TypeMap,
  Values,
} from '@salto-io/adapter-api'
import { GetLookupNameFunc, naclCase, pathNaclCase, createRefToElmWithValue } from '@salto-io/adapter-utils'
import { LeadAttribute, Field, MarketoMetadata, CustomObject, CustomObjectResponse } from '../client/types'
import {
  FIELD_TYPES,
  MARKETO,
  SUBTYPES_PATH,
  TYPES_PATH,
  RECORDS_PATH,
  NAME,
  API_NAME,
  DATA_TYPE,
  OBJECT_TYPE,
  OBJECTS_NAMES,
  DISPLAY_NAME,
  DESCRIPTION,
  STATE,
  PLURAL_NAME, ID_FIELD, SHOW_IN_LEAD_DETAIL, IS_DEDUPE_FIELD, OBJECTS_PATH,
} from '../constants'

const isAttributeField = (object: LeadAttribute | Field): object is LeadAttribute => 'rest' in object

export class Types {
  private static fieldTypes: TypeMap = {
    [FIELD_TYPES.STRING]: new PrimitiveType({
      elemID: new ElemID(MARKETO, FIELD_TYPES.STRING),
      primitive: PrimitiveTypes.STRING,
    }),
    [FIELD_TYPES.BOOLEAN]: new PrimitiveType({
      elemID: new ElemID(MARKETO, FIELD_TYPES.BOOLEAN),
      primitive: PrimitiveTypes.BOOLEAN,
    }),
    [FIELD_TYPES.CURRENCY]: new PrimitiveType({
      elemID: new ElemID(MARKETO, FIELD_TYPES.CURRENCY),
      primitive: PrimitiveTypes.NUMBER,
    }),
    [FIELD_TYPES.TEXT]: new PrimitiveType({
      elemID: new ElemID(MARKETO, FIELD_TYPES.TEXT),
      primitive: PrimitiveTypes.STRING,
    }),
    [FIELD_TYPES.URL]: new PrimitiveType({
      elemID: new ElemID(MARKETO, FIELD_TYPES.URL),
      primitive: PrimitiveTypes.STRING,
    }),
    [FIELD_TYPES.EMAIL]: new PrimitiveType({
      elemID: new ElemID(MARKETO, FIELD_TYPES.EMAIL),
      primitive: PrimitiveTypes.STRING,
    }),
    [FIELD_TYPES.PHONE]: new PrimitiveType({
      elemID: new ElemID(MARKETO, FIELD_TYPES.PHONE),
      primitive: PrimitiveTypes.STRING,
    }),
    [FIELD_TYPES.DATE]: new PrimitiveType({
      elemID: new ElemID(MARKETO, FIELD_TYPES.DATE),
      primitive: PrimitiveTypes.STRING,
    }),
    [FIELD_TYPES.DATETIME]: new PrimitiveType({
      elemID: new ElemID(MARKETO, FIELD_TYPES.DATETIME),
      primitive: PrimitiveTypes.STRING,
    }),
    [FIELD_TYPES.REFERENCE]: new PrimitiveType({
      elemID: new ElemID(MARKETO, FIELD_TYPES.REFERENCE),
      primitive: PrimitiveTypes.STRING,
    }),
    [FIELD_TYPES.INTEGER]: new PrimitiveType({
      elemID: new ElemID(MARKETO, FIELD_TYPES.INTEGER),
      primitive: PrimitiveTypes.NUMBER,
    }),
    [FIELD_TYPES.FLOAT]: new PrimitiveType({
      elemID: new ElemID(MARKETO, FIELD_TYPES.FLOAT),
      primitive: PrimitiveTypes.NUMBER,
    }),
  }

  static getFieldType(fieldType: string): TypeElement {
    if (Types.fieldTypes[fieldType.toLowerCase()] === undefined) {
      throw new Error(`Field type: ${fieldType.toLowerCase()} does not exists in fieldTypes map`)
    }
    return Types.fieldTypes[fieldType.toLowerCase()]
  }

  /**
   * This method create all the (basic) field types
   */
  static getAllFieldTypes(): TypeElement[] {
    return Object.values(Types.fieldTypes).map(type => {
      const fieldType = type.clone()
      fieldType.path = [MARKETO, TYPES_PATH, SUBTYPES_PATH, 'fieldTypes']
      return fieldType
    })
  }
}

const extractFields = (
  fields: (LeadAttribute | Field)[]
): Record<string, FieldDefinition> => Object.fromEntries(
  fields.map((field: LeadAttribute | Field) => {
    const name = isAttributeField(field) ? field.rest.name : field.name
    return [name, {
      refType: createRefToElmWithValue(Types.getFieldType(field.dataType)),
      annotations: {
        [NAME]: name,
        [API_NAME]: name,
        [DISPLAY_NAME]: field.displayName,
        [DATA_TYPE]: field.dataType,
      },
    }]
  })
)

export const createMarketoObjectType = (
  name: string,
  fields: LeadAttribute[]
): ObjectType => {
  const elemID = new ElemID(MARKETO, name)
  return new ObjectType({
    elemID,
    fields: extractFields(fields),
    path: [MARKETO, TYPES_PATH, elemID.name],
  })
}

export const createMarketoCustomObjectType = (
  customObjectResponse: CustomObjectResponse
): ObjectType => {
  const customObject = (customObjectResponse.approved
    ? customObjectResponse.approved
    : customObjectResponse.draft) as CustomObject
  const elemID = new ElemID(MARKETO, customObject.apiName)
  const objFileName = pathNaclCase(elemID.name)
  return new ObjectType({
    elemID,
    fields: extractFields(customObject.fields),
    path: [MARKETO, OBJECTS_PATH, objFileName],
    annotations: {
      [OBJECT_TYPE]: OBJECTS_NAMES.CUSTOM_OBJECT,
      [DISPLAY_NAME]: customObject.displayName,
      [PLURAL_NAME]: customObject.pluralName,
      [ID_FIELD]: customObject.idField,
      [API_NAME]: customObject.apiName,
      [DESCRIPTION]: customObject.description,
      [STATE]: customObjectResponse.state,
    },
  })
}

export const changeDataTypeToCustomObjectRequest = (change: ChangeDataType): Values => ({
  [API_NAME]: change.annotations[API_NAME],
  [DISPLAY_NAME]: change.annotations[DISPLAY_NAME],
  [PLURAL_NAME]: change.annotations[PLURAL_NAME],
  [DESCRIPTION]: change.annotations[DESCRIPTION],
  [SHOW_IN_LEAD_DETAIL]: change.annotations[SHOW_IN_LEAD_DETAIL],
})

export const changeDataTypeToCustomObjectFieldRequest = (change: ChangeDataType): Values => ({
  [NAME]: change.annotations[NAME],
  [DISPLAY_NAME]: change.annotations[DISPLAY_NAME],
  [DATA_TYPE]: change.annotations[DATA_TYPE],
  [DESCRIPTION]: change.annotations[DESCRIPTION] ?? '',
  [IS_DEDUPE_FIELD]: change.annotations[IS_DEDUPE_FIELD] ?? false,
})

export const createInstanceName = (
  name: string
): string => naclCase(name)

export const isCustomObject = (
  change: ChangeDataType
): boolean => change.annotations[OBJECT_TYPE] === OBJECTS_NAMES.CUSTOM_OBJECT

export const getLookUpName: GetLookupNameFunc = ({ ref }) =>
  ref.value

/**
 * Creating all the instance for specific type
 * @param marketoMetadata the instance metadata from marketo
 * @param type the objectType
 */
export const createMarketoInstanceElement = (
  marketoMetadata: MarketoMetadata,
  type: ObjectType
): InstanceElement => {
  const typeName = type.elemID.name
  const instanceName = createInstanceName(marketoMetadata.name)
  return new InstanceElement(
    new ElemID(MARKETO, instanceName).name,
    type,
    marketoMetadata as Values,
    [MARKETO, RECORDS_PATH, typeName, instanceName],
  )
}
