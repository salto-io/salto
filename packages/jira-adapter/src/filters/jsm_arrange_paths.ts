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

import { isInstanceElement } from '@salto-io/adapter-api'
import { getParent, pathNaclCase } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { CALENDAR_TYPE, QUEUE_TYPE, PORTAL_GROUP_TYPE, REQUEST_TYPE_NAME } from '../constants'

const JSM_ELEMENT_DIRECTORY: Record<string, string> = {
  [QUEUE_TYPE]: 'queues',
  [CALENDAR_TYPE]: 'calendars',
  [REQUEST_TYPE_NAME]: 'requestTypes',
  [PORTAL_GROUP_TYPE]: 'portalGroups',
}
const filter: FilterCreator = ({ config }) => ({
  name: 'jsmArrangePathsFilter',
  onFetch: async elements => {
    if (!config.fetch.enableJSM) {
      return
    }
    const jsmInstances = elements
      .filter(isInstanceElement)
      .filter(inst => Object.keys(JSM_ELEMENT_DIRECTORY).includes(inst.elemID.typeName))
    jsmInstances.forEach(inst => {
      const parent = getParent(inst)
      const parentPath = (parent.path ?? []).slice(0, -1)
      const dirName = JSM_ELEMENT_DIRECTORY[inst.elemID.typeName]
      inst.path = [...parentPath, dirName, pathNaclCase(inst.elemID.name)]
    })
  },
})
export default filter
