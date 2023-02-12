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
import { Element, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { pathNaclCase, naclCase } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'

import { FilterWith, RemoteFilterCreator } from '../filter'
import { apiName } from '../transformers/transformer'
import SalesforceClient from '../client/client'
import { getInternalId, isInstanceOfType, ensureSafeFilterFetch } from './utils'
import { PROFILE_METADATA_TYPE } from '../constants'

const { awu } = collections.asynciterable

const { toArrayAsync } = collections.asynciterable

const generateProfileInternalIdToName = async (
  client: SalesforceClient,
): Promise<Map<string, string>> => {
  const profileNames = await toArrayAsync(await client.queryAll('SELECT Id, Name FROM Profile'))
  return new Map(
    profileNames.flat().map(profile => [profile.Id, profile.Name])
  )
}

const replacePath = async (
  profile: InstanceElement,
  profileInternalIdToName: Map<string, string>
): Promise<void> => {
  const name = (await apiName(profile) === 'PlatformPortal')
    // Both 'PlatformPortal' & 'AuthenticatedWebsite' profiles have 'Authenticated Website'
    // display name in SF UI. Since we wouldn't like them to be placed under the same nacl,
    // We modify 'PlatformPortal' filename manually so we'll have Authenticated_Website and
    // Authenticated_Website2 nacls.
    ? 'Authenticated Website2'
    : profileInternalIdToName.get(getInternalId(profile))
  if (name !== undefined && profile.path) {
    profile.path = [
      ...profile.path.slice(0, -1),
      pathNaclCase(naclCase(name)),
    ]
  }
}

export const WARNING_MESSAGE = 'Failed to update the NaCl file names for some of your salesforce profiles. Therefore, profiles NaCl file names might differ from their display names in some cases.'

/**
 * replace paths for profile instances upon fetch
 */
const filterCreator: RemoteFilterCreator = ({ client, config }): FilterWith<'onFetch'> => ({
  name: 'profilePathsFilter',
  onFetch: ensureSafeFilterFetch({
    warningMessage: WARNING_MESSAGE,
    config,
    filterName: 'profilePaths',
    fetchFilterFunc: async (elements: Element[]) => {
      const profiles = await awu(elements)
        .filter(async e => isInstanceOfType(PROFILE_METADATA_TYPE)(e)).toArray()
      if (profiles.length > 0) {
        const profileInternalIdToName = await generateProfileInternalIdToName(client)
        await awu(profiles)
          .filter(isInstanceElement)
          .forEach(async inst => replacePath(inst, profileInternalIdToName))
      }
    },
  }),
})

export default filterCreator
