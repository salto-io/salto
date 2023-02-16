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
import { FilterResult, RemoteFilterCreator } from '../filter'
import { ensureSafeFilterFetch } from './utils'
import SalesforceClient from '../client/client'
import { toolingFieldApiName } from '../tooling/utils'
import {
  isInstalledSubscriberPackage,
  isSubscriberPackage,
  isToolingObject,
  ToolingObject,
} from '../tooling/types'

const { toArrayAsync } = collections.asynciterable

const WARNING_MESSAGE = 'Encountered an error while trying to fetch info about the installed packages'

const getSubscriberPackageIds = async (
  installedSubscriberPackageType: ToolingObject['InstalledSubscriberPackage'],
  client: SalesforceClient
): Promise<string[]> => {
  const subscriberPackageIdField = installedSubscriberPackageType.fields.SubscriberPackageId
  const queryIterable = await client.queryToolingObject({
    toolingObject: installedSubscriberPackageType,
    fields: [subscriberPackageIdField],
  })
  return (await toArrayAsync(queryIterable)).flat()
    .map(record => record[toolingFieldApiName(subscriberPackageIdField)])
}

const filterCreator: RemoteFilterCreator = ({ client, config }) => ({
  name: 'subscriberPackageInstancesFilter',
  onFetch: ensureSafeFilterFetch({
    filterName: 'describeSObjects',
    warningMessage: WARNING_MESSAGE,
    config,
    fetchFilterFunc: async (elements: Element[]): Promise<void | FilterResult> => {
      const toolingObjects = elements
        .filter(isObjectType)
        .filter(isToolingObject)
      const subscriberPackageType = toolingObjects.find(isSubscriberPackage)
      const installedSubscriberPackageType = toolingObjects.find(isInstalledSubscriberPackage)
      if (subscriberPackageType === undefined || installedSubscriberPackageType === undefined) {
        return
      }
      const subscriberPackageIds = await getSubscriberPackageIds(installedSubscriberPackageType, client)
      console.log(subscriberPackageIds)
    },
  }),
})


export default filterCreator
