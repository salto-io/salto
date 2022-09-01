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
import { Change, Element, getChangeData, isInstanceChange, isInstanceElement } from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterCreator } from '../../filter'
import { isWorkflowInstance, WorkflowInstance } from './types'
import { WORKFLOW_TYPE_NAME } from '../../constants'
import { RESOLUTION_KEY_PATTERN } from '../../references/workflow_properties'

const { awu } = collections.asynciterable

const splitResolutionProperties = (instance: WorkflowInstance): void => {
  instance.value.transitions
    ?.filter(transition => transition.properties !== undefined)
    ?.forEach(transition => {
      transition.properties = _.mapValues(
        transition.properties,
        (value, key) => (
          new RegExp(RESOLUTION_KEY_PATTERN).test(key)
            ? value.split(',')
            : value
        ),
      )
    })
}


const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
      .filter(isWorkflowInstance)
      .forEach(splitResolutionProperties)
  },

  preDeploy: async changes => {
    await awu(changes)
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === WORKFLOW_TYPE_NAME)
      .filter(change => isWorkflowInstance(getChangeData(change)))
      .forEach(async change => {
        await applyFunctionToChangeData<Change<WorkflowInstance>>(
          change,
          async instance => {
            instance.value.transitions
              ?.filter(transition => transition.properties !== undefined)
              ?.forEach(transition => {
                transition.properties = _.mapValues(
                  transition.properties,
                  (value, key) => (
                    new RegExp(RESOLUTION_KEY_PATTERN).test(key) && Array.isArray(value)
                      ? value.join(',')
                      : value
                  ),
                )
              })
            return instance
          }
        )
      })
  },

  onDeploy: async changes => {
    await awu(changes)
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === WORKFLOW_TYPE_NAME)
      .filter(change => isWorkflowInstance(getChangeData(change)))
      .forEach(async change => {
        await applyFunctionToChangeData<Change<WorkflowInstance>>(
          change,
          instance => {
            splitResolutionProperties(instance)
            return instance
          },
        )
      })
  },
})

export default filter
