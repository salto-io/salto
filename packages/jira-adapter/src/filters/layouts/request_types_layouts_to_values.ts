/*
 *                      Copyright 2024 Salto Labs Ltd.
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
  CORE_ANNOTATIONS,
  Field,
  InstanceElement,
  Value,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isObjectType,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { ISSUE_VIEW_TYPE, REQUEST_FORM_TYPE, REQUEST_TYPE_NAME } from '../../constants'
import { RequestTypeWithIssueLayoutConfigInstance } from './layout_types'
import { convertPropertiesToList, convertPropertiesToMap } from '../../utils'

const log = logger(module)
const LAYOUT_TYPES_TO_ADJUST = [REQUEST_FORM_TYPE, ISSUE_VIEW_TYPE]

const isRequestTypeWithIssueLayoutConfigInstance = (
  instance: InstanceElement,
): instance is RequestTypeWithIssueLayoutConfigInstance =>
  instance.elemID.typeName === REQUEST_TYPE_NAME &&
  instance.value.requestForm?.issueLayoutConfig?.items !== undefined &&
  _.isArray(instance.value.requestForm.issueLayoutConfig.items)

/*
 * This filter is responsible for adding the requestForm and issueView fields to the requestType
 * we initially fetch the layouts as instances to re use the logic of the layout filter
 */
const filter: FilterCreator = ({ config }) => ({
  name: 'requestTypelayoutsToValuesFilter',
  onFetch: async elements => {
    if (!config.fetch.enableJSM) {
      return
    }
    const objectTypes = elements.filter(isObjectType)
    const requestTypeType = objectTypes.find(e => e.elemID.typeName === REQUEST_TYPE_NAME)
    const requestFormType = objectTypes.find(e => e.elemID.typeName === REQUEST_FORM_TYPE)
    const issueViewType = objectTypes.find(e => e.elemID.typeName === ISSUE_VIEW_TYPE)
    if (requestTypeType === undefined || requestFormType === undefined || issueViewType === undefined) {
      log.warn('Feild to find requestTypeType or requestFormType or issueViewType')
      return
    }
    requestTypeType.fields.requestForm = new Field(requestTypeType, 'requestForm', requestFormType)
    requestTypeType.fields.requestForm.annotations = {
      [CORE_ANNOTATIONS.UPDATABLE]: true,
      [CORE_ANNOTATIONS.CREATABLE]: true,
    }
    requestTypeType.fields.issueView = new Field(requestTypeType, 'issueView', issueViewType)
    requestTypeType.fields.issueView.annotations = {
      [CORE_ANNOTATIONS.UPDATABLE]: true,
      [CORE_ANNOTATIONS.CREATABLE]: true,
    }

    const layouts = _.remove(elements, e => LAYOUT_TYPES_TO_ADJUST.includes(e.elemID.typeName) && isInstanceElement(e))
    layouts.filter(isInstanceElement).forEach(layout => {
      const requestType = layout.value.extraDefinerId?.value
      if (requestType.elemID.typeName !== REQUEST_TYPE_NAME) {
        log.warn('requestType is not of type requestType')
        return
      }
      delete layout.value.extraDefinerId
      delete layout.value.projectId
      if (layout.elemID.typeName === REQUEST_FORM_TYPE) {
        if (layout.value.issueLayoutConfig?.items !== undefined && _.isArray(layout.value.issueLayoutConfig.items)) {
          convertPropertiesToList(layout.value.issueLayoutConfig.items.map((item: Value) => item.data ?? {}))
        }
        requestType.value.requestForm = layout.value
      } else {
        requestType.value.issueView = layout.value
      }
      requestType.value.avatarId = requestType.value.icon.id
    })
  },
  preDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(isRequestTypeWithIssueLayoutConfigInstance)
      .forEach(instance => {
        convertPropertiesToMap(instance.value.requestForm.issueLayoutConfig.items.map(item => item.data ?? {}))
      })
  },
  onDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(isRequestTypeWithIssueLayoutConfigInstance)
      .forEach(instance => {
        convertPropertiesToList(instance.value.requestForm.issueLayoutConfig.items.map(item => item.data ?? {}))
      })
  },
})
export default filter
