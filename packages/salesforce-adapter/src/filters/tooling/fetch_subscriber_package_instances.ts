/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { collections } from '@salto-io/lowerdash'
import { isObjectType, Element } from '@salto-io/adapter-api'
import { FilterResult, RemoteFilterCreator } from '../../filter'
import { ensureSafeFilterFetch } from '../utils'
import SalesforceClient from '../../client/client'
import {
  isSubscriberPackage,
  isToolingObject,
  ToolingObject,
} from '../../tooling/types'
import { SalesforceRecord } from '../../client/types'
import { createToolingInstance, toolingFieldApiName, toolingObjectApiName } from '../../tooling/utils'

const { awu, toArrayAsync } = collections.asynciterable

const WARNING_MESSAGE = 'Encountered an error while trying to fetch info about the installed packages'

const getSubscriberPackageRecords = async (
  subscriberPackageType: ToolingObject['SubscriberPackage'],
  client: SalesforceClient,
): Promise<SalesforceRecord[]> => {
  const subscriberPackageFields = Object.values(subscriberPackageType.fields).map(toolingFieldApiName)
  const queryResult = await client.queryAll([
    `SELECT ${subscriberPackageFields.join(', ')}`,
    'FROM InstalledSubscriberPackage',
  ].join('\n'), true)
  return (await toArrayAsync(queryResult))
    .flat()
    .map(record => record[toolingObjectApiName(subscriberPackageType)])
}

const filterCreator: RemoteFilterCreator = ({ client, config }) => ({
  name: 'fetchSubscriberPackageInstancesFilter',
  onFetch: ensureSafeFilterFetch({
    filterName: 'tooling',
    warningMessage: WARNING_MESSAGE,
    config,
    fetchFilterFunc: async (elements: Element[]): Promise<void | FilterResult> => {
      const toolingObjects = elements
        .filter(isObjectType)
        .filter(isToolingObject)
      const subscriberPackageType = toolingObjects.find(isSubscriberPackage)
      if (subscriberPackageType === undefined) {
        return
      }
      await awu(await getSubscriberPackageRecords(subscriberPackageType, client))
        .map(record => createToolingInstance(record, subscriberPackageType))
        .forEach(instance => elements.push(instance))
    },
  }),
})


export default filterCreator
