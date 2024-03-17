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
import _ from 'lodash'
import {
  isObjectType,
  ObjectType,
  ListType,
  BuiltinTypes,
  TypeElement,
  MapType,
  FieldDefinition,
  ElemID,
  isListType,
  CORE_ANNOTATIONS,
  Values,
} from '@salto-io/adapter-api'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { types as lowerdashTypes } from '@salto-io/lowerdash'
import { NestedTypeWithNestedTypes, ObjectTypeWithNestedTypes } from '../types'
import { SUBTYPES_PATH, TYPES_PATH } from '../../elements/constants'
import { ARRAY_ITEMS_FIELD } from '../../elements/swagger/type_elements/swagger_parser'
import { computeTypesToRename, toNestedTypeName, NESTING_SEPARATOR } from './type_utils'
import { GenerateTypeArgs } from '../../definitions/system/fetch/types'
import { FetchApiDefinitionsOptions } from '../../definitions/system/fetch'

const log = logger(module)

const generateNestedType = <Options extends FetchApiDefinitionsOptions>(
  args: lowerdashTypes.PickyRequired<GenerateTypeArgs<Options>, 'parentName'>,
): NestedTypeWithNestedTypes => {
  const { typeName, parentName, entries, isUnknownEntry, isMapWithDynamicType } = args

  const validEntries = entries.filter(entry => entry !== undefined && entry !== null)

  if (validEntries.length === 0) {
    return {
      type: BuiltinTypes.UNKNOWN,
      nestedTypes: [],
    }
  }

  if (isUnknownEntry !== undefined && validEntries.some(isUnknownEntry)) {
    return {
      type: BuiltinTypes.UNKNOWN,
      nestedTypes: [],
    }
  }
  if (validEntries.every(entry => Array.isArray(entry))) {
    const nestedType = generateNestedType({
      ...args,
      entries: validEntries.flat(),
    })
    return {
      type: new ListType(nestedType.type),
      nestedTypes: isObjectType(nestedType.type)
        ? [nestedType.type, ...nestedType.nestedTypes]
        : nestedType.nestedTypes,
    }
  }
  if (isMapWithDynamicType) {
    const nestedType = generateNestedType({
      ...args,
      entries: validEntries.flatMap(entry => Object.values(entry)),
      isMapWithDynamicType: false,
    })
    return {
      type: new MapType(nestedType.type),
      nestedTypes: isObjectType(nestedType.type)
        ? [nestedType.type, ...nestedType.nestedTypes]
        : nestedType.nestedTypes,
    }
  }

  if (validEntries.every(entry => _.isObjectLike(entry))) {
    // eslint-disable-next-line no-use-before-define
    return generateType({
      ...args,
      typeName: toNestedTypeName(parentName, typeName),
      entries: validEntries,
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

  return {
    type: BuiltinTypes.UNKNOWN,
    nestedTypes: [],
  }
}

const isItemsOnlyObjectType = (type: ObjectType): boolean => _.isEqual(Object.keys(type.fields), [ARRAY_ITEMS_FIELD])

const normalizeType = (type: ObjectType): ObjectType => {
  if (type !== undefined && isItemsOnlyObjectType(type)) {
    const itemsType = type.fields.items.getTypeSync()
    if (isListType(itemsType)) {
      const innerType = itemsType.getInnerTypeSync()
      if (isObjectType(innerType)) {
        return innerType
      }
    }
  }
  return type
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
 * - Special case: If the field is marked as isMapWithDynamicType - meaning, the fields are keys in
 *    a map object - then we re-run the algorithm on its nested values.
 *
 * Note: field customizations should be applied separately, once all types have been created
 */
export const generateType = <Options extends FetchApiDefinitionsOptions>(
  args: Omit<GenerateTypeArgs<Options>, 'parentName' | 'isMapWithDynamicType' | 'customNameMappingOptions'>,
): ObjectTypeWithNestedTypes => {
  const {
    adapterName,
    defQuery,
    typeName: originalTypeName,
    definedTypes,
    entries,
    typeNameOverrides,
    isSubType = false,
  } = args

  // TODO if a type is both explicitly renamed and appears as a standalone type, warn
  const typesToRename = computeTypesToRename({ defQuery, typeNameOverrides })
  const typeName = typesToRename[originalTypeName] ?? originalTypeName

  const { element: elementDef } = defQuery.query(typeName) ?? {}
  if (elementDef === undefined) {
    log.debug('could not find any element definitions for type %s', typeName)
  }
  if (elementDef?.topLevel?.custom !== undefined) {
    log.info('found custom override for type %s:%s, using it to generate types', adapterName, typeName)
    const { types } = elementDef?.topLevel?.custom(elementDef)(args)
    const [type, nestedTypes] = _.partition(types, t => t.elemID.typeName === typeName)
    return { type: type[0], nestedTypes }
  }

  const predefinedType = definedTypes?.[typeName]
  if (predefinedType !== undefined) {
    log.debug('found type %s for adapter %s in pre-generated object types, returning as-is', typeName, adapterName)
    const type = normalizeType(predefinedType)
    return { type, nestedTypes: [] }
  }

  const naclName = naclCase(typeName)
  const path = [
    adapterName,
    TYPES_PATH,
    ...(isSubType ? [SUBTYPES_PATH, ...naclName.split(NESTING_SEPARATOR).map(pathNaclCase)] : [pathNaclCase(naclName)]),
  ]

  const nestedTypes: ObjectType[] = []
  const addNestedType = (typeWithNested: NestedTypeWithNestedTypes): TypeElement => {
    if (isObjectType(typeWithNested.type)) {
      nestedTypes.push(typeWithNested.type)
    }
    nestedTypes.push(...typeWithNested.nestedTypes)
    return typeWithNested.type
  }

  const fields: Record<string, FieldDefinition> = Object.fromEntries(
    _.uniq(entries.flatMap(e => Object.keys(e))).map(key => {
      const fieldName = naclCase(key)
      return [
        fieldName,
        {
          refType: addNestedType(
            generateNestedType({
              ...args,
              typeName: fieldName,
              parentName: typeName,
              entries: entries.map(entry => entry[fieldName]).filter(entry => entry !== undefined),
              typeNameOverrides: typesToRename,
              isMapWithDynamicType: elementDef?.fieldCustomizations?.[fieldName]?.isMapWithDynamicType,
            }),
          ),
        },
      ]
    }),
  )

  const { topLevel } = elementDef ?? {}
  const { hide, singleton, importantValues } = topLevel ?? {}
  const getAnnotations = (): Values | undefined => {
    if (!hide && importantValues === undefined) {
      return undefined
    }
    const annotations: Values = {}
    if (hide) {
      annotations[CORE_ANNOTATIONS.HIDDEN_VALUE] = true
    }
    if (importantValues !== undefined) {
      annotations[CORE_ANNOTATIONS.IMPORTANT_VALUES] = importantValues
    }
    return annotations
  }

  const type = new ObjectType({
    elemID: new ElemID(adapterName, naclName),
    fields,
    path,
    isSettings: singleton ?? false,
    annotations: getAnnotations(),
  })

  return { type, nestedTypes }
}
