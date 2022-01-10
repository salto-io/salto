/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { BuiltinTypes, Element, InstanceElement, isInstanceElement, isObjectType, PrimitiveType, Values, ObjectType } from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { Paginator, ResponseValue } from '../../client'
import { generateType } from './type_elements'
import { toInstance } from './instance_elements'
import { TypeConfig, getConfigWithDefault, RecurseIntoCondition, isRecurseIntoConditionByField } from '../../config'
import { FindNestedFieldFunc } from '../field_finder'
import { TypeDuckTypeDefaultsConfig, TypeDuckTypeConfig } from '../../config/ducktype'
import { ComputeGetArgsFunc } from '../request_parameters'
import { getElementsWithContext } from '../element_getter'
import { extractStandaloneFields } from './standalone_field_extractor'
import { fixFieldTypes } from '../type_elements'

const { makeArray } = collections.array
const { toArrayAsync, awu } = collections.asynciterable
const { isDefined } = lowerdashValues
const log = logger(module)

type RequestContexts = Record<string, Record<string, unknown>>

type GetEntriesParams = {
  adapterName: string
  typeName: string
  paginator: Paginator
  typesConfig: Record<string, TypeDuckTypeConfig>
  typeDefaultConfig: TypeDuckTypeDefaultsConfig
  contextElements?: Record<string, InstanceElement[]>
  requestContexts?: RequestContexts
  nestedFieldFinder: FindNestedFieldFunc
  computeGetArgs: ComputeGetArgsFunc
}

const shouldRecurseIntoEntry = (
  entry: Values,
  context?: Record<string, unknown>,
  conditions?: RecurseIntoCondition[]
): boolean => (
  (conditions ?? []).every(condition => {
    const compareValue = isRecurseIntoConditionByField(condition)
      ? _.get(entry, condition.fromField)
      : _.get(context, condition.fromContext)
    return condition.match.some(m => new RegExp(m).test(compareValue))
  })
)

type Entries = {
  instances: InstanceElement[]
  type: ObjectType
  nestedTypes: ObjectType[]
}

const getEntriesForType = async (
  params: GetEntriesParams
): Promise<Record<string, Entries>> => {
  const {
    typeName, paginator, typesConfig, typeDefaultConfig, contextElements,
    requestContexts, nestedFieldFinder, computeGetArgs, adapterName,
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

  const getEntries = async (requestContext: Values | undefined): Promise<Values[]> => {
    const getArgs = computeGetArgs(requestWithDefaults, contextElements, requestContext)
    return (await Promise.all(
      getArgs.map(async args => (await toArrayAsync(
        paginator(args, page => makeArray(page) as ResponseValue[])
      )).flat())
    )).flat()
  }
  const entriesValues = await Promise.all(Object.entries((requestContexts ?? { '': undefined }))
    .map(async ([id, requestContext]) =>
      ({ id, context: requestContext, values: await getEntries(requestContext) })))
  const transformationConfigByType = _.pickBy(
    _.mapValues(typesConfig, def => def.transformation),
    isDefined,
  )
  const transformationDefaultConfig = typeDefaultConfig.transformation

  // escape "field" names that contain '.'
  const naclEntries = entriesValues
    .map(e => ({
      ...e,
      values: e.values.map(
        values => _.mapKeys(values, (_val, key) => naclCase(key))
      ),
    }))

  // types with dynamic fields will be associated with the dynamic_keys type

  const { type, nestedTypes } = generateType({
    adapterName,
    name: typeName,
    entries: naclEntries.flatMap(e => e.values),
    hasDynamicFields: hasDynamicFields === true,
    transformationConfigByType,
    transformationDefaultConfig,
  })
  // find the field and type containing the actual instances
  const nestedFieldDetails = await nestedFieldFinder(type, fieldsToOmit, dataField)

  if (nestedFieldDetails === undefined) {
    log.debug(`storing full entries for ${type.elemID.name}`)
  }

  const idToInstances = Object.fromEntries((await awu(naclEntries)
    .map(async (entry, index) => [entry.id, await awu(makeArray(
      entry.values.flatMap(value =>
        (nestedFieldDetails !== undefined ? value[nestedFieldDetails.field.name] : value))
    )).map(
      async (nestedEntry, nesteIndex) => toInstance({
        entry: nestedEntry,
        type: nestedFieldDetails !== undefined ? nestedFieldDetails.type : type,
        transformationConfigByType,
        transformationDefaultConfig,
        defaultName: `unnamed_${index}_${nesteIndex}`, // TODO improve
        hasDynamicFields,
      })
    ).filter(isDefined).toArray()]).toArray()) as [string, InstanceElement[]][])

  const instanceElements = Object.values(idToInstances).flat()
  if (type.isSettings && instanceElements.length > 1) {
    log.warn(`Expected one instance for singleton type: ${type.elemID.name} but received: ${instanceElements.length}`)
    throw new Error(`Could not fetch type ${type.elemID.name}, singleton types should not have more than one instance`)
  }

  const { recurseInto } = requestWithDefaults
  const getExtraFieldValues = async (instance: InstanceElement):
  Promise<Record<string, Entries>> => _.omitBy(Object.fromEntries(await Promise.all(
    (recurseInto ?? [])
      .filter(({ conditions }) => shouldRecurseIntoEntry(
        instance.value, (requestContexts ?? {})[instance.elemID.getFullName()], conditions
      ))
      .map(async nested => {
        const nestedRequestContext = {
          [instance.elemID.getFullName()]: Object.fromEntries(
            nested.context.map(
              contextDef => [contextDef.name, _.get(instance.value, contextDef.fromField)]
            )
          ),
        }
        const nestedEntries = (await getEntriesForType({
          ...params,
          typeName: nested.type,
          requestContexts: {
            ...requestContexts ?? {},
            ...nestedRequestContext,
          },
        }))[instance.elemID.getFullName()]
        return [nested.toField, nestedEntries] as unknown as [string, Entries]
      })
  )), _.isEmpty)
  let hasExtraFields = false
  await Promise.all(instanceElements.map(async inst => {
    const extraFields = await getExtraFieldValues(inst)
    Object.entries(extraFields ?? {}).forEach(([fieldName, extraEntries]) => {
      hasExtraFields = true
      inst.value[fieldName] = extraEntries.instances.map(i => i.value)
      return inst
    })
  }))
  if (!hasExtraFields) {
    return _.mapValues(
      idToInstances,
      instances => ({ instances, type, nestedTypes })
    )
  }
  const newTypeName = instanceElements[0].refType.elemID.name
  const { type: newType, nestedTypes: newNestedTypes } = generateType({
    adapterName,
    name: newTypeName,
    entries: instanceElements.map(inst => inst.value),
    hasDynamicFields: hasDynamicFields === true,
    transformationConfigByType,
    transformationDefaultConfig,
  })
  return _.mapValues(
    idToInstances,
    instances => ({
      instances: instances.map(inst => new InstanceElement(
        inst.elemID.name, newType, inst.value, inst.path, inst.annotations,
      )),
      type: newType,
      nestedTypes: [...newNestedTypes, type],
    })
  )
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
  const entries = await getEntriesForType({
    adapterName,
    paginator,
    typeName,
    computeGetArgs,
    nestedFieldFinder,
    typeDefaultConfig,
    typesConfig,
    contextElements: _.pickBy(
      contextElements,
      values => values.every(isInstanceElement)
    ) as Record<string, InstanceElement[]>,
  })
  const elements = Object.values(entries).flatMap(e => [e.type, ...e.nestedTypes, ...e.instances])
  const transformationConfigByType = _.pickBy(
    _.mapValues(typesConfig, def => def.transformation),
    isDefined,
  )

  await extractStandaloneFields({
    adapterName,
    elements,
    transformationConfigByType,
    transformationDefaultConfig: typeDefaultConfig.transformation,
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

  const elements = await getElementsWithContext({
    includeTypes: allTypesWithRequestEndpoints,
    types,
    typeElementGetter: args => getTypeAndInstances({
      ...elementGenerationParams,
      ...args,
    }),
  })
  const objectTypes = Object.fromEntries(
    elements.filter(isObjectType).map(e => [e.elemID.name, e])
  )
  const duckTypeTypeMap: Record<string, PrimitiveType> = {
    string: BuiltinTypes.STRING,
    boolean: BuiltinTypes.BOOLEAN,
    number: BuiltinTypes.NUMBER,
  }
  fixFieldTypes(
    objectTypes,
    types,
    typeDefaults,
    (val: string) => _.get(duckTypeTypeMap, val, BuiltinTypes.UNKNOWN),
  )
  return [...Object.values(objectTypes), ...elements.filter(e => !isObjectType(e))]
}
