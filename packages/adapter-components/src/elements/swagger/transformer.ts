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
import { InstanceElement, ObjectType, isListType, isMapType, isObjectType, Values } from '@salto-io/adapter-api'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { HTTPClientInterface, UnauthorizedError } from '../../client'
import { UserFetchConfig, RequestableAdapterSwaggerApiConfig, RequestableTypeSwaggerConfig, TypeSwaggerDefaultConfig } from '../../config'
import { generateInstancesForType } from './instance_elements'
import { ADDITIONAL_PROPERTIES_FIELD } from './type_elements/swagger_parser'
import { findDataField, FindNestedFieldFunc } from '../field_finder'
import { computeGetArgs as defaultComputeGetArgs, ComputeGetArgsFunc } from '../request_parameters'
import { getElementsWithContext } from '../element_getter'

const { makeArray } = collections.array
const { toArrayAsync } = collections.asynciterable
const { isDefined } = lowerdashValues
const log = logger(module)

const isItemsOnlyObjectType = (type: ObjectType): boolean => (
  _.isEqual(Object.keys(type.fields), ['items'])
)

const isAdditionalPropertiesOnlyObjectType = (type: ObjectType): boolean => (
  Object.keys(type.fields).length === 1
  && type.fields[ADDITIONAL_PROPERTIES_FIELD] !== undefined
)

const normalizeType = (type: ObjectType | undefined): ObjectType | undefined => {
  if (type !== undefined && isItemsOnlyObjectType(type)) {
    const itemsType = type.fields.items.type
    if (isListType(itemsType) && isObjectType(itemsType.innerType)) {
      return itemsType.innerType
    }
  }
  return type
}

/**
 * Fetch all instances for the specified type, generating the needed API requests
 * based on the endpoint configuration. For endpoints that depend on other endpoints,
 * use the already-fetched elements as context in order to determine the right requests.
 */
const getInstancesForType = async ({
  typeName,
  client,
  typesConfig,
  typeDefaultConfig,
  objectTypes,
  contextElements,
  nestedFieldFinder,
  computeGetArgs,
}: {
  typeName: string
  client: HTTPClientInterface
  objectTypes: Record<string, ObjectType>
  typesConfig: Record<string, RequestableTypeSwaggerConfig>
  typeDefaultConfig: TypeSwaggerDefaultConfig
  contextElements?: Record<string, InstanceElement[]>
  nestedFieldFinder: FindNestedFieldFunc
  computeGetArgs: ComputeGetArgsFunc
}): Promise<InstanceElement[]> => {
  const type = normalizeType(objectTypes[typeName])
  if (type === undefined) {
    // should never happen
    throw new Error(`could not find type ${typeName}`)
  }
  const { request, transformation } = typesConfig[typeName]

  const {
    fieldsToOmit, dataField,
  } = _.defaults({}, transformation, typeDefaultConfig.transformation)

  try {
    const nestedFieldDetails = nestedFieldFinder(type, fieldsToOmit, dataField)

    // TODO align with ducktype
    const getType = (): { objType: ObjectType; extractValues?: boolean } => {
      if (nestedFieldDetails === undefined) {
        return {
          objType: type,
        }
      }

      const dataFieldType = nestedFieldDetails.field.type

      if (isObjectType(dataFieldType) && isAdditionalPropertiesOnlyObjectType(dataFieldType)) {
        const propsType = dataFieldType.fields[ADDITIONAL_PROPERTIES_FIELD].type
        if (isMapType(propsType) && isObjectType(propsType.innerType)) {
          return {
            objType: propsType.innerType,
            extractValues: true,
          }
        }
      }

      const fieldType = isListType(dataFieldType) ? dataFieldType.innerType : dataFieldType
      if (!isObjectType(fieldType)) {
        throw new Error(`data field type ${fieldType.elemID.getFullName()} must be an object type`)
      }
      return { objType: fieldType }
    }

    const { objType, extractValues } = getType()

    const getEntries = async (): Promise<Values[]> => {
      const args = computeGetArgs(request, contextElements)

      const results = (await Promise.all(
        args.map(async getArgs => ((await toArrayAsync(await client.get(getArgs))).flat()))
      )).flatMap(makeArray)

      const entries = (results
        .flatMap(result => (nestedFieldDetails !== undefined
          ? makeArray(result[nestedFieldDetails.field.name])
          : makeArray(result)))
        .flatMap(result => (extractValues && _.isPlainObject(result)
          ? Object.values(result as Values)
          : makeArray(result))))

      return entries
    }

    const transformationConfigByType = _.pickBy(
      _.mapValues(typesConfig, def => def.transformation),
      isDefined,
    )
    const transformationDefaultConfig = typeDefaultConfig.transformation

    const entries = await getEntries()
    return generateInstancesForType({
      entries,
      objType,
      transformationConfigByType,
      transformationDefaultConfig,
    })
  } catch (e) {
    log.error(`Could not fetch ${type.elemID.name}: ${e}. %s`, e.stack)
    if (e instanceof UnauthorizedError) {
      throw e
    }
    return []
  }
}

/**
 * Get all instances from all types included in the fetch configuration.
 */
export const getAllInstances = async ({
  client,
  apiConfig,
  fetchConfig,
  objectTypes,
  nestedFieldFinder = findDataField,
  computeGetArgs = defaultComputeGetArgs,
}: {
  client: HTTPClientInterface
  apiConfig: RequestableAdapterSwaggerApiConfig
  fetchConfig: UserFetchConfig
  objectTypes: Record<string, ObjectType>
  nestedFieldFinder?: FindNestedFieldFunc
  computeGetArgs?: ComputeGetArgsFunc
}): Promise<InstanceElement[]> => {
  const { types, typeDefaults } = apiConfig

  const elementGenerationParams = {
    client,
    typesConfig: types,
    objectTypes,
    typeDefaultConfig: typeDefaults,
    nestedFieldFinder,
    computeGetArgs,
  }

  return getElementsWithContext({
    includeTypes: fetchConfig.includeTypes,
    types: apiConfig.types,
    typeElementGetter: args => getInstancesForType({
      ...elementGenerationParams,
      ...args,
    }),
  })
}
