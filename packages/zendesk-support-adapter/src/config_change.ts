/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { collections } from '@salto-io/lowerdash'
import { InstanceElement, ElemID } from '@salto-io/adapter-api'
import { elements as elementsUtils } from '@salto-io/adapter-components'

import { configType, FETCH_CONFIG } from './config'

const { makeArray } = collections.array

const MESSAGE_INTRO = 'Salto failed to fetch some items from zendesk. '
const MESSAGE_SUMMARY = 'In order to complete the fetch operation, '
+ 'Salto needs to stop managing these items by applying the following configuration change:'

export const getConfigFromConfigChanges = (
  configChanges: elementsUtils.ducktype.ConfigChangeSuggestion[],
  currentConfig: InstanceElement,
): { config: InstanceElement[]; message: string } | undefined => {
  const currentIncludeTypes = makeArray(currentConfig.value.fetch?.includeTypes)

  const typesToRemove = makeArray(configChanges).map(e => e.typeToExclude)
  const newIncludeTypes = currentIncludeTypes
    .filter(e => !typesToRemove.includes(e))

  if (_.isEqual(newIncludeTypes, currentIncludeTypes)) {
    return undefined
  }

  return {
    config: [new InstanceElement(
      ElemID.CONFIG_NAME,
      configType,
      {
        ...currentConfig.value,
        fetch: {
          ...currentConfig.value[FETCH_CONFIG],
          includeTypes: newIncludeTypes,
        },
      },
    )],
    message: [MESSAGE_INTRO, '', MESSAGE_SUMMARY].join('\n'),
  }
}
