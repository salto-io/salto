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
import {
  InstanceElement, Values, ObjectType, isObjectType, ReferenceExpression, isReferenceExpression,
  isListType, isMapType, TypeElement, PrimitiveType, MapType,
} from '@salto-io/adapter-api'
import { transformElement, TransformFunc, safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { ADDITIONAL_PROPERTIES_FIELD, ARRAY_ITEMS_FIELD } from './type_elements/swagger_parser'
import { InstanceCreationParams, toBasicInstance } from '../instance_elements'
import { UnauthorizedError, Paginator, PageEntriesExtractor } from '../../client'
import {
  UserFetchConfig, TypeSwaggerDefaultConfig, TransformationConfig, TransformationDefaultConfig,
  AdapterSwaggerApiConfig, TypeSwaggerConfig, getConfigWithDefault, RecurseIntoCondition,
  isRecurseIntoConditionByField,
} from '../../config'
import { findDataField, FindNestedFieldFunc } from '../field_finder'
import { computeGetArgs as defaultComputeGetArgs, ComputeGetArgsFunc } from '../request_parameters'
import { getElementsWithContext } from '../element_getter'

const { makeArray } = collections.array
const { toArrayAsync, awu } = collections.asynciterable
const { isDefined, isPlainRecord } = lowerdashValues
const log = logger(module)

class InvalidTypeConfig extends Error {}

/**
 * Extract standalone fields to their own instances, and convert the original value to a reference.
 */
const extractStandaloneFields = async (
  inst: InstanceElement,
  {
    transformationConfigByType,
    transformationDefaultConfig,
  }: {
    transformationConfigByType: Record<string, TransformationConfig>
    transformationDefaultConfig: TransformationDefaultConfig
  },
): Promise<InstanceElement[]> => {
  if (_.isEmpty(transformationConfigByType[inst.refType.elemID.name]?.standaloneFields)) {
    return [inst]
  }
  const additionalInstances: InstanceElement[] = []

  const replaceWithReference = async ({ values, parent, objType }: {
    values: Values[]
    parent: InstanceElement
    objType: ObjectType
  }): Promise<ReferenceExpression[]> => {
    // eslint-disable-next-line no-use-before-define
    const refInstances = await generateInstancesForType({
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

  const extractFields: TransformFunc = async ({ value, field, path }) => {
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

    const refOrListType = await field.getType()
    const refType = isListType(refOrListType) ? await refOrListType.getInnerType() : refOrListType
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
    return (await replaceWithReference({
      values: [value],
      parent: inst,
      objType: refType,
    }))[0]
  }

  const updatedInst = await transformElement({
    element: inst,
    transformFunc: extractFields,
    strict: false,
  })
  return [updatedInst, ...additionalInstances]
}

const getListDeepInnerType = async (
  type: TypeElement,
): Promise<ObjectType | PrimitiveType | MapType> => {
  if (!isListType(type)) {
    return type
  }
  return getListDeepInnerType(await type.getInnerType())
}

/**
 * Normalize the element's values, by nesting swagger additionalProperties under the
 * additionalProperties field in order to align with the type.
 *
 * Note: The reverse will need to be done pre-deploy (not implemented for fetch-only)
 */
const normalizeElementValues = (instance: InstanceElement): Promise<InstanceElement> => {
  const transformAdditionalProps: TransformFunc = async ({ value, field, path }) => {
    if (Array.isArray(value)) {
      // will handle in inner call
      return value
    }

    const fieldType = path?.isEqual(instance.elemID)
      ? await instance.getType()
      : await field?.getType()

    if (fieldType === undefined) {
      return value
    }
    const fieldInnerType = await getListDeepInnerType(fieldType)
    if (
      !isObjectType(fieldInnerType)
      || fieldInnerType.fields[ADDITIONAL_PROPERTIES_FIELD] === undefined
      || !isMapType(await fieldInnerType.fields[ADDITIONAL_PROPERTIES_FIELD].getType())
    ) {
      return value
    }

    const additionalProps = _.merge(
      _.pickBy(
        value,
        (_val, key) => !Object.keys(fieldInnerType.fields).includes(key),
      ),
      // if the value already has additional properties, give them precedence
      value[ADDITIONAL_PROPERTIES_FIELD],
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

const toInstance = async (args: InstanceCreationParams): Promise<InstanceElement> => (
  args.normalized ? toBasicInstance(args) : normalizeElementValues(await toBasicInstance(args))
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
}): Promise<InstanceElement[]> => {
  const standaloneFields = transformationConfigByType[objType.elemID.name]?.standaloneFields
  return awu(entries)
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
    )).toArray()
}

const isAdditionalPropertiesOnlyObjectType = (type: ObjectType): boolean => (
  _.isEqual(Object.keys(type.fields), [ADDITIONAL_PROPERTIES_FIELD])
)

const isItemsOnlyObjectType = (type: ObjectType): boolean => (
  _.isEqual(Object.keys(type.fields), [ARRAY_ITEMS_FIELD])
)

const normalizeType = async (type: ObjectType | undefined): Promise<ObjectType | undefined> => {
  if (type !== undefined && isItemsOnlyObjectType(type)) {
    const itemsType = await type.fields.items.getType()
    if (isListType(itemsType) && isObjectType(await itemsType.getInnerType())) {
      return itemsType.getInnerType() as Promise<ObjectType>
    }
  }
  return type
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

type GetEntriesParams = {
  typeName: string
  paginator: Paginator
  objectTypes: Record<string, ObjectType>
  typesConfig: Record<string, TypeSwaggerConfig>
  typeDefaultConfig: TypeSwaggerDefaultConfig
  contextElements?: Record<string, InstanceElement[]>
  requestContext?: Record<string, unknown>
  nestedFieldFinder: FindNestedFieldFunc
  computeGetArgs: ComputeGetArgsFunc
}

export const extractPageEntriesByNestedField = (fieldName?: string): PageEntriesExtractor => (
  page => {
    const allEntries = (fieldName !== undefined
      ? makeArray(_.get(page, fieldName))
      : makeArray(page))
    const [validEntries, invalidEntries] = _.partition(allEntries, isPlainRecord)
    if (invalidEntries.length > 0) {
      log.error('omitted %d invalid entries: %s', invalidEntries.length, safeJsonStringify(invalidEntries))
    }
    return validEntries
  }
)

const getEntriesForType = async (
  params: GetEntriesParams
): Promise<{ entries: Values[]; objType: ObjectType }> => {
  const {
    typeName, paginator, typesConfig, typeDefaultConfig, objectTypes, contextElements,
    requestContext, nestedFieldFinder, computeGetArgs,
  } = params
  const type = await normalizeType(objectTypes[typeName])
  const typeConfig = typesConfig[typeName]
  if (type === undefined || typeConfig === undefined) {
    // should never happen
    throw new InvalidTypeConfig(`could not find type ${typeName}`)
  }
  const { request, transformation } = typeConfig
  if (request === undefined) {
    // a type with no request config cannot be fetched
    throw new InvalidTypeConfig(`Invalid type config - type ${type.elemID.adapter}.${typeName} has no request config`)
  }

  const {
    fieldsToOmit, dataField,
  } = getConfigWithDefault(transformation, typeDefaultConfig.transformation)
  const requestWithDefaults = getConfigWithDefault(request, typeDefaultConfig.request ?? {})

  const nestedFieldDetails = await nestedFieldFinder(type, fieldsToOmit, dataField)

  const getType = async (): Promise<{ objType: ObjectType; extractValues?: boolean }> => {
    if (nestedFieldDetails === undefined) {
      return {
        objType: type,
      }
    }

    const dataFieldType = await nestedFieldDetails.field.getType()

    // special case - should probably move to adapter-specific filter if does not recur
    if (
      dataField !== undefined
      && isObjectType(dataFieldType)
      && isAdditionalPropertiesOnlyObjectType(dataFieldType)
    ) {
      const propsType = await dataFieldType.fields[ADDITIONAL_PROPERTIES_FIELD].getType()
      if (isMapType(propsType)) {
        const propsInnerType = await propsType.getInnerType()
        if (isObjectType(propsInnerType)) {
          return {
            objType: propsInnerType,
            extractValues: true,
          }
        }
      }
    }

    const fieldType = isListType(dataFieldType) ? await dataFieldType.getInnerType() : dataFieldType
    if (!isObjectType(fieldType)) {
      throw new Error(`data field type ${fieldType.elemID.getFullName()} must be an object type`)
    }
    return { objType: fieldType }
  }

  const { objType, extractValues } = await getType()

  const getEntries = async (): Promise<Values[]> => {
    const args = computeGetArgs(requestWithDefaults, contextElements, requestContext)

    const results = (await Promise.all(args.map(
      async getArgs => ((await toArrayAsync(paginator(
        getArgs,
        extractPageEntriesByNestedField(nestedFieldDetails?.field.name),
      ))).flat())
    ))).flatMap(makeArray)

    const entries = (results
      .flatMap(result => (extractValues && _.isPlainObject(result)
        ? Object.values(result as object)
        : makeArray(result))))

    return entries
  }

  const entries = await getEntries()

  const { recurseInto } = requestWithDefaults
  if (recurseInto === undefined) {
    return { entries, objType }
  }

  const getExtraFieldValues = (
    entry: Values
  ): Promise<[string, Values | Values[]][]> => Promise.all(
    recurseInto
      .filter(({ conditions }) => shouldRecurseIntoEntry(entry, requestContext, conditions))
      .map(async nested => {
        const nestedRequestContext = Object.fromEntries(
          nested.context.map(
            contextDef => [contextDef.name, _.get(entry, contextDef.fromField)]
          )
        )
        const { entries: nestedEntries } = await getEntriesForType({
          ...params,
          typeName: nested.type,
          requestContext: {
            ...requestContext ?? {},
            ...nestedRequestContext,
          },
        })
        if (nested.isSingle) {
          if (nestedEntries.length === 1) {
            return [nested.toField, nestedEntries[0]] as [string, Values]
          }
          log.warn(`Expected a single value in recurseInto result for ${typeName}.${nested.toField} but received: ${nestedEntries.length}, keeping as list`)
        }
        return [nested.toField, nestedEntries] as [string, Values[]]
      })
  )

  const filledEntries = await Promise.all(
    entries.map(async entry => {
      const extraFields = await getExtraFieldValues(entry)
      return { ...entry, ...Object.fromEntries(extraFields) }
    })
  )

  return { entries: filledEntries, objType }
}

/**
 * Fetch all instances for the specified type, generating the needed API requests
 * based on the endpoint configuration. For endpoints that depend on other endpoints,
 * use the already-fetched elements as context in order to determine the right requests.
 */
const getInstancesForType = async (params: GetEntriesParams): Promise<InstanceElement[]> => {
  const { typeName, typesConfig, typeDefaultConfig } = params
  const transformationConfigByType = _.pickBy(
    _.mapValues(typesConfig, def => def.transformation),
    isDefined,
  )
  const transformationDefaultConfig = typeDefaultConfig.transformation
  try {
    const { entries, objType } = await getEntriesForType(params)
    if (objType.isSettings && entries.length > 1) {
      log.warn(`Expected one instance for singleton type: ${typeName} but received: ${entries.length}`)
      throw new InvalidTypeConfig(`Could not fetch type ${typeName}, singleton types should not have more than one instance`)
    }
    return generateInstancesForType({
      entries,
      objType,
      transformationConfigByType,
      transformationDefaultConfig,
    })
  } catch (e) {
    log.warn(`Could not fetch ${typeName}: ${e}. %s`, e.stack)
    if (e instanceof UnauthorizedError || e instanceof InvalidTypeConfig) {
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
  apiConfig: Pick<AdapterSwaggerApiConfig, 'types' | 'typeDefaults'>
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
