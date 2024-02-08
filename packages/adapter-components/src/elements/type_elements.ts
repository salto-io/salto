
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
import { Field, CORE_ANNOTATIONS, TypeElement, isObjectType, isContainerType,
  getDeepInnerType, ObjectType, BuiltinTypes, createRestriction, createRefToElmWithValue, PrimitiveType, ListType, MapType, isEqualElements } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { values, collections } from '@salto-io/lowerdash'
import { getSubtypes } from '@salto-io/adapter-utils'
import { FieldToHideType, FieldTypeOverrideType, getTypeTransformationConfig } from '../config/transformation'
import { SUBTYPES_PATH, TYPES_PATH } from './constants'
import { TypeConfig, TypeDefaultsConfig } from '../config/shared'
import { getContainerForType } from '../fetch/element/type_utils'

const { awu } = collections.asynciterable

const log = logger(module)

/**
 * Annotate fields with _hidden_value=true if they match the specified configuration.
 * Also add fields with _hidden_value=true if they are not defined in the type.
 */
export const hideFields = (
  fieldsToHide: FieldToHideType[],
  type: ObjectType,
): void => {
  const typeFields = type.fields
  fieldsToHide.forEach(({ fieldName, fieldType }) => {
    if (fieldType !== undefined
      && fieldType !== typeFields[fieldName]?.refType.elemID.name) {
      if (
        typeFields[fieldName] === undefined
      ) {
        log.debug(`Cannot hide field ${type.elemID.name}.${fieldName} - override type is ${fieldType} while field is not defined`)
      } else {
        log.warn(`Failed to hide field ${type.elemID.name}.${fieldName} - override type is ${fieldType} while type is ${typeFields[fieldName].refType.elemID.name}`)
      }
      return
    }
    if (!Object.prototype.hasOwnProperty.call(typeFields, fieldName)) {
      log.debug(`Creating hidden field ${type.elemID.name}.${fieldName} with type unknown`)
      typeFields[fieldName] = new Field(
        type,
        fieldName,
        BuiltinTypes.UNKNOWN,
      )
    }
    const field = typeFields[fieldName]
    log.debug(`Hiding values for field ${type.elemID.name}.${fieldName}`)
    field.annotations = {
      ...field.annotations,
      [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
    }
  })
}

export const filterTypes = async (
  adapterName: string,
  allTypes: TypeElement[],
  typesToFilter: string[]
): Promise<TypeElement[]> => {
  const nameToType = _.keyBy(allTypes, type => type.elemID.name)

  const relevantTypes = typesToFilter.map(name => {
    const type = nameToType[name]
    if (type === undefined) {
      log.warn(`Data type '${name}' of adapter ${adapterName} does not exist`)
    }
    return type
  }).filter(values.isDefined)

  relevantTypes
    .filter(t => t.path === undefined)
    .forEach(t => { t.path = [adapterName, TYPES_PATH, t.elemID.name] })

  const innerObjectTypes = await awu(relevantTypes)
    .filter(isContainerType)
    .map(async type => getDeepInnerType(type))
    .filter(isObjectType)
    .toArray()

  const subtypes = await getSubtypes([...relevantTypes.filter(isObjectType), ...innerObjectTypes])
  subtypes
    .filter(t => t.path === undefined)
    .forEach(t => { t.path = [adapterName, TYPES_PATH, SUBTYPES_PATH, t.elemID.name] })

  return [...relevantTypes, ...subtypes]
}

export const fixFieldTypes = (
  definedTypes: Record<string, ObjectType>,
  typeConfig: Record<string, TypeConfig>,
  typeDefaultConfig: TypeDefaultsConfig,
  toPrimitiveType: (val: string) => PrimitiveType
): void => {
  const toTypeWithContainers = (typeName: string): TypeElement => {
    const containerDetails = getContainerForType(typeName)
    if (containerDetails?.container === 'list') {
      return new ListType(toTypeWithContainers(containerDetails.typeNameSubstring))
    }
    if (containerDetails?.container === 'map') {
      return new MapType(toTypeWithContainers(containerDetails.typeNameSubstring))
    }
    const type = definedTypes[typeName] ?? toPrimitiveType(typeName)
    if (isEqualElements(type, BuiltinTypes.UNKNOWN) && typeName.toLowerCase() !== 'unknown') {
      log.warn('could not find type %s, falling back to unknown', typeName)
    }
    return type
  }

  Object.keys(typeConfig)
    .filter(typeName =>
      getTypeTransformationConfig(
        typeName, typeConfig, typeDefaultConfig
      ).fieldTypeOverrides !== undefined)
    .forEach(typeName => {
      const type = definedTypes[typeName]
      if (type === undefined) {
        log.warn('type %s not found, cannot override its field types', typeName)
        return
      }
      const fieldTypeOverrides = getTypeTransformationConfig(
        typeName, typeConfig, typeDefaultConfig,
      ).fieldTypeOverrides as FieldTypeOverrideType[]
      fieldTypeOverrides.forEach(({ fieldName, fieldType, restrictions }) => {
        const field = type.fields[fieldName]
        const newFieldType = toTypeWithContainers(fieldType)
        const annotations = restrictions ? {
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction(restrictions),
        } : {}
        if (field === undefined) {
          log.debug(
            'Creating field type for %s.%s with type %s with restrictions %o',
            typeName, fieldName, newFieldType.elemID.name, restrictions
          )
          type.fields[fieldName] = new Field(type, fieldName, newFieldType, annotations)
        } else {
          log.debug(
            'Modifying field type for %s.%s from %s to %s with restrictions %o',
            typeName, fieldName, field.refType.elemID.name, newFieldType.elemID.name, restrictions
          )
          field.refType = createRefToElmWithValue(newFieldType)
          field.annotations = { ...field.annotations, ...annotations }
        }
      })
    })
}
