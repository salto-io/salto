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
import {
  InstanceElement, Values, ObjectType, isObjectType, ReferenceExpression, isReferenceExpression,
  isListType, isMapType,
} from '@salto-io/adapter-api'
import { transformElement, TransformFunc } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { ADDITIONAL_PROPERTIES_FIELD, ARRAY_ITEMS_FIELD } from './type_elements/swagger_parser'
import { InstanceCreationParams, toBasicInstance } from '../instance_elements'
import { UnauthorizedError, Paginator } from '../../client'
import {
  UserFetchConfig, TypeSwaggerDefaultConfig, TransformationConfig, TransformationDefaultConfig,
  AdapterSwaggerApiConfig, TypeSwaggerConfig,
} from '../../config'
import { findDataField, FindNestedFieldFunc } from '../field_finder'
import { computeGetArgs as defaultComputeGetArgs, ComputeGetArgsFunc } from '../request_parameters'
import { getElementsWithContext } from '../element_getter'

const { makeArray } = collections.array
const { toArrayAsync } = collections.asynciterable
const { isDefined } = lowerdashValues
const log = logger(module)

/**
 * Extract standalone fields to their own instances, and convert the original value to a reference.
 */
const extractStandaloneFields = (
  inst: InstanceElement,
  {
    transformationConfigByType,
    transformationDefaultConfig,
  }: {
    transformationConfigByType: Record<string, TransformationConfig>
    transformationDefaultConfig: TransformationDefaultConfig
  },
): InstanceElement[] => {
  if (_.isEmpty(transformationConfigByType[inst.type.elemID.name]?.standaloneFields)) {
    return [inst]
  }
  const additionalInstances: InstanceElement[] = []

  const replaceWithReference = ({ values, parent, objType }: {
    values: Values[]
    parent: InstanceElement
    objType: ObjectType
  }): ReferenceExpression[] => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const refInstances = generateInstancesForType({
      entries: values,
      objType,
      nestName: true,
      parent,
      transformationConfigByType,
      transformationDefaultConfig,
      normalized: true,
    })
    additionalInstances.push(...refInstances)
    return refInstances.map(refInst => new ReferenceExpression(refInst.elemID))
  }

  const extractFields: TransformFunc = ({ value, field, path }) => {
    if (field === undefined) {
      return value
    }
    const parentType = field.parent.elemID.name
    const { standaloneFields } = (
      transformationConfigByType[parentType]
      ?? transformationDefaultConfig
    )
    if (standaloneFields === undefined) {
      return value
    }
    const fieldExtractionDef = standaloneFields.find(def => def.fieldName === field.name)

    if (fieldExtractionDef === undefined || isReferenceExpression(value)) {
      return value
    }

    const refType = isListType(field.type) ? field.type.innerType : field.type
    if (!isObjectType(refType)) {
      log.error(`unexpected type encountered when extracting nested fields - skipping path ${path} for instance ${inst.elemID.getFullName()}`)
      return value
    }

    if (Array.isArray(value)) {
      return replaceWithReference({
        values: value,
        parent: inst,
        objType: refType,
      })
    }
    return replaceWithReference({
      values: [value],
      parent: inst,
      objType: refType,
    })[0]
  }

  const updatedInst = transformElement({
    element: inst,
    transformFunc: extractFields,
    strict: false,
  })
  return [updatedInst, ...additionalInstances]
}

/**
 * Normalize the element's values, by nesting swagger additionalProperties under the
 * additionalProperties field in order to align with the type.
 *
 * Note: The reverse will need to be done pre-deploy (not implemented for fetch-only)
 */
const normalizeElementValues = (instance: InstanceElement): InstanceElement => {
  const transformAdditionalProps: TransformFunc = ({ value, field, path }) => {
    const fieldType = path?.isEqual(instance.elemID) ? instance.type : field?.type
    if (
      !isObjectType(fieldType)
      || fieldType.fields[ADDITIONAL_PROPERTIES_FIELD] === undefined
      || !isMapType(fieldType.fields[ADDITIONAL_PROPERTIES_FIELD].type)
    ) {
      return value
    }

    const additionalProps = _.pickBy(
      value,
      (_val, key) => !Object.keys(fieldType.fields).includes(key),
    )
    return {
      ..._.omit(value, Object.keys(additionalProps)),
      [ADDITIONAL_PROPERTIES_FIELD]: additionalProps,
    }
  }

  return transformElement({
    element: instance,
    transformFunc: transformAdditionalProps,
    strict: false,
  })
}

const toInstance = (args: InstanceCreationParams): InstanceElement => (
  args.normalized ? toBasicInstance(args) : normalizeElementValues(toBasicInstance(args))
)

/**
 * Generate instances for the specified types based on the entries from the API responses,
 * using the endpoint's specific config and the adapter's defaults.
 */
const generateInstancesForType = ({
  entries,
  objType,
  nestName,
  parent,
  transformationConfigByType,
  transformationDefaultConfig,
  normalized,
}: {
  entries: Values[]
  objType: ObjectType
  nestName?: boolean
  parent?: InstanceElement
  transformationConfigByType: Record<string, TransformationConfig>
  transformationDefaultConfig: TransformationDefaultConfig
  normalized?: boolean
}): InstanceElement[] => {
  const standaloneFields = transformationConfigByType[objType.elemID.name]?.standaloneFields
  return entries
    .map((entry, index) => toInstance({
      entry,
      type: objType,
      nestName,
      parent,
      transformationConfigByType,
      transformationDefaultConfig,
      normalized,
      defaultName: `unnamed_${index}`, // TODO improve
    }))
    .flatMap(inst => (
      standaloneFields === undefined
        ? [inst]
        : extractStandaloneFields(inst, {
          transformationConfigByType,
          transformationDefaultConfig,
        })
    ))
}

const isAdditionalPropertiesOnlyObjectType = (type: ObjectType): boolean => (
  _.isEqual(Object.keys(type.fields), [ADDITIONAL_PROPERTIES_FIELD])
)

const isItemsOnlyObjectType = (type: ObjectType): boolean => (
  _.isEqual(Object.keys(type.fields), [ARRAY_ITEMS_FIELD])
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
  paginator,
  typesConfig,
  typeDefaultConfig,
  objectTypes,
  contextElements,
  nestedFieldFinder,
  computeGetArgs,
}: {
  typeName: string
  paginator: Paginator
  objectTypes: Record<string, ObjectType>
  typesConfig: Record<string, TypeSwaggerConfig>
  typeDefaultConfig: TypeSwaggerDefaultConfig
  contextElements?: Record<string, InstanceElement[]>
  nestedFieldFinder: FindNestedFieldFunc
  computeGetArgs: ComputeGetArgsFunc
}): Promise<InstanceElement[]> => {
  const type = normalizeType(objectTypes[typeName])
  const typeConfig = typesConfig[typeName]
  if (type === undefined || typeConfig === undefined) {
    // should never happen
    throw new Error(`could not find type ${typeName}`)
  }
  const { request, transformation } = typeConfig
  if (request === undefined) {
    // a type with no request config cannot be fetched
    throw new Error(`Invalid type config - type ${type.elemID.adapter}.${typeName} has no request config`)
  }

  const {
    fieldsToOmit, dataField,
  } = _.defaults({}, transformation, typeDefaultConfig.transformation)

  try {
    const nestedFieldDetails = nestedFieldFinder(type, fieldsToOmit, dataField)

    const getType = (): { objType: ObjectType; extractValues?: boolean } => {
      if (nestedFieldDetails === undefined) {
        return {
          objType: type,
        }
      }

      const dataFieldType = nestedFieldDetails.field.type

      // special case - should probably move to adapter-specific filter if does not recur
      if (
        dataField !== undefined
        && isObjectType(dataFieldType)
        && isAdditionalPropertiesOnlyObjectType(dataFieldType)
      ) {
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
        args.map(async getArgs => ((await toArrayAsync(await paginator(getArgs))).flat()))
      )).flatMap(makeArray)

      const entries = (results
        .flatMap(result => (nestedFieldDetails !== undefined
          ? makeArray(result[nestedFieldDetails.field.name])
          : makeArray(result)))
        .flatMap(result => (extractValues && _.isPlainObject(result)
          ? Object.values(result as object)
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
  paginator,
  apiConfig,
  fetchConfig,
  objectTypes,
  nestedFieldFinder = findDataField,
  computeGetArgs = defaultComputeGetArgs,
}: {
  paginator: Paginator
  apiConfig: AdapterSwaggerApiConfig
  fetchConfig: UserFetchConfig
  objectTypes: Record<string, ObjectType>
  nestedFieldFinder?: FindNestedFieldFunc
  computeGetArgs?: ComputeGetArgsFunc
}): Promise<InstanceElement[]> => {
  const { types, typeDefaults } = apiConfig

  const elementGenerationParams = {
    paginator,
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
