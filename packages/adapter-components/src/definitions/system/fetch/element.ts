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
import {
  ElemID,
  ElemIdGetter,
  InstanceElement,
  ObjectType,
  RestrictionAnnotationType,
  SaltoError,
  Values,
} from '@salto-io/adapter-api'
import { ImportantValues } from '@salto-io/adapter-utils'
import { ConfigChangeSuggestion } from '../../user'
import { ArgsWithCustomizer } from '../shared/types'
// eslint-disable-next-line import/no-cycle
import { GenerateTypeArgs } from './types'
import { ResolveCustomNameMappingOptionsType } from '../api'
import { NameMappingFunctionMap, NameMappingOptions } from '../shared'
import { AliasData } from '../../../add_alias'

export type FieldIDPart<TCustomNameMappingOptions extends string = never> = ArgsWithCustomizer<
  string | undefined,
  {
    fieldName: string
    condition?: (value: Values) => boolean
    mapping?: TCustomNameMappingOptions | NameMappingOptions
    // when true, the elem ids are re-calculated after all references have been generated
    // TODO see if can change the default to always re-generate all elem ids at the end of the fetch, except
    // where explicitly specified otherwise (in SALTO-5421)
    isReference?: boolean
  },
  Values
>

export type IDPartsDefinition<TCustomNameMappingOptions extends string = never> = {
  parts?: FieldIDPart<TCustomNameMappingOptions>[]
  // the delimiter to use between parts - default is '_'
  delimiter?: string
}

export type ElemIDDefinition<TCustomNameMappingOptions extends string = never> =
  IDPartsDefinition<TCustomNameMappingOptions> & {
    // default - true when parent annotation exists?
    // TODO check if still needed when implementing SALTO-5421
    extendsParent?: boolean
    // This is a temporary flag to support double nacl case for upgrading existing services to the new definitions
    // https://salto-io.atlassian.net/browse/SALTO-5743
    useOldFormat?: boolean
  }

export type PathDefinition<TCustomNameMappingOptions extends string = never> = {
  // when id parts info is missing, inherited from elemID (but the values are path-nacl-cased)
  pathParts?: IDPartsDefinition<TCustomNameMappingOptions>[]
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
  // default false
  nestPathUnderParent?: boolean
}

export type PropertySortDefinition = {
  // A dot-separated path to a property in the list field.
  // Paths can include reference expressions, e.g. `'path.to.property.refToAnotherElement.id'`
  path: string
  order?: 'asc' | 'desc'
}

// Settings for sorting a list field.
export type SortFieldDefinition = {
  // The properties to sort the field by, in order of precedence.
  // Selected properties should be env-independent to avoid sorting differences between envs.
  properties: PropertySortDefinition[]
}

// TODO add safeties (e.g. standalone.referenceFromParent=false means omit)
export type ElementFieldCustomization = types.XOR<
  {
    fieldType?: string
    hide?: boolean
    standalone?: StandaloneFieldDefinition
    restrictions?: RestrictionAnnotationType
    sort?: SortFieldDefinition
  },
  types.OneOf<{
    // omit the field
    omit: boolean
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

export type ElemIDCreatorArgs<TCustomNameMappingOptions extends string = never> = {
  elemIDDef: ElemIDDefinition<TCustomNameMappingOptions>
  getElemIdFunc?: ElemIdGetter
  serviceIDDef?: string[]
  typeID: ElemID
  singleton?: boolean
  customNameMappingFunctions?: NameMappingFunctionMap<TCustomNameMappingOptions>
}

export type ElementFetchDefinitionOptions = {
  valueType?: Values
  customNameMappingOptions?: string
}

type ResolveValueType<Options extends Pick<ElementFetchDefinitionOptions, 'valueType'>> =
  Options['valueType'] extends Values ? Options['valueType'] : Values

export type FetchTopLevelElementDefinition<Options extends ElementFetchDefinitionOptions = {}> = {
  isTopLevel: true

  custom?: (
    // eslint-disable-next-line no-use-before-define
    args: Partial<ElementFetchDefinition<Options>>,
  ) => (input: GenerateTypeArgs<Options>) => ElementsAndErrors

  // the type should have exactly one instance, and it will use the settings instance name.
  // note: when set, the elemID definition is ignored
  singleton?: boolean

  elemID?: ArgsWithCustomizer<
    string,
    ElemIDDefinition<ResolveCustomNameMappingOptionsType<Options>>,
    {
      entry: Values
      defaultName: string
      parent?: InstanceElement
    },
    ElemIDCreatorArgs<ResolveCustomNameMappingOptionsType<Options>>
  >

  path?: PathDefinition<ResolveCustomNameMappingOptionsType<Options>>

  // customize the service-url annotation used to define go-to-service
  // baseUrl should be define in default and override in custom if needed
  serviceUrl?: ArgsWithCustomizer<
    string,
    {
      path: string
      baseUrl?: string
    },
    Values
  >

  // when true, instances of this type will be hidden (_hidden_value = true on type)
  hide?: boolean

  // guard for validating the value is as expected.
  // when missing, we validate that this is a plain object
  valueGuard?: (val: unknown) => val is ResolveValueType<Options>

  alias?: AliasData

  importantValues?: ImportantValues
}

export type ElementFetchDefinition<Options extends ElementFetchDefinitionOptions = {}> = {
  // the topLevel definition should be specified for types that have instances, and should not be specified for subtypes
  topLevel?: FetchTopLevelElementDefinition<Options>

  // customize field definitions
  fieldCustomizations?: Record<string, ElementFieldCustomization>
  // when true, use only the type's fieldCustomizations without extending default definitions for field customizations
  ignoreDefaultFieldCustomizations?: boolean

  // use to rename an auto-generated typename to a more presentable name (sourceTypeName is the original name to update)
  sourceTypeName?: string
}
