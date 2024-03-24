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
import { logger } from '@salto-io/logging'
import { getParsedSchemas } from './parser'
import { OpenAPIDefinition } from '../../../definitions/system/sources'
import { defineAdditionalTypes } from '../../../elements/swagger/type_elements/type_config_override'
import { typeAdder } from '../../../elements/swagger/type_elements/element_generator'

const log = logger(module)

/**
 * Generate types for the given OpenAPI definitions
 */
export const generateOpenApiTypes = async ({
  adapterName,
  openApiDefs,
}: {
  adapterName: string
  openApiDefs: Omit<OpenAPIDefinition<never>, 'toClient'>
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

  return definedTypes
}
