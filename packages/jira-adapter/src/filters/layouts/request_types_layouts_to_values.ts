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

import { Field, isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { ISSUE_VIEW_TYPE, REQUEST_FORM_TYPE, REQUEST_TYPE_NAME } from '../../constants'

const supportedTypes = [REQUEST_FORM_TYPE, ISSUE_VIEW_TYPE]

const filter: FilterCreator = ({ config }) => ({
  name: 'requestTypelayoutsToValuesFilter',
  onFetch: async elements => {
    if (!config.fetch.enableJSM) {
      return
    }
    const requestTypeType = elements.filter(isObjectType).find(e => e.elemID.typeName === REQUEST_TYPE_NAME)
    const requestFormType = elements.filter(isObjectType).find(e => e.elemID.typeName === REQUEST_FORM_TYPE)
    const issueViewType = elements.filter(isObjectType).find(e => e.elemID.typeName === ISSUE_VIEW_TYPE)
    if (requestTypeType === undefined || requestFormType === undefined || issueViewType === undefined) {
      return
    }
    requestTypeType.fields.requestForm = new Field(requestTypeType, 'requestForm', requestFormType)
    requestTypeType.fields.issueView = new Field(requestTypeType, 'issueView', issueViewType)

    const layouts = _.remove(elements, e => supportedTypes.includes(e.elemID.typeName) && isInstanceElement(e))
    layouts.filter(isInstanceElement).forEach(layout => {
      const requestType = layout.value.extraDefinerId.value
      delete layout.value.extraDefinerId
      delete layout.value.projectId
      if (layout.elemID.typeName === REQUEST_FORM_TYPE) {
        requestType.value.requestForm = layout.value
      } else {
        requestType.value.issueView = layout.value
      }
    })
  },
})
export default filter
