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
  Element, isInstanceElement, InstanceElement, ElemID, isReferenceExpression, PostFetchOptions,
} from '@salto-io/adapter-api'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../../filter'
import { FETCH_CONFIG } from '../../config'
import { SALESFORCE, NETSUITE } from '../../constants'
import { indexSalesforceByMetadataTypeAndApiName, indexNetsuiteByTypeAndScriptId } from './element_indexes'
import { addNetsuiteRecipeReferences } from './reference_finders/netsuite'
import { addSalesforceRecipeReferences } from './reference_finders/salesforce'

const log = logger(module)
const { makeArray } = collections.array
const { toNestedTypeName } = elementUtils.ducktype

type ConnectionDetails = {
  id: ElemID
  applicationName: string
}

const getServiceConnectionNames = (
  serviceConnectionConfig: Record<string, string[]>,
  connectionInstances: InstanceElement[],
): Record<string, Record<string, ConnectionDetails>> => {
  const connectionInstanceDetails = Object.fromEntries(
    connectionInstances
      .filter(inst => _.isString(inst.value.name) && _.isString(inst.value.application))
      .map(inst => [
        inst.value.name as string,
        ({ id: inst.elemID, applicationName: inst.value.application as string }),
      ])
  )

  const connectionDetailsByService = _.mapValues(
    serviceConnectionConfig,
    connectionNames => Object.fromEntries(
      // makeArray can eventually be removed - added for short-term backward compatibility with the
      // old single-connection config format
      makeArray(connectionNames)
        .filter(name => connectionInstanceDetails[name] !== undefined)
        .map(name => [name, connectionInstanceDetails[name]]),
    )
  )
  const missingConnections = (
    Object.entries(serviceConnectionConfig).flatMap(
      ([serviceName, connectionNames]) => makeArray(connectionNames).filter(
        name => connectionDetailsByService[serviceName][name] === undefined
      )
    )
  )

  if (missingConnections.length > 0) {
    log.error('The following workato connections could not be found: %s', missingConnections)
  }

  return connectionDetailsByService
}

/**
 * Return the code parts of recipes that use the specified connection.
 * (at most one connection for each connector can be used in each recipe using standard connectors)
 */
const filterRelevantRecipeCodes = (
  connectionID: ElemID,
  recipeInstances: InstanceElement[],
  recipeCodeInstances: Record<string, InstanceElement>,
): InstanceElement[] => {
  const relevantRecipes = (
    recipeInstances
      .filter(recipe => isReferenceExpression(recipe.value.code))
      .filter(recipe => Array.isArray(recipe.value.config) && recipe.value.config.some(
        connectionConfig => (
          _.isPlainObject(connectionConfig)
          && isReferenceExpression(connectionConfig.account_id)
          && connectionID.isEqual(connectionConfig.account_id.elemId)
        )
      ))
  )
  return relevantRecipes.map(
    recipe => recipeCodeInstances[recipe.value.code.elemId.getFullName()]
  )
}

const addReferencesForConnectionRecipes = (
  relevantRecipeCodes: InstanceElement[],
  appName: string,
  serviceName: string,
  serviceElements: ReadonlyArray<Readonly<Element>>,
): void => {
  if (serviceName === SALESFORCE) {
    const index = indexSalesforceByMetadataTypeAndApiName(serviceElements)
    relevantRecipeCodes.forEach(
      inst => addSalesforceRecipeReferences(inst, index, appName)
    )
    return
  }
  if (serviceName === NETSUITE) {
    const index = indexNetsuiteByTypeAndScriptId(serviceElements)
    relevantRecipeCodes.forEach(
      inst => addNetsuiteRecipeReferences(inst, index, appName)
    )
  }
}

/**
 * Find references from recipe code blocks to other adapters in the workspace.
 */
const filter: FilterCreator = ({ config }) => ({
  onPostFetch: async ({
    currentAdapterElements,
    elementsByAdapter,
  }: PostFetchOptions): Promise<void> => {
    const { serviceConnectionNames } = config[FETCH_CONFIG]
    if (serviceConnectionNames === undefined || _.isEmpty(serviceConnectionNames)) {
      return
    }

    const serviceConnectionDetails = getServiceConnectionNames(
      serviceConnectionNames,
      currentAdapterElements
        .filter(isInstanceElement)
        .filter(inst => inst.type.elemID.name === 'connection'),
    )
    const recipeInstances = (
      currentAdapterElements
        .filter(isInstanceElement)
        .filter(inst => inst.type.elemID.name === 'recipe')
    )
    const recipeCodeInstancesByElemID = _.keyBy(
      currentAdapterElements
        .filter(isInstanceElement)
        .filter(inst => inst.type.elemID.name === toNestedTypeName('recipe', 'code')),
      inst => inst.elemID.getFullName()
    )

    Object.entries(serviceConnectionDetails).forEach(([serviceName, connections]) => {
      Object.values(connections).forEach(({ id, applicationName }) => {
        const relevantRecipeCodes = filterRelevantRecipeCodes(
          id,
          recipeInstances,
          recipeCodeInstancesByElemID,
        )
        addReferencesForConnectionRecipes(
          relevantRecipeCodes,
          applicationName,
          serviceName,
          elementsByAdapter[serviceName] ?? [],
        )
      })
    })
  },
})

export default filter
