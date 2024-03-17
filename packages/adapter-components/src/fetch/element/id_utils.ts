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
  ElemID,
  InstanceElement,
  OBJECT_NAME,
  OBJECT_SERVICE_ID,
  ServiceIds,
  Values,
  toServiceIdsString,
} from '@salto-io/adapter-api'
import { invertNaclCase, naclCase, pathNaclCase, safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { NameMappingFunction, NameMappingFunctionMap, NameMappingOptions } from '../../definitions'
import { ElemIDCreatorArgs, ElemIDDefinition, PathDefinition } from '../../definitions/system/fetch/element'
import { RECORDS_PATH, SETTINGS_NESTED_PATH } from '../../elements/constants'

export type ElemIDCreator = (args: { entry: Values; defaultName: string; parent?: InstanceElement }) => string

export type PartsCreator = (args: { entry: Values; defaultName: string; parent?: InstanceElement }) => string[]

const ID_SEPARATOR = '_'

const log = logger(module)

const DEFAULT_NAME_MAPPING_FUNCTIONS: Record<NameMappingOptions, NameMappingFunction> = {
  lowercase: name => String(name).toLowerCase(),
  uppercase: name => String(name).toUpperCase(),
}

export const createServiceIDs = ({
  entry,
  serviceIDFields,
  typeID,
}: {
  entry: Values
  serviceIDFields: string[]
  typeID: ElemID
}): ServiceIds => {
  const missingFields = serviceIDFields.filter(f => entry[f] === undefined)
  if (missingFields.length > 0) {
    log.trace(
      'some service id fields could not be found: type %s fields %s, available fields %s ',
      typeID.getFullName(),
      missingFields,
      Object.keys(entry),
    )
  }
  return {
    ..._.pick(entry, serviceIDFields.sort()),
    [OBJECT_SERVICE_ID]: toServiceIdsString({
      [OBJECT_NAME]: typeID.getFullName(),
    }),
  }
}

export const serviceIDKeyCreator =
  ({ serviceIDFields, typeID }: { serviceIDFields: string[]; typeID: ElemID }): ((entry: Values) => string) =>
  entry =>
    safeJsonStringify(createServiceIDs({ entry, serviceIDFields, typeID }))

/**
 * Returns the name part of an elemId based on the provided name mapping options, which can be
 * either a built-in name mapping option or a custom name mapping option.
 * If the name mapping option or the relevant custom mapping is not provided,
 * the function returns the name as is, after converting it to a string.
 */
export const getNameMapping = <TCustomNameMappingOptions extends string = never>({
  name,
  customNameMappingFunctions,
  nameMapping,
}: {
  name: unknown
  customNameMappingFunctions?: NameMappingFunctionMap<TCustomNameMappingOptions>
  nameMapping?: TCustomNameMappingOptions | NameMappingOptions
}): string => {
  if (!nameMapping) {
    return String(name)
  }

  const nameMappingFunctions = {
    ...DEFAULT_NAME_MAPPING_FUNCTIONS,
    ...customNameMappingFunctions,
    // Unfortunately, TypeScript doesn't recognize that a union of NameMappingOptions and
    // Exclude<TCustomNameMappingOptions, NameMappingOptions> is equivalent to
    // NameMappingOptions | TCustomNameMappingOptions. Therefore, explicit casting is necessary :(
  } as Record<NameMappingOptions | TCustomNameMappingOptions, NameMappingFunction>

  const requestedMappingFunction = nameMappingFunctions[nameMapping]
  if (requestedMappingFunction) {
    return requestedMappingFunction(name)
  }
  log.warn('No name mapping function found for %s', nameMapping)
  return String(name)
}

const computeElemIDPartsFunc =
  <TCustomNameMappingOptions extends string = never>(
    elemIDDef: ElemIDDefinition<TCustomNameMappingOptions>,
    customNameMappingFunctions?: NameMappingFunctionMap<TCustomNameMappingOptions>,
  ): PartsCreator =>
  ({ entry, parent }) => {
    const parts = (elemIDDef.parts ?? [])
      .filter(part => part.condition === undefined || part.condition(entry))
      .map(part => {
        if (part.custom !== undefined) {
          return part.custom(part)(entry)
        }
        return getNameMapping({
          name: _.get(entry, part.fieldName) ?? '',
          nameMapping: part.mapping,
          customNameMappingFunctions,
        })
      })
    const nonEmptyParts = parts.filter(lowerdashValues.isDefined).filter(part => part.length > 0)

    const res =
      elemIDDef.extendsParent && parent !== undefined
        ? // the delimiter between parent and child will be doubled
          [invertNaclCase(parent.elemID.name), '', ...nonEmptyParts]
        : nonEmptyParts

    if (nonEmptyParts.length < parts.length) {
      log.trace(
        'omitted %d/%d empty elem id parts, remaining parts are %s',
        parts.length - nonEmptyParts.length,
        parts.length,
        res,
      )
    }

    return res
  }

export const createElemIDFunc =
  <TCustomNameMappingOptions extends string = never>({
    elemIDDef,
    getElemIdFunc,
    serviceIDDef,
    typeID,
    singleton,
    customNameMappingFunctions,
  }: ElemIDCreatorArgs<TCustomNameMappingOptions>): ElemIDCreator =>
  args => {
    if (singleton) {
      return ElemID.CONFIG_NAME
    }

    // if the calculated name is empty ,fallback to the provided default name
    const computedName = naclCase(
      computeElemIDPartsFunc(elemIDDef, customNameMappingFunctions)(args).join(elemIDDef.delimiter ?? ID_SEPARATOR) ||
        args.defaultName,
    )
    if (getElemIdFunc && serviceIDDef !== undefined) {
      const { entry } = args
      const { adapter: adapterName } = typeID
      return getElemIdFunc(
        adapterName,
        createServiceIDs({ entry, serviceIDFields: serviceIDDef, typeID }),
        computedName,
      ).name
    }
    return computedName
  }

export const getElemPath =
  <TCustomNameMappingOptions extends string = never>({
    def,
    elemIDCreator,
    typeID,
    singleton,
    nestUnderPath,
    createSelfFolder,
    customNameMappingFunctions,
  }: {
    def: PathDefinition<TCustomNameMappingOptions> | undefined
    elemIDCreator: ElemIDCreator
    typeID: ElemID
    singleton?: boolean
    nestUnderPath?: string[]
    createSelfFolder?: boolean
    customNameMappingFunctions?: NameMappingFunctionMap<TCustomNameMappingOptions>
  }): PartsCreator =>
  ({ entry, parent, defaultName }) => {
    if (singleton) {
      return [typeID.adapter, RECORDS_PATH, SETTINGS_NESTED_PATH, pathNaclCase(typeID.typeName)]
    }
    const basicPathParts = def?.pathParts
      ?.map(part =>
        computeElemIDPartsFunc(
          part,
          customNameMappingFunctions,
        )({ entry, parent, defaultName }).join(part.delimiter ?? ID_SEPARATOR),
      )
      .map(naclCase) ?? [elemIDCreator({ entry, parent, defaultName })]
    const pathParts = basicPathParts.map(pathNaclCase)

    const { adapter: adapterName, typeName } = typeID
    const lastPart = pathParts[pathParts.length - 1]
    return [
      adapterName,
      RECORDS_PATH,
      ...(nestUnderPath ?? [pathNaclCase(typeName)]),
      ...pathParts,
      ...(createSelfFolder && lastPart ? [lastPart] : []),
    ]
  }
