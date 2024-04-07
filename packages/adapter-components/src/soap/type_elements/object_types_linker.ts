/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { BuiltinTypes, Field, ListType, ObjectType, PrimitiveType } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { UnresolvedField, UnresolvedType } from './complex_types_converter'

const log = logger(module)

const PRIMITIVE_TYPES: Record<string, PrimitiveType> = {
  'http://www.w3.org/2001/XMLSchema|boolean': BuiltinTypes.BOOLEAN,
  'http://www.w3.org/2001/XMLSchema|decimal': BuiltinTypes.NUMBER,
  'http://www.w3.org/2001/XMLSchema|double': BuiltinTypes.NUMBER,
  'http://www.w3.org/2001/XMLSchema|float': BuiltinTypes.NUMBER,
  'http://www.w3.org/2001/XMLSchema|int': BuiltinTypes.NUMBER,
  'http://www.w3.org/2001/XMLSchema|short': BuiltinTypes.NUMBER,
  'http://www.w3.org/2001/XMLSchema|long': BuiltinTypes.NUMBER,
  'http://www.w3.org/2001/XMLSchema|date': BuiltinTypes.STRING,
  'http://www.w3.org/2001/XMLSchema|dateTime': BuiltinTypes.STRING,
  'http://www.w3.org/2001/XMLSchema|dateTimeStamp': BuiltinTypes.STRING,
  'http://www.w3.org/2001/XMLSchema|dayTimeDuration': BuiltinTypes.STRING,
  'http://www.w3.org/2001/XMLSchema|string': BuiltinTypes.STRING,
  'http://www.w3.org/2001/XMLSchema|base64Binary': BuiltinTypes.STRING,
}

const getUnaliasedType = (type: string, typeAliases: Record<string, string>): string =>
  type in typeAliases ? getUnaliasedType(typeAliases[type], typeAliases) : type

const linkUnresolvedField = (
  field: UnresolvedField,
  objectType: ObjectType,
  typesMap: Record<string, UnresolvedType>,
  typeAliases: Record<string, string>,
): Field | undefined => {
  const unaliasedType = getUnaliasedType(field.type, typeAliases)
  let fieldType = PRIMITIVE_TYPES[unaliasedType] ?? typesMap[unaliasedType]?.objectType
  if (fieldType === undefined) {
    log.warn(`Did not find the type of field ${field.name} of type ${objectType.elemID.name}`)
    fieldType = BuiltinTypes.UNKNOWN
  }
  return (
    fieldType &&
    new Field(objectType, field.name, field.isList ? new ListType(fieldType) : fieldType, field.annotations)
  )
}

export const linkTypes = (types: UnresolvedType[], typeAliases: Record<string, string>): ObjectType[] => {
  const typesMap = _.keyBy(types, type =>
    type.namespace !== undefined ? `${type.namespace}|${type.objectType.elemID.name}` : type.objectType.elemID.name,
  )
  const linkedTypes = new Set<string>()

  const linkType = (type: UnresolvedType): ObjectType => {
    if (linkedTypes.has(type.objectType.elemID.getFullName())) {
      return type.objectType
    }

    const fields = type.fields
      .map(field => {
        if (field.resolveType === 'field') {
          return linkUnresolvedField(field, type.objectType, typesMap, typeAliases)
        }

        // If we got here, field is UnresolvedExtension so we need to replace it with all
        // the fields of the extended type. To do so, we need the extended type to be fully
        // linked so we make a recursive call to link the extended type
        return Object.values(linkType(typesMap[field.type]).fields)
      })
      .flat()
      .filter(values.isDefined)

    type.objectType.fields = _.keyBy(fields, field => field.name)
    linkedTypes.add(type.objectType.elemID.getFullName())
    return type.objectType
  }

  return types.map(linkType)
}
