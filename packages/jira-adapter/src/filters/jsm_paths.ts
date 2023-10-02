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

import { SeverityLevel, isInstanceElement } from '@salto-io/adapter-api'
import { getParent, pathNaclCase } from '@salto-io/adapter-utils'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { CALENDAR_TYPE, QUEUE_TYPE, PORTAL_GROUP_TYPE, REQUEST_TYPE_NAME } from '../constants'

const { isDefined } = lowerDashValues

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
      return undefined
    }
    const fetchResults = elements
      .filter(isInstanceElement)
      .filter(instance => Object.keys(JSM_ELEMENT_DIRECTORY).includes(instance.elemID.typeName))
      .map(inst => {
        const parent = getParent(inst)
        const parentPath = parent.path
        if (parentPath === undefined) {
          return {
            message: `Failed to find parent path for ${inst.elemID.getFullName()}`,
            severity: 'Warning' as SeverityLevel,
          }
        }
        const dirName = JSM_ELEMENT_DIRECTORY[inst.elemID.typeName]
        inst.path = [...parentPath.slice(0, -1), dirName, pathNaclCase(inst.elemID.name)]
        return undefined
      })
    const errors = fetchResults.filter(isDefined)
    return { errors }
  },
})
export default filter
