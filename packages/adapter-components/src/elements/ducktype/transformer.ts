/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { Element, InstanceElement, isObjectType, Values, ObjectType, ElemIdGetter, SaltoError } from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { Paginator, ResponseValue, ClientGetWithPaginationParams } from '../../client'
import { generateType } from './type_elements'
import { toInstance } from './instance_elements'
import { TypeConfig, getConfigWithDefault, getTransformationConfigByType } from '../../config'
import { FindNestedFieldFunc } from '../field_finder'
import { TypeDuckTypeDefaultsConfig, TypeDuckTypeConfig, DuckTypeTransformationConfig, DuckTypeTransformationDefaultConfig } from '../../config/ducktype'
import { ComputeGetArgsFunc } from '../request_parameters'
import { ConfigChangeSuggestion, FetchElements, getElementsWithContext } from '../element_getter'
import { extractStandaloneFields } from './standalone_field_extractor'
import { shouldRecurseIntoEntry } from '../instance_elements'
import { addRemainingTypes } from './add_remaining_types'
import { ElementQuery } from '../query'

const { makeArray } = collections.array
const { toArrayAsync, awu } = collections.asynciterable
const { isDefined } = lowerdashValues
const log = logger(module)

export type EntriesRequester = (
  args: {
    paginator: Paginator
    args: ClientGetWithPaginationParams
    typeName: string
    typesConfig: Record<string, TypeDuckTypeConfig>
  }
) => Promise<ResponseValue[]>

type GetEntriesParams = {
  adapterName: string
  typeName: string
  paginator: Paginator
  nestedFieldFinder: FindNestedFieldFunc
  computeGetArgs: ComputeGetArgsFunc
  typesConfig: Record<string, TypeDuckTypeConfig>
  typeDefaultConfig: TypeDuckTypeDefaultsConfig
  contextElements?: Record<string, Element[]>
  requestContext?: Record<string, unknown>
  getElemIdFunc?: ElemIdGetter
  getEntriesResponseValuesFunc?: EntriesRequester
}

type Entries = {
  instances: InstanceElement[]
  type: ObjectType
  nestedTypes: ObjectType[]
}


export const getEntriesResponseValues: EntriesRequester = async ({
  paginator,
  args,
}): Promise<ResponseValue[]> => (
  (await toArrayAsync(
    paginator(args, page => makeArray(page) as ResponseValue[])
  )).flat()
)

export const getUniqueConfigSuggestions = (
  configSuggestions: ConfigChangeSuggestion[]
): ConfigChangeSuggestion[] => (_.uniqBy(configSuggestions, suggestion => suggestion.typeToExclude))

/**
 * Creates new type based on instances values,
 * then creates new instances pointing the new type
 */
export const getNewElementsFromInstances = ({
  adapterName,
  typeName,
  instances,
  transformationConfigByType,
  transformationDefaultConfig,
}: {
  adapterName: string
  typeName: string
  instances: InstanceElement[]
  transformationConfigByType: Record<string, DuckTypeTransformationConfig>
  transformationDefaultConfig: DuckTypeTransformationDefaultConfig
}): Entries => {
  const { hasDynamicFields } = getConfigWithDefault(transformationConfigByType[typeName], transformationDefaultConfig)

  const { type: newType, nestedTypes: newNestedTypes } = generateType({
    adapterName,
    name: typeName,
    entries: instances.map(inst => inst.value),
    hasDynamicFields: hasDynamicFields === true,
    transformationConfigByType,
    transformationDefaultConfig,
  })
  return {
    instances: instances.map(inst => new InstanceElement(
      inst.elemID.name, newType, inst.value, inst.path, inst.annotations
    )),
    type: newType,
    nestedTypes: newNestedTypes,
  }
}

const getEntriesForType = async (
  params: GetEntriesParams
): Promise<Entries> => {
  const {
    typeName, paginator, typesConfig, typeDefaultConfig, contextElements,
    requestContext, nestedFieldFinder, computeGetArgs, adapterName, getElemIdFunc,
    getEntriesResponseValuesFunc,
  } = params
  const typeConfig = typesConfig[typeName]
  if (typeConfig === undefined) {
    // should never happen
    throw new Error(`could not find type ${typeName}`)
  }
  const { request, transformation } = typeConfig
  if (request === undefined) {
    // a type with no request config cannot be fetched
    throw new Error(`Invalid type config - type ${adapterName}.${typeName} has no request config`)
  }

  const {
    fieldsToOmit, hasDynamicFields, dataField,
  } = getConfigWithDefault(transformation, typeDefaultConfig.transformation)

  const requestWithDefaults = getConfigWithDefault(request, typeDefaultConfig.request ?? {})

  const getEntries = async (context: Values | undefined): Promise<Values[]> => {
    const getArgs = computeGetArgs(requestWithDefaults, contextElements, context)
    return (await Promise.all(
      getArgs.map(async args => (
        getEntriesResponseValuesFunc
          ? getEntriesResponseValuesFunc({ paginator, args, typeName, typesConfig })
          : getEntriesResponseValues({ paginator, args, typeName, typesConfig })
      ))
    )).flat()
  }
  const entriesValues = (await getEntries(requestContext))
    // escape "field" names that contain '.'
    .map(values => _.mapKeys(values, (_val, key) => naclCase(key)))

  const transformationConfigByType = getTransformationConfigByType(typesConfig)
  const transformationDefaultConfig = typeDefaultConfig.transformation

  // types with dynamic fields will be associated with the dynamic_keys type

  const { type, nestedTypes } = generateType({
    adapterName,
    name: typeName,
    entries: entriesValues,
    hasDynamicFields: hasDynamicFields === true,
    transformationConfigByType,
    transformationDefaultConfig,
  })
  // find the field and type containing the actual instances
  const nestedFieldDetails = await nestedFieldFinder(type, fieldsToOmit, dataField)

  if (nestedFieldDetails === undefined) {
    log.debug(`storing full entries for ${type.elemID.name}`)
  }

  const instances = await awu(entriesValues).flatMap(async (entry, index) => {
    if (nestedFieldDetails !== undefined) {
      return awu(makeArray(entry[nestedFieldDetails.field.name])).map(
        (nestedEntry, nesteIndex) => toInstance({
          entry: nestedEntry,
          type: nestedFieldDetails.type,
          transformationConfigByType,
          transformationDefaultConfig,
          defaultName: `unnamed_${index}_${nesteIndex}`, // TODO improve
          hasDynamicFields,
          getElemIdFunc,
        })
      ).filter(isDefined).toArray()
    }

    return [await toInstance({
      entry,
      type,
      transformationConfigByType,
      transformationDefaultConfig,
      defaultName: `unnamed_${index}`, // TODO improve
      hasDynamicFields,
      getElemIdFunc,
    })].filter(isDefined)
  }).toArray()

  if (type.isSettings && instances.length > 1) {
    log.warn(`Expected one instance for singleton type: ${type.elemID.name} but received: ${instances.length}`)
    throw new Error(`Could not fetch type ${type.elemID.name}, singleton types should not have more than one instance`)
  }

  const { recurseInto } = requestWithDefaults
  const getExtraFieldValues = async (instance: InstanceElement):
  Promise<Record<string, Entries>> => Object.fromEntries(
    (await Promise.all(
      (recurseInto ?? [])
        .filter(({ conditions }) => shouldRecurseIntoEntry(
          instance.value, requestContext, conditions
        ))
        .map(async nested => {
          const nestedRequestContext = Object.fromEntries(
            nested.context.map(
              contextDef => [contextDef.name, _.get(instance.value, contextDef.fromField)]
            )
          )
          const nestedEntries = (await getEntriesForType({
            ...params,
            typeName: nested.type,
            requestContext: {
              ...requestContext ?? {},
              ...nestedRequestContext,
            },
          }))
          return [nested.toField, nestedEntries]
        })
    )).filter(([_fieldName, nestedEntries]) => !_.isEmpty(nestedEntries))
  )
  let hasExtraFields = false
  await Promise.all(instances.map(async inst => {
    const extraFields = await getExtraFieldValues(inst)
    Object.entries(extraFields ?? {}).forEach(([fieldName, extraEntries]) => {
      hasExtraFields = true
      inst.value[fieldName] = extraEntries.instances.map(i => i.value)
      return inst
    })
  }))
  if (!hasExtraFields) {
    return { instances, type, nestedTypes }
  }
  // We generare the type again since we added more fields to the instances from the recurse into
  const newElements = getNewElementsFromInstances({
    adapterName,
    typeName: (nestedFieldDetails?.type ?? type).elemID.typeName,
    instances,
    transformationConfigByType,
    transformationDefaultConfig,
  })

  return {
    instances: newElements.instances,
    type: newElements.type,
    nestedTypes: newElements.nestedTypes.concat(nestedFieldDetails ? type : []),
  }
}

/**
 * Given a type and the corresponding endpoint definition, make the relevant HTTP requests and
 * use the responses to create elements for the endpoint's type (and nested types) and instances.
 */
export const getTypeAndInstances = async ({
  adapterName,
  typeName,
  paginator,
  nestedFieldFinder,
  computeGetArgs,
  typesConfig,
  typeDefaultConfig,
  contextElements,
  getElemIdFunc,
  getEntriesResponseValuesFunc,
}: {
  adapterName: string
  typeName: string
  paginator: Paginator
  nestedFieldFinder: FindNestedFieldFunc
  computeGetArgs: ComputeGetArgsFunc
  typesConfig: Record<string, TypeDuckTypeConfig>
  typeDefaultConfig: TypeDuckTypeDefaultsConfig
  contextElements?: Record<string, Element[]>
  getElemIdFunc?: ElemIdGetter
  getEntriesResponseValuesFunc?: EntriesRequester
}): Promise<Element[]> => {
  const entries = await getEntriesForType({
    adapterName,
    paginator,
    typeName,
    computeGetArgs,
    nestedFieldFinder,
    typeDefaultConfig,
    typesConfig,
    contextElements,
    getElemIdFunc,
    getEntriesResponseValuesFunc,
  })
  const elements = [entries.type, ...entries.nestedTypes, ...entries.instances]
  const transformationConfigByType = getTransformationConfigByType(typesConfig)

  // We currently don't support extracting standalone fields from the types we recursed into
  await extractStandaloneFields({
    adapterName,
    elements,
    transformationConfigByType,
    transformationDefaultConfig: typeDefaultConfig.transformation,
    getElemIdFunc,
  })
  return elements
}

/**
 * Helper function for the adapter fetch implementation:
 * Given api definitions and a list of types, make the relevant API calls and convert the
 * response data into a list of elements (for the type, nested types and instances).
 *
 * Supports one level of dependency between the type's endpoints, using the dependsOn field
 * (note that it will need to be extended in order to support longer dependency chains).
 */
export const getAllElements = async ({
  adapterName,
  fetchQuery,
  supportedTypes,
  types,
  shouldAddRemainingTypes = true,
  paginator,
  nestedFieldFinder,
  computeGetArgs,
  typeDefaults,
  getElemIdFunc,
  getEntriesResponseValuesFunc,
  isErrorTurnToConfigSuggestion,
}: {
  adapterName: string
  fetchQuery: ElementQuery
  supportedTypes: Record<string, string[]>
  types: Record<string, TypeConfig>
  shouldAddRemainingTypes?: boolean
  paginator: Paginator
  nestedFieldFinder: FindNestedFieldFunc
  computeGetArgs: ComputeGetArgsFunc
  typeDefaults: TypeDuckTypeDefaultsConfig
  getElemIdFunc?: ElemIdGetter
  getEntriesResponseValuesFunc?: EntriesRequester
  isErrorTurnToConfigSuggestion?: (error: Error) => boolean
}): Promise<FetchElements<Element[]>> => {
  const elementGenerationParams = {
    adapterName,
    paginator,
    nestedFieldFinder,
    computeGetArgs,
    typesConfig: types,
    typeDefaultConfig: typeDefaults,
    getElemIdFunc,
    getEntriesResponseValuesFunc,
  }

  const supportedTypesWithEndpoints = _.mapValues(
    supportedTypes,
    typeNames => typeNames.filter(typeName => types[typeName].request?.url !== undefined)
  )
  const supportedTypesReversedMapping = Object.fromEntries(
    Object.entries(supportedTypesWithEndpoints)
      .flatMap(([typeName, values]) =>
        values.map(value => [value, typeName] as [string, string]))
  )

  const configSuggestions: ConfigChangeSuggestion[] = []
  const { elements, errors } = await getElementsWithContext({
    fetchQuery,
    supportedTypes: supportedTypesWithEndpoints,
    types,
    typeElementGetter: async args => {
      try {
        return {
          elements: (await getTypeAndInstances({ ...elementGenerationParams, ...args })),
          errors: [],
        }
      } catch (e) {
        if (isErrorTurnToConfigSuggestion?.(e)
          && (supportedTypesReversedMapping[args.typeName] !== undefined)) {
          configSuggestions.push({
            typeToExclude: supportedTypesReversedMapping[args.typeName],
          })
          return { elements: [], errors: [] }
        }
        if (e.response?.status === 403) {
          const newError: SaltoError = {
            message: `Salto could not access the ${args.typeName} resource. Elements from that type were not fetched. Please make sure that this type is enabled in your service, and that the supplied user credentials have sufficient permissions to access this data. You can also exclude this data from Salto's fetches by changing the environment configuration. Learn more at https://help.salto.io/en/articles/6947061-salto-could-not-access-the-resource`,
            severity: 'Warning',
          }
          return { elements: [], errors: [newError] }
        }
        throw e
      }
    },
  })
  const objectTypes = Object.fromEntries(
    elements.filter(isObjectType).map(e => [e.elemID.name, e])
  )
  const instancesAndTypes = [
    ...Object.values(objectTypes), ...elements.filter(e => !isObjectType(e)),
  ]
  if (shouldAddRemainingTypes) {
    addRemainingTypes({
      adapterName,
      elements: instancesAndTypes,
      typesConfig: types,
      supportedTypes,
      typeDefaultConfig: typeDefaults,
    })
  }
  return {
    elements: instancesAndTypes,
    configChanges: getUniqueConfigSuggestions(configSuggestions),
    errors,
  }
}
