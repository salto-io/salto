/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  ReferenceExpression,
  isReferenceExpression,
  isTemplateExpression,
} from '@salto-io/adapter-api'
import {
  elementExpressionStringifyReplacer,
  invertNaclCase,
  naclCase,
  pathNaclCase,
  safeJsonStringify,
} from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { NameMappingFunction, NameMappingFunctionMap, NameMappingOptions } from '../../definitions'
import { ElemIDCreatorArgs, ElemIDDefinition, PathDefinition } from '../../definitions/system/fetch/element'
import { RECORDS_PATH, SETTINGS_NESTED_PATH } from './constants'

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
    safeJsonStringify(createServiceIDs({ entry, serviceIDFields, typeID }), elementExpressionStringifyReplacer)

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

const getFieldValue = (entry: Values, fieldName: string, useOldFormat?: boolean): string | undefined => {
  const dereferenceFieldValue = (fieldValue: ReferenceExpression): string => {
    const { parent, path } = fieldValue.elemID.createTopLevelParentID()
    return [useOldFormat ? parent.name : invertNaclCase(parent.name), ...path].join('.')
  }

  const fieldValue = _.get(entry, fieldName)
  if (isReferenceExpression(fieldValue)) {
    return dereferenceFieldValue(fieldValue)
  }
  if (isTemplateExpression(fieldValue)) {
    return fieldValue.parts
      .map(part => (isReferenceExpression(part) ? dereferenceFieldValue(part) : _.toString(part)))
      .join('')
  }
  if (fieldValue === undefined) {
    log.debug(`could not find idField: ${fieldName}`)
    return undefined
  }
  return _.toString(fieldValue)
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
        const fieldValue = getFieldValue(entry, part.fieldName, elemIDDef.useOldFormat)
        return fieldValue !== undefined
          ? getNameMapping({
              name: fieldValue,
              nameMapping: part.mapping,
              customNameMappingFunctions,
            })
          : undefined
      })
    const nonEmptyParts = parts.filter(lowerdashValues.isDefined).filter(part => part.length > 0)

    const res =
      elemIDDef.extendsParent && parent !== undefined
        ? // the delimiter between parent and child will be doubled
          [
            elemIDDef.useOldFormat ? parent.elemID.name : invertNaclCase(parent.elemID.name),
            ...(nonEmptyParts.length > 0 ? ['', ...nonEmptyParts] : []),
          ]
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

const verifyNestedPathIncludesBaseDir = ({
  nestUnderPath,
  pathBaseDir,
  typeName,
}: {
  nestUnderPath: string[]
  pathBaseDir: string[]
  typeName: string
}): void => {
  if (!_.isEqual(pathBaseDir, nestUnderPath.slice(0, pathBaseDir.length))) {
    log.warn(
      'detected inconsistency between pathBaseDir and nestUnderPath for type %s, expected base dir to be %o, but received nested path: %o',
      typeName,
      pathBaseDir,
      nestUnderPath,
    )
  }
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
    const pathBaseDir = def?.baseDir ?? []
    if (singleton) {
      return [typeID.adapter, RECORDS_PATH, ...pathBaseDir, SETTINGS_NESTED_PATH, pathNaclCase(typeID.typeName)]
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
    const typePath = nestUnderPath ?? [...pathBaseDir, pathNaclCase(typeName)]
    if (nestUnderPath !== undefined && !_.isEmpty(pathBaseDir)) {
      verifyNestedPathIncludesBaseDir({ nestUnderPath, pathBaseDir, typeName })
    }
    return [adapterName, RECORDS_PATH, ...typePath, ...pathParts, ...(createSelfFolder && lastPart ? [lastPart] : [])]
  }
