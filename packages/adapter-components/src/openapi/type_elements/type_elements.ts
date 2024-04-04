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
import { ObjectType, TypeMap } from '@salto-io/adapter-api'
import { pathNaclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { getParsedSchemas } from '../parser'
import { OpenAPIDefinition } from '../../definitions/system/sources'
import { defineAdditionalTypes } from './type_config_override'
import { typeAdder } from './element_generator'
import { ElementAndResourceDefFinder } from '../../definitions/system/fetch/types'
import { FetchApiDefinitionsOptions } from '../../definitions/system/fetch'
import { TYPES_PATH, SUBTYPES_PATH } from '../../fetch/element/constants'

const log = logger(module)

/**
 * openAPI types are created under the subtypes folder, modify path of top level instances to be under the types folder
 */
const adjustTypesPath = <Options extends FetchApiDefinitionsOptions>(
  adapterName: string,
  types: ObjectType[],
  defQuery: ElementAndResourceDefFinder<Options>,
): void => {
  const topLevelTypes = _.mapValues(defQuery.getAll(), def => def.element?.topLevel?.isTopLevel ?? false)
  types.forEach(type => {
    type.path = topLevelTypes[type.elemID.name]
      ? [adapterName, TYPES_PATH, pathNaclCase(type.elemID.name)]
      : [adapterName, TYPES_PATH, SUBTYPES_PATH, pathNaclCase(type.elemID.name), pathNaclCase(type.elemID.name)]
  })
}

/**
 * Generate types for the given OpenAPI definitions
 */
export const generateOpenApiTypes = async <Options extends FetchApiDefinitionsOptions>({
  adapterName,
  openApiDefs,
  defQuery,
}: {
  adapterName: string
  openApiDefs: Omit<OpenAPIDefinition<never>, 'toClient'>
  defQuery: ElementAndResourceDefFinder<Options>
}): Promise<TypeMap> => {
  const { url: swaggerPath, endpointsOnly } = openApiDefs
  if (endpointsOnly) {
    log.debug('Skipping types generation for openAPI: %s, as only endpoints are required', swaggerPath)
    return {}
  }

  const typeAdjustments = openApiDefs.typeAdjustments ?? {}
  const adjustmentsWithTargetType = Object.entries(typeAdjustments).map(([targetTypeName, sourceDefs]) => ({
    targetTypeName,
    ...sourceDefs,
  }))
  const adjustmentsByOriginalType = _.groupBy(adjustmentsWithTargetType, entry => entry.originalTypeName)

  Object.entries(adjustmentsByOriginalType).forEach(([originalTypeName, entries]) => {
    if (entries.some(({ rename }) => rename) && entries.some(({ rename }) => !rename)) {
      throw new Error(`type ${originalTypeName} cannot be both renamed and cloned`)
    }
  })

  const getTypeName = (schemaName: string): string => {
    const renameDefinitions = adjustmentsByOriginalType[schemaName]?.find(entry => entry.rename)
    return renameDefinitions?.targetTypeName ?? schemaName
  }

  const definedTypes: Record<string, ObjectType> = {}

  const { schemas, refs } = await getParsedSchemas({ swaggerPath })

  const addType = typeAdder({
    adapterName,
    schemas,
    toUpdatedResourceName: getTypeName,
    definedTypes,
    parsedConfigs: {},
    refs,
    naclCaseFields: true,
  })

  Object.entries(schemas).forEach(([typeName, schema]) => addType(schema, typeName))

  const typesToClone = adjustmentsWithTargetType
    .filter(def => !def.rename)
    .map(({ targetTypeName, originalTypeName }) => ({ typeName: targetTypeName, cloneFrom: originalTypeName }))

  defineAdditionalTypes(adapterName, typesToClone, definedTypes)
  adjustTypesPath(adapterName, Object.values(definedTypes), defQuery)

  return definedTypes
}
