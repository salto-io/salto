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
import _ from 'lodash'
import {
  ElemIdGetter,
  INSTANCE_ANNOTATIONS,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  Values,
} from '@salto-io/adapter-api'
import {
  TransformFuncSync,
  invertNaclCase,
  mapKeysRecursive,
  naclCase,
  transformValuesSync,
} from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FetchApiDefinitionsOptions, InstanceFetchApiDefinitions } from '../../definitions/system/fetch'
import {
  ApiDefinitions,
  APIDefinitionsOptions,
  DefQuery,
  NameMappingFunctionMap,
  queryWithDefault,
  ResolveCustomNameMappingOptionsType,
} from '../../definitions'
import { ElemIDCreator, PartsCreator, createElemIDFunc, getElemPath } from './id_utils'
import { ElementAndResourceDefFinder } from '../../definitions/system/fetch/types'
import { removeNullValues } from './type_utils'

const log = logger(module)

/**
 * Transform a value to a valid instance value by nacl-casing all its keys,
 * so that they can appear as valid elem id parts.
 * Note:
 * - when used as an instance value, the relevant type elements' fields should also be nacl-cased separately.
 * - in most cases, this transformation should be reverted before deploy. this can be done be setting invert=true
 */
export const recursiveNaclCase = (value: Values, invert = false): Values => {
  const func = invert ? invertNaclCase : naclCase
  return mapKeysRecursive(value, ({ key }) => func(key))
}

/**
 * - omit values of fields marked as omit=true
 * - omit null values
 */
const omitValues =
  <Options extends FetchApiDefinitionsOptions>(
    defQuery: DefQuery<InstanceFetchApiDefinitions<Options>>,
  ): TransformFuncSync =>
  ({ value, field }) => {
    if (value === null) {
      return undefined
    }
    if (field !== undefined) {
      const parentType = field.parent.elemID.name
      if (defQuery.query(parentType)?.element?.fieldCustomizations?.[field.name]?.omit) {
        return undefined
      }
    }
    return value
  }

/**
 * Prepare an entry to be used as an instance value.
 * The value is transformed as follows:
 * - all keys are nacl-cased to ensure elem ids can be created (TODO should be reversed pre deploy)
 * - omitting the values of fields marked as omit=true, as well as null values.
 *
 * Note: standalone fields' values with referenceFromParent=false should be omitted separately
 */
export const omitInstanceValues = <Options extends FetchApiDefinitionsOptions>({
  value,
  defQuery,
  type,
}: {
  value: Values
  defQuery: ElementAndResourceDefFinder<Options>
  type: ObjectType
}): Values =>
  transformValuesSync({
    values: value,
    type,
    transformFunc: omitValues(defQuery),
    strict: false,
  })

/**
 * calling "omitInstanceValues" on all instances and adding a log time to it
 */
export const omitAllInstancesValues = <Options extends FetchApiDefinitionsOptions>({
  instances,
  defQuery,
}: {
  instances: InstanceElement[]
  defQuery: ElementAndResourceDefFinder<Options>
}): void =>
  log.timeDebug(() => {
    instances.forEach(inst => {
      inst.value = omitInstanceValues({ value: inst.value, type: inst.getTypeSync(), defQuery })
    })
  }, 'omitAllInstancesValues')

export type InstanceCreationParams = {
  entry: Values
  type: ObjectType
  defaultName: string
  parent?: InstanceElement
  toElemName: ElemIDCreator
  toPath: PartsCreator
}

/**
 * Generate an instance for a single entry returned for a given type, and set its elem id and path.
 * Assuming the entry is already in its final structure (after nacl-case), except for omitting fields
 */
export const getInstanceCreationFunctions = <Options extends FetchApiDefinitionsOptions>({
  defQuery,
  type,
  getElemIdFunc,
  customNameMappingFunctions,
  nestUnderPath,
}: {
  type: ObjectType
  defQuery: ElementAndResourceDefFinder<Options>
  getElemIdFunc?: ElemIdGetter
  customNameMappingFunctions?: NameMappingFunctionMap<ResolveCustomNameMappingOptionsType<Options>>
  nestUnderPath?: string[]
}): {
  toElemName: ElemIDCreator
  toPath: PartsCreator
} => {
  const { adapter: adapterName, typeName } = type.elemID

  const { element: elementDef, resource: resourceDef } = defQuery.query(typeName) ?? {}

  if (!elementDef?.topLevel?.isTopLevel) {
    // should have already been tested in caller, we should not get here if topLevel is undefined
    const error = `type ${adapterName}:${typeName} is not defined as top-level, cannot create instances`
    throw new Error(error)
  }

  const { elemID: elemIDDef, singleton } = elementDef.topLevel

  // if there is at least one standalone field with nestPathUnderParent, we should create a folder to instance
  const createSelfFolder = Object.entries(elementDef.fieldCustomizations ?? {}).some(
    ([_fieldName, fieldDef]) => fieldDef.standalone?.nestPathUnderParent,
  )

  // if this is a singleton, the instance name has to be 'config' and cannot be customized
  const elemIDCreator = elemIDDef?.custom && !singleton ? elemIDDef.custom : createElemIDFunc

  const toElemName = elemIDCreator({
    elemIDDef: elemIDDef ?? {},
    singleton,
    getElemIdFunc,
    serviceIDDef: resourceDef?.serviceIDFields,
    typeID: type.elemID,
    customNameMappingFunctions,
  })
  const toPath = getElemPath({
    def: elementDef.topLevel.path,
    singleton,
    elemIDCreator: toElemName,
    typeID: type.elemID,
    customNameMappingFunctions,
    nestUnderPath,
    createSelfFolder,
  })

  return { toElemName, toPath }
}

/**
 * Generate an instance for a single entry returned for a given type, and set its elem id and path.
 * Assuming the entry is already in its final structure (after running to InstanceValue).
 */
export const createInstance = ({
  entry,
  type,
  toElemName,
  toPath,
  defaultName,
  parent,
}: InstanceCreationParams): InstanceElement | undefined => {
  const annotations = _.pick(entry, Object.keys(INSTANCE_ANNOTATIONS))
  const value = _.omit(entry, Object.keys(INSTANCE_ANNOTATIONS))
  const refinedValue = value !== undefined ? removeNullValues(value, type) : {}

  if (_.isEmpty(refinedValue)) {
    return undefined
  }
  if (parent !== undefined) {
    annotations[INSTANCE_ANNOTATIONS.PARENT] = collections.array.makeArray(annotations[INSTANCE_ANNOTATIONS.PARENT])
    annotations[INSTANCE_ANNOTATIONS.PARENT].push(new ReferenceExpression(parent.elemID, parent))
  }

  const args = { entry, parent, defaultName }
  return new InstanceElement(toElemName(args), type, refinedValue, toPath(args), annotations)
}

export const getFieldsToOmit = <Options extends APIDefinitionsOptions = {}>(
  definitions: ApiDefinitions<Options>,
  typeName: string,
): string[] => {
  const defQuery = queryWithDefault(definitions.fetch?.instances ?? {})
  const customizations = defQuery.query(typeName)?.element?.fieldCustomizations ?? {}
  return Object.entries(customizations)
    .filter(([, customization]) => customization.omit === true)
    .map(([fieldName]) => fieldName)
}
