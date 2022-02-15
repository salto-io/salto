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
import { Field, isInstanceElement, ListType } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { findObject } from '../../utils'
import { FilterCreator } from '../../filter'
import { WORKFLOW_RULES_TYPE_NAME, WORKFLOW_TYPE_NAME } from '../../constants'
import { isWorkflowInstance } from './types'
import { triggerType } from './triggers_types'
import { getTransitionKey } from './transition_ids_filter'

const log = logger(module)


const filter: FilterCreator = ({ client, config }) => ({
  onFetch: async elements => {
    if (!config.client.usePrivateAPI) {
      log.debug('Skipping triggers filter because private API is not enabled')
      return
    }

    elements.push(triggerType)

    const workflowRulesType = findObject(elements, WORKFLOW_RULES_TYPE_NAME)
    if (workflowRulesType === undefined) {
      log.warn(`${WORKFLOW_RULES_TYPE_NAME} type not found`)
    } else {
      workflowRulesType.fields.triggers = new Field(
        workflowRulesType,
        'triggers',
        new ListType(triggerType),
      )
    }

    await Promise.all(elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
      .filter(isWorkflowInstance)
      .filter(workflow => workflow.value.name !== undefined)
      .map(async instance => {
        const transitionIds = instance.value.transitionIds ?? {}

        await Promise.all(
          (instance.value.transitions ?? []).map(async transition => {
            const transitionId = transitionIds[getTransitionKey(transition)]
            if (transitionId === undefined) {
              log.warn(`Did not find transition id of transition ${safeJsonStringify(transition)}`)
              return
            }

            const response = await client.getSinglePage({
              url: '/rest/triggers/1.0/workflow/config',
              queryParams: {
                workflowName: instance.value.name as string,
                actionId: transitionId,
              },
            })

            if (!Array.isArray(response.data)) {
              log.warn(`Unexpected triggers response from Jira: ${safeJsonStringify(response.data)}`)
              return
            }

            _.set(transition, ['rules', 'triggers'], response.data.map(trigger => _.omit(trigger, 'id')))
          })
        )
      }))
  },
})

export default filter
