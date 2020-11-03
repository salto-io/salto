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
  Element, isInstanceElement, InstanceElement,
} from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator, FilterWith } from '../filter'
import { apiName, metadataType } from '../transformers/transformer'
import { PROFILE_METADATA_TYPE } from '../constants'
import SalesforceClient from '../client/client'
import { findProfileInstances } from './profile_maps'

const { toArrayAsync } = collections.asynciterable

const generateMetadataTypeToApiNameToFilename = async (
  client: SalesforceClient,
  elements: Element[],
): Promise<Map<string, Map<string, string>>> => {
  const profiles = findProfileInstances(elements)
  const profileNames = await toArrayAsync(await client.queryAll('SELECT Id, Name FROM Profile'))
  const profileNameById = new Map(
    profileNames.flat().map(profile => [profile.Id, profile.Name])
  )
  const profileFullNameToFileName = new Map(
    profiles.map(profile => {
      const filename = apiName(profile) === 'PlatformPortal'
        // Both 'PlatformPortal' & 'AuthenticatedWebsite' profiles have 'Authenticated Website'
        // display name in SF UI. Since we wouldn't like them to be placed under the same nacl,
        // We modify 'PlatformPortal' filename manually so we'll have AuthenticatedWebsite and
        // Authenticated_Website nacls.
        ? 'AuthenticatedWebsite'
        : naclCase(profileNameById.get(profile.value.internalId))
      return [apiName(profile), filename]
    })
  )
  return new Map([
    [PROFILE_METADATA_TYPE, profileFullNameToFileName],
  ])
}

const replacePath = (
  instance: InstanceElement,
  metadataTypeToApiNameToFilename: Map<string, Map<string, string>>
): void => {
  const apiNameToFilename = metadataTypeToApiNameToFilename.get(metadataType(instance))
  const filename = apiNameToFilename?.get(apiName(instance))
  if (filename && instance.path) {
    instance.path = [
      ...instance.path.slice(0, -1),
      filename,
    ]
  }
}

/**
 * replace paths for instances upon fetch
 */
const filterCreator: FilterCreator = ({ client }): FilterWith<'onFetch'> => ({
  onFetch: async (elements: Element[]) => {
    const metadataTypeToApiNameToFilename = await generateMetadataTypeToApiNameToFilename(client,
      elements)
    elements
      .filter(isInstanceElement)
      .forEach(inst => replacePath(inst, metadataTypeToApiNameToFilename))
  },
})

export default filterCreator
