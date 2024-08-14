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
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceElement,
  isReferenceExpression,
  Value,
} from '@salto-io/adapter-api'
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { isWorkflowV2Instance } from './types'
import { createTransitionReference, getTransitionIdToKeyMap } from '../../common/workflow/transitions'

const TRANSITION_KEYS = (): string[] => ['approval.transition.approved', 'approval.transition.rejected']

type KeyValue = {
  key: string
  value: string
}

const KEY_VALUE_SCHEME = Joi.object({
  key: Joi.string().required(),
  value: Joi.string().required(),
})

const isKeyValue = createSchemeGuard<KeyValue>(KEY_VALUE_SCHEME)

// this filter adds transition references to status properties. Currently the infra does not support it in the reference mapping
const filter: FilterCreator = ({ config }) => ({
  name: 'statusPropertiesReferencesFilter',
  onFetch: async elements => {
    elements
      .filter(isInstanceElement)
      .filter(isWorkflowV2Instance)
      .forEach(workflowInstance => {
        const transitionIdsToKeyMap = getTransitionIdToKeyMap(workflowInstance)
        workflowInstance.value.statuses.forEach(status => {
          status.properties
            ?.filter(isKeyValue)
            .filter((property: KeyValue) => TRANSITION_KEYS().includes(property.key))
            .forEach((property: Value) => {
              property.value = createTransitionReference({
                workflowInstance,
                transitionId: property.value,
                enableMissingReferences: config.fetch.enableMissingReferences ?? true,
                transitionKey: transitionIdsToKeyMap.get(property.value),
              })
            })
        })
      })
  },
  preDeploy: async changes => {
    changes
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(isInstanceElement)
      .filter(isWorkflowV2Instance)
      .forEach(workflowInstance => {
        workflowInstance.value.statuses.forEach(status => {
          status.properties
            ?.filter((property: Value) => TRANSITION_KEYS().includes(property.key))
            .filter((property: Value) => isReferenceExpression(property.value))
            .forEach((property: Value) => {
              property.value = workflowInstance.value.transitions[property.value.elemID.name].id
            })
        })
      })
  },
  onDeploy: async changes => {
    changes
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(isInstanceElement)
      .filter(isWorkflowV2Instance)
      .forEach(workflowInstance => {
        const transitionIdsToKeyMap = getTransitionIdToKeyMap(workflowInstance)
        workflowInstance.value.statuses.forEach(status => {
          status.properties
            ?.filter(isKeyValue)
            .filter((property: KeyValue) => TRANSITION_KEYS().includes(property.key))
            .forEach((property: Value) => {
              property.value = createTransitionReference({
                workflowInstance,
                transitionId: property.value,
                enableMissingReferences: config.fetch.enableMissingReferences ?? true,
                transitionKey: transitionIdsToKeyMap.get(property.value),
              })
            })
        })
      })
  },
})

export default filter
