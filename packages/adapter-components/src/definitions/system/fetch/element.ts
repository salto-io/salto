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
import { types } from '@salto-io/lowerdash'
import { ElemID, ElemIdGetter, InstanceElement, ObjectType, RestrictionAnnotationType, SaltoError, Values } from '@salto-io/adapter-api'
import { NameMappingOptions } from '../shared'
import { ConfigChangeSuggestion } from '../../../config' // TODON move
import { ArgsWithCustomizer } from '../shared/types'
// eslint-disable-next-line import/no-cycle
import { GenerateTypeArgs } from './types'

export type FieldIDPart = ArgsWithCustomizer<
  string | undefined,
  {
    fieldName: string
    condition?: (value: Values) => boolean
    mapping?: NameMappingOptions
    // when true, the elem ids are re-calculated after all references have been generated
    // TODO see if can change the default to always re-generate all elem ids at the end of the fetch, except
    // where explicitly specified otherwise
    isReference?: boolean
  },
  Values
>

export type IDPartsDefinition = {
  // extendsDefault?: boolean, // when true, also include the "default" id fields? doesn't seem needed
  parts?: FieldIDPart[]
  // the delimiter to use between parts - default is '_'
  delimiter?: string
}

export type ElemIDDefinition = IDPartsDefinition & {
  // default - true when parent annotation exists?
  // TODO check if still needed
  extendsParent?: boolean
}

export type PathDefinition = {
  // when id parts info is missing, inherited from elemID (but the values are path-nacl-cased)
  pathParts?: IDPartsDefinition[]
}

type StandaloneFieldDefinition = {
  typeName: string
  // add parent annotation on child, default true
  addParentAnnotation?: boolean
  // whether to replace the original value in the parent with a reference to the newly-created child instance
  // defaults to true. when false, the original field is omitted
  referenceFromParent?: boolean
  // when true, standalone fields' path is <account>/Records/<parent path>/<standalone field name>/<child path>
  // when false, the path is <account>/Records/<child type name>/<child path>
  nestPathUnderParent?: boolean
}

// TODO add safeties (e.g. standalone.referencFromParent means omit)
export type ElementFieldCustomization = types.XOR<
  {
    fieldType?: string // TODON also convert to service id? so should do before the service id marker
    hide?: boolean
    standalone?: StandaloneFieldDefinition
    restrictions?: RestrictionAnnotationType
  },
  types.OneOf<{
    // omit the field
    omit: true
    // set the field to a map and determine its inner type dynamically.
    // the type is determined dynamically, since if the inner type is known, fieldType can be used instead.
    // note: will not work if a predefined type is provided
    isMapWithDynamicType: true
  }>
>

export type ElementsAndErrors = {
  instances: InstanceElement[]
  types: ObjectType[]
  // by default, types are re-generated once all instances have been created,
  // in order to avoid having the same type defined in different ways based on partial information.
  // if this should not be done, set this to true.
  typesAreFinal?: boolean
  errors?: SaltoError[]
  configSuggestions?: ConfigChangeSuggestion[]
}

export type ElemIDCreatorArgs = {
  elemIDDef: ElemIDDefinition
  getElemIdFunc?: ElemIdGetter
  serviceIDDef?: string[]
  typeID: ElemID
  singleton?: boolean
}

type FetchTopLevelElementDefinition<TVal extends Values = Values> = {
  isTopLevel: true

  // eslint-disable-next-line no-use-before-define
  custom?: ((args: Partial<ElementFetchDefinition<TVal>>) =>
      (input: GenerateTypeArgs) => ElementsAndErrors)

  // the type should have exactly one instance, and it will use the settings instance name.
  // note: when set, the elemID is ignored.
  singleton?: boolean
  elemID?: ArgsWithCustomizer<
    string,
    ElemIDDefinition,
    {
      entry: Values
      defaultName: string
      parentName?: string
    },
    ElemIDCreatorArgs
  >
  path?: PathDefinition

  // customize the service-url annotation used to define go-to-service
  // TODO use
  serviceUrl?: ArgsWithCustomizer<string, { path: string }, Values>

  // when true, instances of this type will be hidden (_hidden_value = true on type)
  hide?: boolean

  // guard for validating the value is as expected.
  // when missing, we validate that this is a plain object
  valueGuard?: (val: unknown) => val is TVal

  // TODO add:
  // alias, important attributes
}

export type ElementFetchDefinition<TVal extends Values = Values> = {
  // the topLevel definition should be specified for types that have instances, and should not be specified for subtypes
  topLevel?: FetchTopLevelElementDefinition<TVal>

  // customize field definitions
  fieldCustomizations?: Record<string, ElementFieldCustomization>
  // when true, use only the type's fieldCustomizations without extending default definitions for field customizations
  ignoreDefaultFieldCustomizations?: boolean

  // use to rename an auto-generated typename to a more presentable name (sourceTypeName is the original name to update)
  sourceTypeName?: string
}
