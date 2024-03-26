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
import { logger } from '@salto-io/logging'
import { ElementsAndErrors } from '../../definitions/system/fetch/element'
import { generateType } from './type_element'
import { createInstance, getInstanceCreationFunctions, recursiveNaclCase } from './instance_utils'
import { extractStandaloneInstances } from './standalone'
import { GenerateTypeArgs } from '../../definitions/system/fetch/types'
import { InvalidSingletonType } from '../../config/shared' // TODO move
import { FetchApiDefinitionsOptions } from '../../definitions/system/fetch'

const log = logger(module)

/**
 * Create all intsances with initial types, including standalone instances, for the given typename and entries.
 * Note: it is recommended to re-generate types after all instances of all types have been created,
 * since there might be some overlaps between subtypes.
 */
export const generateInstancesWithInitialTypes = <Options extends FetchApiDefinitionsOptions>(
  args: Omit<GenerateTypeArgs<Options>, 'parentName' | 'isMapWithDynamicType' | 'typeNameOverrides'>,
): ElementsAndErrors => {
  const { defQuery, entries, adapterName, typeName, getElemIdFunc, customNameMappingFunctions, definedTypes } = args
  const { element: elementDef } = defQuery.query(typeName) ?? {}
  if (elementDef === undefined) {
    log.error('could not find any element definitions for type %s:%s', adapterName, typeName)
  }
  if (!elementDef?.topLevel?.isTopLevel) {
    const error = `type ${adapterName}:${typeName} is not defined as top-level, cannot create instances`
    throw new Error(error)
  }
  if (elementDef.topLevel?.custom !== undefined) {
    log.info('found custom override for type %s:%s, using it to generate instances and types', adapterName, typeName)
    return elementDef?.topLevel?.custom(elementDef)(args)
  }

  if (elementDef.topLevel.singleton && entries.length !== 1) {
    log.warn(`Expected one instance for singleton type: ${typeName} but received: ${entries.length}`)
    throw new InvalidSingletonType(
      `Could not fetch type ${typeName}, singleton types should not have more than one instance`,
    )
  }

  // create a temporary type recursively so we can correctly extract standalone instances
  // note that all types should be re-generated at the end once instance values have been finalized
  const { type, nestedTypes } = generateType(args)
  const { toElemName, toPath } = getInstanceCreationFunctions({
    defQuery,
    type,
    getElemIdFunc,
    customNameMappingFunctions,
  })

  const instances = entries
    .map(value => recursiveNaclCase(value))
    .map((entry, index) =>
      createInstance({
        entry,
        type,
        toElemName,
        toPath,
        // TODO pick better default name, include service id
        defaultName: `unnamed_${index}`,
      }),
    )

  // TODO filter instances by fetch query before extracting standalone fields (SALTO-5425)

  const instancesWithStandalone = extractStandaloneInstances({
    adapterName,
    instances,
    defQuery,
    getElemIdFunc,
    customNameMappingFunctions,
    definedTypes,
  })

  return { types: [type, ...nestedTypes], instances: instancesWithStandalone }
}
