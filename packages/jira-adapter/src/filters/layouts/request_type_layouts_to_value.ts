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
import { FilterCreator } from '../../filter'
import { ISSUE_VIEW_TYPE, REQUEST_FORM_TYPE } from '../../constants'

const supportedTypes = [REQUEST_FORM_TYPE, ISSUE_VIEW_TYPE]

const filter: FilterCreator = ({ config }) => ({
  name: 'requestTypelayoutsToValuesFilter',
  onFetch: async elements => {
    if (!config.fetch.enableJSM) {
      return
    }
    elements.filter(isInstanceElement)
      .filter(e => supportedTypes.includes(e.elemID.typeName))
      .forEach(layout => {
        const requestType = layout.value.extraDefinerId.value
        if (layout.elemID.typeName === REQUEST_FORM_TYPE) {
          requestType.value.requestForm = layout.value.issueLayoutConfig
        } else {
          requestType.value.issueView = layout.value.issueLayoutConfig
        }
        elements.splice(elements.indexOf(layout), 1)
      })
  },
})
export default filter
