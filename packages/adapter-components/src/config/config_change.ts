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
import { InstanceElement, ElemID, ObjectType } from '@salto-io/adapter-api'

import { formatConfigSuggestionsReasons } from '@salto-io/adapter-utils'
import { ConfigChangeSuggestion } from './shared'


const { makeArray } = collections.array
const FETCH_CONFIG = 'fetch'

export const getConfigFromConfigChanges = (
  configChanges: ConfigChangeSuggestion[],
  currentConfig: InstanceElement,
  configType: ObjectType,
  adapterName: string,
): { config: InstanceElement[]; message: string } | undefined => {
  const typesToRemove = makeArray(configChanges).map(e => e.typeToExclude)

  if (typesToRemove.length === 0) {
    return undefined
  }
  const stopManagingItmesMsg = `Salto failed to fetch some items from ${adapterName}. Failed items must be excluded from the fetch.`

  return {
    config: [new InstanceElement(
      ElemID.CONFIG_NAME,
      configType,
      {
        ...currentConfig.value,
        fetch: {
          ...currentConfig.value[FETCH_CONFIG],
          exclude: [
            ...currentConfig.value[FETCH_CONFIG].exclude,
            ...typesToRemove.map(type => ({ type })),
          ],
        },
      },
    )],
    message: formatConfigSuggestionsReasons([stopManagingItmesMsg]),
  }
}
