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
import { BuiltinTypes, CORE_ANNOTATIONS, createRefToElmWithValue, createRestriction, Field, ObjectType, TypeElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FieldTypeOverrideType } from '../config/transformation'
import { getTypeTransformationConfig, TypeConfig, TypeDefaultsConfig } from '../config/shared'

const log = logger(module)

export const fixFieldTypes = (
  definedTypes: Record<string, ObjectType>,
  typeConfig: Record<string, TypeConfig>,
  typeDefaultConfig: TypeDefaultsConfig,
  fieldTypeNameToType?: (typeName: string) => TypeElement,
): void => {
  const primitiveTypes = Object.fromEntries(
    [BuiltinTypes.STRING, BuiltinTypes.BOOLEAN, BuiltinTypes.NUMBER]
      .map(e => [e.elemID.getFullName(), e])
  )
  Object.keys(typeConfig)
    .filter(typeName =>
      getTypeTransformationConfig(typeName, typeConfig, typeDefaultConfig)
        .fieldTypeOverrides !== undefined)
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
        const newFieldType = fieldTypeNameToType
          ? fieldTypeNameToType(fieldType)
          : (definedTypes[fieldType] || primitiveTypes[fieldType])
        const annotations = restrictions ? {
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction(restrictions),
        } : {}
        if (field === undefined) {
          log.debug('Creating field type for %s.%s with type %s', typeName, fieldName, newFieldType.elemID.name)
          type.fields[fieldName] = new Field(type, fieldName, newFieldType, annotations)
        } else {
          log.debug(
            'Modifying field type for %s.%s from %s to %s',
            typeName, fieldName, field.refType.elemID.name, newFieldType.elemID.name
          )
          field.refType = createRefToElmWithValue(newFieldType)
          field.annotations = { ...field.annotations, ...annotations }
        }
      })
    })
}
