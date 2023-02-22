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

import { walkOnValue } from '@salto-io/adapter-utils'
import { isInstanceElement, Element, isInstanceChange, isAdditionOrModificationChange, getChangeData } from '@salto-io/adapter-api'
import { FilterCreator } from '../../filter'
import { WORKFLOW_TYPE_NAME } from '../../constants'
import { decodeDcFields, encodeDcFields } from './workflow_scripts_dc'
import { decodeCloudFields, encodeCloudFields } from './workflow_scripts'


const filter: FilterCreator = ({ client, config }) => ({
  name: 'scriptRunnerWorkflowDcFilter',
  onFetch: async (elements: Element[]) => {
    if (!config.fetch.enableScriptRunnerAddon) {
      return
    }
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
      .forEach(instance => {
        walkOnValue({ elemId: instance.elemID.createNestedID('transitions'),
          value: instance.value.transitions,
          func: client.isDataCenter
            ? decodeDcFields
            : decodeCloudFields })
      })
  },
  preDeploy: async changes => {
    if (!config.fetch.enableScriptRunnerAddon) {
      return
    }
    changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
      .forEach(instance => {
        walkOnValue({ elemId: instance.elemID.createNestedID('transitions'),
          value: instance.value.transitions,
          func: client.isDataCenter
            ? encodeDcFields
            : encodeCloudFields })
      })
  },
  onDeploy: async changes => {
    if (!config.fetch.enableScriptRunnerAddon) {
      return
    }
    changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
      .forEach(instance => {
        walkOnValue({ elemId: instance.elemID.createNestedID('transitions'),
          value: instance.value.transitions,
          func: client.isDataCenter
            ? decodeDcFields
            : decodeCloudFields })
      })
  },
})

export default filter
