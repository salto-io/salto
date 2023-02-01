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
import { Change, Element, getChangeData, isInstanceChange, isInstanceElement } from '@salto-io/adapter-api'
import { applyFunctionToChangeData, safeJsonStringify } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { isWorkflowInstance, WorkflowInstance } from './types'
import { RESOLUTION_KEY_PATTERN } from '../../references/workflow_properties'

const { awu } = collections.asynciterable

const log = logger(module)

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

/**
 * This filter is to transform the jira.field.resolution property from a string
 * of 'id1,id2,id3' to a list [id1, id2, id3] so we can convert it to references later
 */
const filter: FilterCreator = () => ({
  name: 'resolutionPropertyFilter',
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(isWorkflowInstance)
      .forEach(splitResolutionProperties)
  },

  preDeploy: async changes => {
    await awu(changes)
      .filter(isInstanceChange)
      .filter(change => isWorkflowInstance(getChangeData(change)))
      .forEach(async change => {
        await applyFunctionToChangeData<Change<WorkflowInstance>>(
          change,
          async instance => {
            instance.value.transitions
              ?.filter(transition => _.isPlainObject(transition.properties))
              ?.forEach(transition => {
                transition.properties = _.mapValues(
                  transition.properties,
                  (value, key) => {
                    if (!new RegExp(RESOLUTION_KEY_PATTERN).test(key)) {
                      return value
                    }
                    if (!Array.isArray(value)) {
                      log.warn(`Transition resolution property in instance ${instance.elemID.getFullName()} is not an array: ${safeJsonStringify(value)}`)
                      return value
                    }
                    return value.join(',')
                  },
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
