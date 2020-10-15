/*
*                      Copyright 2020 Salto Labs Ltd.
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
import {
  Element, isInstanceElement, InstanceElement, Values, getChangeElement, Change,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { apiName, metadataType } from '../transformers/transformer'
import SalesforceClient from '../client/client'
import { getIdsForType } from './add_missing_ids'

const log = logger(module)

const metadataTypesToChange: string[] = ['ForecastingSettings']

const pathsToValues: Record<string, string[][]> = {
  Forecasting: [
    ['forecastingTypeSettings', 'opportunityListFieldsSelectedSettings', 'field'],
    ['forecastingTypeSettings', 'opportunityListFieldsUnselectedSettings', 'field'],
    ['forecastingTypeSettings', 'opportunityListFieldsLabelMappings', 'field'],
  ],
}

const getApiNameToIdLookup = async (client: SalesforceClient): Promise<Record<string, string>> => {
  const apiNameToId = await getIdsForType(client, 'CustomField')
  Object.keys(apiNameToId).forEach(k => {
    // remove last 3 chars to get a 15-char id from an 18-char id
    apiNameToId[k] = apiNameToId[k].slice(0, -3)
  })
  return apiNameToId
}

const swapKeyValue = (obj: Record<string, string>): Record<string, string> => {
  const res: Record<string, string> = {}
  Object.keys(obj).forEach(k => {
    res[obj[k]] = k
  })
  return res
}

const replaceValuesInPath = (i: number, val: Values, nameLookUp: Record<string, string>,
  path: string[]): void => {
  if (path[i] === undefined || val === undefined) {
    return
  }
  const key = path[i]
  if (_.isString(val[key])) {
    val[key] = nameLookUp[val[key]] ?? val[key]
  } else if (_.isArray(val[key])) {
    const [stringElements, objectElements] = _.partition(val[key], _.isString)

    val[key] = objectElements
    stringElements.map((s: string) => nameLookUp[s] ?? s).forEach(s => val[key].push(s))

    objectElements.forEach((element: Values) => {
      replaceValuesInPath(i + 1, element, nameLookUp, path)
    })
  } else {
    replaceValuesInPath(i + 1, val[key], nameLookUp, path)
  }
}

const replaceInstanceValues = (instance: InstanceElement,
  nameLookUp: Record<string, string>): void => {
  const name = apiName(instance)
  const allPathsForInstance = pathsToValues[name]
  allPathsForInstance.forEach(path => {
    replaceValuesInPath(0, instance.value, nameLookUp, path)
  })
}

const replaceElementsValues = (elements: Element[], nameLookUp: Record<string, string>): void => {
  elements
    .filter(isInstanceElement)
    .filter(e => metadataTypesToChange.includes(metadataType(e)))
    .forEach(e => {
      replaceInstanceValues(e, nameLookUp)
      log.debug(`replaced values of instance ${apiName(e)}`)
    })
}

/**
 * Replace specific field values that are fetched as ids, to their names.
 */
const filter: FilterCreator = ({ client }) => ({
  onFetch: async (elements: Element[]) => {
    const idToApiNameLookUp = swapKeyValue(await getApiNameToIdLookup(client))
    replaceElementsValues(elements, idToApiNameLookUp)
  },
  preDeploy: async (changes: ReadonlyArray<Change>): Promise<void> => {
    const apiNameToIdLookup = await getApiNameToIdLookup(client)
    replaceElementsValues(
      changes.map(getChangeElement),
      apiNameToIdLookup
    )
  },
  onDeploy: async changes => {
    const idToApiNameLookUp = swapKeyValue(await getApiNameToIdLookup(client))
    replaceElementsValues(
      changes.map(getChangeElement),
      idToApiNameLookUp
    )
    return []
  },
})

export default filter
