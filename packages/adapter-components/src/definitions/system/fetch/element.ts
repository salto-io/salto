/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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

type IDPartsDefinition<TCustomNameMappingOptions extends string = never> = {
  parts?: FieldIDPart<TCustomNameMappingOptions>[]
  // the delimiter to use between parts - default is '_'
  delimiter?: string
  // elem id: default - true when parent annotation exists?
  // path: when id parts info is missing, inherited from elemID (but the values are path-nacl-cased)
  extendsParent?: boolean
}

export type ElemIDDefinition<TCustomNameMappingOptions extends string = never> =
  IDPartsDefinition<TCustomNameMappingOptions> & {
    // This is a temporary flag to support double nacl case for upgrading existing services to the new definitions
    // https://salto-io.atlassian.net/browse/SALTO-5743
    useOldFormat?: boolean
  }

export type PathDefinition<TCustomNameMappingOptions extends string = never> = {
  pathParts?: IDPartsDefinition<TCustomNameMappingOptions>[]
  // allow adding hard coded baseDir for path that will be added before the type name
  baseDir?: string[]
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
type SortFieldDefinition = {
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

  // when true, empty arrays in instance values will not be omitted
  allowEmptyArrays?: boolean
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
