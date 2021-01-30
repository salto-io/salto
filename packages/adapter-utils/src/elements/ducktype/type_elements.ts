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
import { TYPES_PATH, SUBTYPES_PATH, NAMESPACE_SEPARATOR } from '../constants'

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
  // TODO use better separator to avoid edge cases?
  const name = `${parentName}${NAMESPACE_SEPARATOR}${typeName}`
  if (entries.length > 0) {
    if (entries.every(entry => Array.isArray(entry))) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      const nestedType = generateNestedType({
        adapterName,
        typeName,
        parentName,
        entries: entries.flat(),
        hasDynamicFields,
      })
      return {
        type: new ListType(nestedType.type),
        nestedTypes: (isObjectType(nestedType.type)
          ? [nestedType.type, ...nestedType.nestedTypes]
          : nestedType.nestedTypes),
      }
    }

    if (entries.every(entry => _.isObjectLike(entry))) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      return generateType({ adapterName, name, entries, hasDynamicFields, isSubType: true })
    }

    // primitive types
    if (entries.every(entry => _.isString(entry))) {
      return {
        type: BuiltinTypes.STRING,
        nestedTypes: [],
      }
    }
    if (entries.every(entry => _.isFinite(entry))) {
      return {
        type: BuiltinTypes.NUMBER,
        nestedTypes: [],
      }
    }
    if (entries.every(entry => _.isBoolean(entry))) {
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
      ? [SUBTYPES_PATH, ...naclName.split(NAMESPACE_SEPARATOR).map(pathNaclCase)]
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
