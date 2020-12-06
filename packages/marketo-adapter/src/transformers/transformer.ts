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
import { ElemID, InstanceElement, ObjectType, PrimitiveType, PrimitiveTypes, TypeElement, TypeMap, Values, ReferenceExpression } from '@salto-io/adapter-api'
import { GetLookupNameFunc, naclCase } from '@salto-io/adapter-utils'
import { LeadAttribute, Field, MarketoMetadata } from '../client/types'
import { FIELD_TYPES, MARKETO, SUBTYPES_PATH, TYPES_PATH, RECORDS_PATH } from '../constants'

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

export const createMarketoObjectType = (
  name: string,
  fields: (LeadAttribute | Field)[]
): ObjectType => {
  // TODO: use the ElemIdGetter functionality
  const elemID = new ElemID(MARKETO, name)
  const fieldsDefinition = Object.fromEntries(
    fields.map((field: LeadAttribute | Field) => {
      const fieldType = Types.getFieldType(field.dataType)
      return [isAttributeField(field) ? field.rest.name : field.name, {
        refType: new ReferenceExpression(fieldType.elemID, fieldType),
        annotations: field,
      }]
    })
  )
  return new ObjectType({
    elemID,
    fields: fieldsDefinition,
    path: [MARKETO, TYPES_PATH, elemID.name],
  })
}

export const createInstanceName = (
  name: string
): string => naclCase(name)

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
  const instanceName = createInstanceName(marketoMetadata.name.toString())
  return new InstanceElement(
    new ElemID(MARKETO, instanceName).name,
    type,
    marketoMetadata as Values,
    [MARKETO, RECORDS_PATH, typeName, instanceName],
  )
}
