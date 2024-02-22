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
import { NameMappingOptions } from '../../definitions'
import { ElemIDCreatorArgs, ElemIDDefinition, PathDefinition } from '../../definitions/system/fetch/element'
import { RECORDS_PATH, SETTINGS_NESTED_PATH } from '../../elements/constants'

export type ElemIDCreator = (args: { entry: Values; defaultName: string; parent?: InstanceElement }) => string

export type PartsCreator = (args: { entry: Values; defaultName: string; parent?: InstanceElement }) => string[]

const ID_SEPARATOR = '_'

const log = logger(module)

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

export const getNameMapping = (name: string, nameMapping?: NameMappingOptions): string => {
  switch (nameMapping) {
    case 'lowercase':
      return name.toLowerCase()
    case 'uppercase':
      return name.toUpperCase()
    default:
      return name
  }
}

const computElemIDPartsFunc =
  (elemIDDef: ElemIDDefinition): PartsCreator =>
  ({ entry, parent }) => {
    const parts = (elemIDDef.parts ?? [])
      .filter(part => part.condition === undefined || part.condition(entry))
      .map(part => {
        if (part.custom !== undefined) {
          return part.custom(part)(entry)
        }
        return getNameMapping(String(_.get(entry, part.fieldName) ?? ''), part.mapping)
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
  ({ elemIDDef, getElemIdFunc, serviceIDDef, typeID, singleton }: ElemIDCreatorArgs): ElemIDCreator =>
  args => {
    if (singleton) {
      return ElemID.CONFIG_NAME
    }

    // if the calculated name is empty ,fallback to the provided default name
    const computedName = naclCase(
      computElemIDPartsFunc(elemIDDef)(args).join(elemIDDef.delimiter ?? ID_SEPARATOR) || args.defaultName,
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
  ({
    def,
    elemIDCreator,
    typeID,
    singleton,
    nestUnderPath,
  }: {
    def: PathDefinition | undefined
    elemIDCreator: ElemIDCreator
    typeID: ElemID
    singleton?: boolean
    nestUnderPath?: string[]
  }): PartsCreator =>
  ({ entry, parent, defaultName }) => {
    if (singleton) {
      return [typeID.adapter, RECORDS_PATH, SETTINGS_NESTED_PATH, pathNaclCase(typeID.typeName)]
    }
    const basicPathParts = def?.pathParts
      ?.map(part => computElemIDPartsFunc(part)({ entry, parent, defaultName }).join(part.delimiter ?? ID_SEPARATOR))
      .map(naclCase) ?? [elemIDCreator({ entry, parent, defaultName })]
    const pathParts = basicPathParts.map(pathNaclCase)

    const { adapter: adapterName, typeName } = typeID
    return [adapterName, RECORDS_PATH, ...(nestUnderPath ?? [pathNaclCase(typeName)]), ...pathParts]
  }
