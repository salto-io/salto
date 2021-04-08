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
import { Element, Values } from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { Paginator } from '../../client'
import { generateType } from './type_elements'
import { toInstance } from './instance_elements'
import { TypeConfig } from '../../config'
import { FindNestedFieldFunc } from '../field_finder'
import { TypeDuckTypeDefaultsConfig, TypeDuckTypeConfig } from '../../config/ducktype'
import { ComputeGetArgsFunc } from '../request_parameters'
import { getElementsWithContext } from '../element_getter'

const { makeArray } = collections.array
const { toArrayAsync } = collections.asynciterable
const { isDefined } = lowerdashValues
const log = logger(module)

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
}: {
  adapterName: string
  typeName: string
  paginator: Paginator
  nestedFieldFinder: FindNestedFieldFunc
  computeGetArgs: ComputeGetArgsFunc
  typesConfig: Record<string, TypeDuckTypeConfig>
  typeDefaultConfig: TypeDuckTypeDefaultsConfig
  contextElements?: Record<string, Element[]>
}): Promise<Element[]> => {
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
  } = _.defaults({}, transformation, typeDefaultConfig.transformation)

  const transformationConfigByType = _.pickBy(
    _.mapValues(typesConfig, def => def.transformation),
    isDefined,
  )
  const transformationDefaultConfig = typeDefaultConfig.transformation

  const requestWithDefaults = _.defaults({}, request, typeDefaultConfig.request ?? {})

  const getEntries = async (): Promise<Values[]> => {
    const getArgs = computeGetArgs(requestWithDefaults, contextElements)
    return (await Promise.all(
      getArgs.map(async args => (await toArrayAsync(await paginator(args))).flat())
    )).flat()
  }

  const entries = await getEntries()

  // escape "field" names that contain '.'
  const naclEntries = entries.map(e => _.mapKeys(e, (_val, key) => naclCase(key)))

  // types with dynamic fields will be associated with the dynamic_keys type

  const { type, nestedTypes } = generateType({
    adapterName,
    name: typeName,
    entries: naclEntries,
    hasDynamicFields: hasDynamicFields === true,
  })
  // find the field and type containing the actual instances
  const nestedFieldDetails = nestedFieldFinder(type, fieldsToOmit, dataField)

  const instances = naclEntries.flatMap((entry, index) => {
    if (nestedFieldDetails !== undefined) {
      return makeArray(entry[nestedFieldDetails.field.name]).map(
        (nestedEntry, nesteIndex) => toInstance({
          entry: nestedEntry,
          type: nestedFieldDetails.type,
          transformationConfigByType,
          transformationDefaultConfig,
          defaultName: `unnamed_${index}_${nesteIndex}`, // TODO improve
          hasDynamicFields,
        })
      ).filter(isDefined)
    }

    log.info(`storing full entry for ${type.elemID.name}`)
    return toInstance({
      entry,
      type,
      transformationConfigByType,
      transformationDefaultConfig,
      defaultName: `unnamed_${index}`, // TODO improve
      hasDynamicFields,
    })
  })
  return [type, ...nestedTypes, ...instances].filter(isDefined)
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
  includeTypes,
  types,
  paginator,
  nestedFieldFinder,
  computeGetArgs,
  typeDefaults,
}: {
  adapterName: string
  includeTypes: string[]
  types: Record<string, TypeConfig>
  paginator: Paginator
  nestedFieldFinder: FindNestedFieldFunc
  computeGetArgs: ComputeGetArgsFunc
  typeDefaults: TypeDuckTypeDefaultsConfig
}): Promise<Element[]> => {
  const allTypesWithRequestEndpoints = includeTypes.filter(
    typeName => types[typeName].request?.url !== undefined
  )

  const elementGenerationParams = {
    adapterName,
    paginator,
    nestedFieldFinder,
    computeGetArgs,
    typesConfig: types,
    typeDefaultConfig: typeDefaults,
  }

  return getElementsWithContext({
    includeTypes: allTypesWithRequestEndpoints,
    types,
    typeElementGetter: args => getTypeAndInstances({
      ...elementGenerationParams,
      ...args,
    }),
  })
}
