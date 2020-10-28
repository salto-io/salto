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
import { FilterWith } from '../filter'
import { apiName, metadataType } from '../transformers/transformer'
import { PROFILE_METADATA_TYPE } from '../constants'

const metadataTypeToApiNameToFilename: Map<string, Map<string, string>> = new Map([
  [PROFILE_METADATA_TYPE, new Map([
    ['Admin', 'System_Administrator'],
    ['PlatformPortal', 'Standard_Platform_User'],
    ['HighVolumePortal', 'High_Volume_Customer_Portal'],
    ['MarketingProfile', 'Marketing_User'],
    ['Standard', 'Standard_User'],
    ['StandardAul', 'Standard_Platform_User'],
  ])],
])

const replacePath = (instance: InstanceElement): void => {
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
const filterCreator = (): FilterWith<'onFetch'> => ({
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .forEach(replacePath)
  },
})

export default filterCreator
