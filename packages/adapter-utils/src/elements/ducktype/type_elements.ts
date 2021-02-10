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
import _ from 'lodash'
import {
  ObjectType, ElemID, BuiltinTypes, Values, MapType, PrimitiveType, ListType, isObjectType,
} from '@salto-io/adapter-api'
import { pathNaclCase, naclCase } from '../../nacl_case_utils'
import { TYPES_PATH, SUBTYPES_PATH } from '../constants'

const ID_SEPARATOR = '__'

export const toNestedTypeName = (parentName: string, nestedTypeName: string): string => (
  `${parentName}${ID_SEPARATOR}${nestedTypeName}`
)

type ObjectTypeWithNestedTypes = {
  type: ObjectType
  nestedTypes: ObjectType[]
}

type NestedTypeWithNestedTypes = {
  type: ObjectType | ListType | PrimitiveType
  nestedTypes: ObjectType[]
}

const generateNestedType = ({ adapterName, typeName, parentName, entries, hasDynamicFields }: {
  adapterName: string
  typeName: string
  parentName: string
  entries: Values[]
  hasDynamicFields: boolean
}): NestedTypeWithNestedTypes => {
  const validEntries = entries.filter(entry => entry !== undefined && entry !== null)
  const name = toNestedTypeName(parentName, typeName)
  if (validEntries.length > 0) {
    if (validEntries.every(entry => Array.isArray(entry))) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      const nestedType = generateNestedType({
        adapterName,
        typeName,
        parentName,
        entries: validEntries.flat(),
        hasDynamicFields,
      })
      return {
        type: new ListType(nestedType.type),
        nestedTypes: (isObjectType(nestedType.type)
          ? [nestedType.type, ...nestedType.nestedTypes]
          : nestedType.nestedTypes),
      }
    }

    if (validEntries.every(entry => _.isObjectLike(entry))) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      return generateType({
        adapterName,
        name,
        entries: validEntries,
        hasDynamicFields,
        isSubType: true,
      })
    }

    // primitive types
    if (validEntries.every(entry => _.isString(entry))) {
      return {
        type: BuiltinTypes.STRING,
        nestedTypes: [],
      }
    }
    if (validEntries.every(entry => _.isFinite(entry))) {
      return {
        type: BuiltinTypes.NUMBER,
        nestedTypes: [],
      }
    }
    if (validEntries.every(entry => _.isBoolean(entry))) {
      return {
        type: BuiltinTypes.BOOLEAN,
        nestedTypes: [],
      }
    }
  }

  return {
    type: BuiltinTypes.UNKNOWN,
    nestedTypes: [],
  }
}

/**
 * Generate a synthetic type based on the list of all entries found for this type:
 * The type's fields are a superset of the fields that are found in at least one entry.
 *
 * Field types are determined recursively, as long as they are consistent across all entries:
 * - If all values for 'name' are strings, its type will be string.
 * - If one is string and one is number, or if no non-empty values were found, it will be unknown.
 * - If the values are objects / lists, a nested type will be generated and the same algorithm will
 *    run on each of its fields.
 * - Special case: If the field is marked as hasDynamicFields - meaning, the fields are keys in
 *    a map object - then we generate a 'value' field with map type, and re-run the algorithm on
 *    its nested values.
 */
export const generateType = ({
  adapterName,
  name,
  entries,
  hasDynamicFields,
  isSubType = false,
}: {
  adapterName: string
  name: string
  entries: Values[]
  hasDynamicFields: boolean
  isSubType?: boolean
}): ObjectTypeWithNestedTypes => {
  const naclName = naclCase(name)
  const path = [
    adapterName, TYPES_PATH,
    ...(isSubType
      ? [SUBTYPES_PATH, ...naclName.split(ID_SEPARATOR).map(pathNaclCase)]
      : [pathNaclCase(naclName)])]

  const nestedTypes: ObjectType[] = []
  const addNestedType = (
    typeWithNested: NestedTypeWithNestedTypes
  ): ObjectType | ListType | PrimitiveType => {
    if (isObjectType(typeWithNested.type)) {
      nestedTypes.push(typeWithNested.type)
    }
    nestedTypes.push(...typeWithNested.nestedTypes)
    return typeWithNested.type
  }

  const fields = hasDynamicFields
    ? {
      value: {
        type: new MapType(addNestedType(generateNestedType({
          adapterName,
          typeName: 'value',
          parentName: name,
          entries: entries.flatMap(Object.values).filter(entry => entry !== undefined),
          hasDynamicFields: false,
        }))),
      },
    }
    : Object.fromEntries(
      _.uniq(entries.flatMap(e => Object.keys(e)))
        .map(fieldName => [
          fieldName,
          {
            type: addNestedType(generateNestedType({
              adapterName,
              typeName: fieldName,
              parentName: name,
              entries: entries.map(entry => entry[fieldName]).filter(entry => entry !== undefined),
              hasDynamicFields: false,
            })),
          },
        ])
    )

  const type = new ObjectType({
    elemID: new ElemID(adapterName, naclName),
    fields,
    path,
  })

  return { type, nestedTypes }
}
