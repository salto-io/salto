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
import { Element } from '@salto-io/adapter-api'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { TypeConfig } from '../config'

const { isDefined } = lowerdashValues

/**
 * Helper for fetch orchestration - concurrently fetch elements for the types specified in the
 * configuration, allowing one level of dependencies between the type's endpoints based on the
 * dependsOn field.
 */
export const getElementsWithContext = async <E extends Element>({
  includeTypes,
  types,
  typeElementGetter,
}: {
  includeTypes: string[]
  types: Record<string, TypeConfig>
  typeElementGetter: (args: {
    typeName: string
    contextElements?: Record<string, E[]>
  }) => Promise<E[]>
}): Promise<E[]> => {
  // for now assuming flat dependencies for simplicity.
  // will replace with a DAG (with support for concurrency) when needed
  const [independentEndpoints, dependentEndpoints] = _.partition(
    includeTypes,
    typeName => _.isEmpty(types[typeName]?.request?.dependsOn)
  ).map(list => new Set(list))

  // some type requests need to extract context and parameters from other types -
  // if these types are not listed in the includeTypes, they will be fetched but not persisted
  const additionalContextTypes: string[] = [...dependentEndpoints]
    .flatMap(typeName => types[typeName].request?.dependsOn?.map(({ from }) => from.type))
    .filter(isDefined)
    .filter(typeName => !independentEndpoints.has(typeName))

  const contextElements: Record<string, {
    elements: E[]
    // if the type is only fetched as context for another type, do not persist it
    persistInstances: boolean
  }> = Object.fromEntries(await Promise.all(
    [...independentEndpoints, ...additionalContextTypes].map(async typeName =>
      [
        typeName,
        {
          elements: await typeElementGetter({ typeName }),
          persistInstances: independentEndpoints.has(typeName),
        },
      ])
  ))
  const dependentElements = await Promise.all(
    [...dependentEndpoints].map(async typeName => typeElementGetter({
      typeName,
      contextElements: _.mapValues(contextElements, val => val.elements),
    }))
  )

  return [
    ...Object.values(contextElements)
      .flatMap(({ persistInstances, elements }) => (persistInstances
        ? elements
        : [])),
    ...dependentElements.flat(),
  ]
}
