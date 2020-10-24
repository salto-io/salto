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
import _ from 'lodash'
import {
  ElemID, FieldDefinition,
  InstanceElement,
  ObjectType,
  PrimitiveType,
  PrimitiveTypes, TypeElement,
  TypeMap,
  Values,
} from '@salto-io/adapter-api'
import { GetLookupNameFunc, naclCase } from '@salto-io/adapter-utils'
import { Attribute, CustomObject, Field, MarketoMetadata } from '../client/types'
import { FIELD_TYPES, MARKETO, OBJECTS_NAMES, SUBTYPES_PATH, TYPES_PATH, RECORDS_PATH } from '../constants'
import MarketoClient from '../client/client'


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
    return Types.fieldTypes[fieldType.toLowerCase()]
      ?? Types.fieldTypes[FIELD_TYPES.STRING]
  }

  /**
   * This method create all the (basic) field types
   */
  static getAllFieldTypes(): TypeElement[] {
    return _.concat(
      Object.values(Types.fieldTypes),
    ).map(type => {
      const fieldType = type.clone()
      fieldType.path = [MARKETO, TYPES_PATH, SUBTYPES_PATH, 'field_types']
      return fieldType
    })
  }

  static async getAllMarketoObjects(client: MarketoClient):
    Promise<ObjectType[]> {
    const describe = async (type: string): Promise<Attribute[]> =>
      client.describe<Attribute[]>(type)

    const customObjectObjectType = async (type: string): Promise<ObjectType[]> => {
      const customObjectsMetadata = await client.getAllInstances<CustomObject[]>(type)
      if (_.isUndefined(customObjectsMetadata)) return []

      const customObjects = await Promise.all(
        customObjectsMetadata
          .map((customObject: CustomObject) =>
            client.describe<CustomObject>(type,
              { qs: { name: customObject.name } }))
      )

      return _.flatten(customObjects).map((co: CustomObject) => {
        const elemID = new ElemID(MARKETO, co.name.toLowerCase())
        const fields: Record<string, FieldDefinition> = {}
        co.fields.forEach((field: Field) => {
          fields[field.name] = {
            type: Types.getFieldType(field.dataType),
            annotations: field,
          }
        })

        return new ObjectType({
          elemID,
          fields,
          path: [MARKETO, SUBTYPES_PATH, elemID.name],
        })
      })
    }

    const objectType = async (type: string): Promise<ObjectType> => {
      const elemID = new ElemID(MARKETO, type.toLowerCase())
      const fields: Record<string, FieldDefinition> = {}
      const attributes = await describe(type)
      attributes.forEach((field: Attribute) => {
        fields[field.rest.name] = {
          type: Types.getFieldType(field.dataType),
          annotations: field,
        }
      })

      return new ObjectType({
        elemID,
        fields,
        path: [MARKETO, TYPES_PATH, elemID.name],
      })
    }

    const createObjectType = async (type: string): Promise<ObjectType | ObjectType[]> => {
      switch (type) {
        case OBJECTS_NAMES.CUSTOM_OBJECTS:
          return customObjectObjectType(type)
        case OBJECTS_NAMES.OPPORTUNITY:
          // TODO(Guy): Implement
          return []
        default:
          return objectType(type)
      }
    }

    return _.flatten(await Promise.all(_.map(_.values(OBJECTS_NAMES), createObjectType)))
  }
}

export const createInstanceName = (
  name: string
): string => naclCase(name.trim())

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
