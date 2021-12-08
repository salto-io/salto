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
import { ElemID, ObjectType, BuiltinTypes, CORE_ANNOTATIONS,
  FieldDefinition, ListType, RestrictionAnnotationType } from '@salto-io/adapter-api'
import { types } from '@salto-io/lowerdash'
import { findDuplicates } from './validation_utils'
import { getConfigWithDefault, TypeConfig, TypeDefaultsConfig } from './shared'

export const DATA_FIELD_ENTIRE_OBJECT = '.'

export type StandaloneFieldConfigType = {
  fieldName: string
  parseJSON?: boolean
}
type FieldToAdjustType = {
  fieldName: string
  fieldType?: string
}
export type FieldToOmitType = FieldToAdjustType
export type FieldToHideType = FieldToAdjustType
export type FieldTypeOverrideType = {
  fieldName: string
  fieldType: string
  restrictions?: RestrictionAnnotationType
}

export type TransformationConfig = {
  // explicitly set types for fields that are not generated correctly
  // (due to errors in the swagger / inaccurate response data)
  fieldTypeOverrides?: FieldTypeOverrideType[]

  // fields whose concatenated values will define the name part of the instance elem IDs
  idFields?: string[]
  fileNameFields?: string[]
  // fields whose values will be omitted if they are of the specified type
  fieldsToOmit?: FieldToOmitType[]
  // fields whose values are env-specific and should be hidden
  // *WARNING*: this should be used carefully - it can cause workspace
  // errors when used on types that exist inside arrays, since the merge between the state
  // element and the workspace element will result in duplicates
  fieldsToHide?: FieldToHideType[]
  // fields to convert into their instances (and reference from the parent)
  standaloneFields?: StandaloneFieldConfigType[]

  // set '.' to indicate that the full object should be returned
  dataField?: string
}

export type TransformationDefaultConfig = types.PickyRequired<Partial<TransformationConfig>, 'idFields'>

export const createTransformationConfigTypes = (
  adapter: string,
  additionalFields?: Record<string, FieldDefinition>,
): { transformation: ObjectType; transformationDefault: ObjectType } => {
  const standaloneFieldConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'standaloneFieldConfig'),
    fields: {
      fieldName: { refType: BuiltinTypes.STRING },
      parseJSON: { refType: BuiltinTypes.BOOLEAN },
    },
  })

  const fieldToAdjustConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'fieldToAdjustConfig'),
    fields: {
      fieldName: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      fieldType: { refType: BuiltinTypes.STRING },
    },
  })
  const fieldTypeOverrideConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'fieldTypeOverrideConfig'),
    fields: {
      fieldName: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      fieldType: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
    },
  })

  const sharedTransformationFields: Record<string, FieldDefinition> = {
    fieldTypeOverrides: {
      refType: new ListType(fieldTypeOverrideConfigType),
    },
    fieldsToOmit: {
      refType: new ListType(fieldToAdjustConfigType),
    },
    fieldsToHide: {
      refType: new ListType(fieldToAdjustConfigType),
    },
    standaloneFields: {
      refType: new ListType(standaloneFieldConfigType),
    },
    dataField: {
      refType: BuiltinTypes.STRING,
    },
    fileNameFields: {
      refType: new ListType(BuiltinTypes.STRING),
    },
    ...additionalFields,
  }
  const transformationConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'transformationConfig'),
    fields: {
      idFields: { refType: new ListType(BuiltinTypes.STRING) },
      ...sharedTransformationFields,
    },
  })

  const transformationDefaultConfigType = new ObjectType({
    elemID: new ElemID(adapter, 'transformationDefaultConfig'),
    fields: {
      idFields: {
        refType: new ListType(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      ...sharedTransformationFields,
    },
  })

  return {
    transformation: transformationConfigType,
    transformationDefault: transformationDefaultConfigType,
  }
}

export const validateTransoformationConfig = (
  configPath: string,
  defaultConfig: TransformationDefaultConfig,
  configMap: Record<string, TransformationConfig>
): void => {
  const findNestedFieldDups = (
    fieldName: string,
    defaultConfigEntries: { fieldName: string }[] | undefined,
    configEntriesMap: Record<string, { fieldName: string }[] | undefined>,
  ): void => {
    if (defaultConfigEntries !== undefined) {
      const duplicates = findDuplicates(defaultConfigEntries.map(def => def.fieldName))
      if (duplicates.length > 0) {
        throw new Error(`Duplicate ${fieldName} params found in ${configPath} default config: ${duplicates}`)
      }
    }
    const duplicates = (Object.entries(configEntriesMap)
      .filter(([_typeName, config]) => config !== undefined)
      .map(([typeName, config]) => ({
        typeName,
        dups: findDuplicates((config ?? []).map(def => def.fieldName)),
      }))
      .filter(({ dups }) => dups.length > 0)
    )
    if (duplicates.length > 0) {
      throw new Error(`Duplicate ${fieldName} params found in ${configPath} for the following types: ${duplicates.map(d => d.typeName)}`)
    }
  }

  findNestedFieldDups(
    'fieldTypeOverrides',
    defaultConfig.fieldTypeOverrides,
    _.mapValues(configMap, c => c.fieldTypeOverrides),
  )
  findNestedFieldDups(
    'fieldsToOmit',
    defaultConfig.fieldsToOmit,
    _.mapValues(configMap, c => c.fieldsToOmit),
  )
  findNestedFieldDups(
    'fieldsToHide',
    defaultConfig.fieldsToHide,
    _.mapValues(configMap, c => c.fieldsToHide),
  )
  findNestedFieldDups(
    'standaloneFields',
    defaultConfig.standaloneFields,
    _.mapValues(configMap, c => c.standaloneFields),
  )
}

export const getTypeTransformationConfig = (
  typeName: string,
  typeConfig: Record<string, TypeConfig>,
  typeDefaultConfig: TypeDefaultsConfig
): TransformationConfig => (
  getConfigWithDefault(
    typeConfig[typeName]?.transformation,
    typeDefaultConfig.transformation,
  )
)
