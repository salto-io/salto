/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, Field, isInstanceElement, ListType } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import _ from 'lodash'
import Joi from 'joi'
import { findObject } from '../../utils'
import { FilterCreator } from '../../filter'
import { WORKFLOW_RULES_TYPE_NAME } from '../../constants'
import { isWorkflowV1Instance, triggerSchema } from './types'
import { triggerType } from './triggers_types'

const log = logger(module)

const isValidResponse = (
  response: unknown,
): response is Array<{ key?: string; configuration?: Record<string, unknown> }> => {
  const { error } = Joi.array().items(triggerSchema).required().validate(response)

  if (error !== undefined) {
    log.warn(`Unexpected triggers response from Jira: ${error}. ${safeJsonStringify(response)}`)
    return false
  }
  return true
}

const filter: FilterCreator = ({ client, config }) => ({
  name: 'triggersFilter',
  onFetch: async elements => {
    if (!config.client.usePrivateAPI) {
      log.debug('Skipping triggers filter because private API is not enabled')
      return
    }

    elements.push(triggerType)

    const workflowRulesType = findObject(elements, WORKFLOW_RULES_TYPE_NAME)
    if (workflowRulesType !== undefined) {
      workflowRulesType.fields.triggers = new Field(workflowRulesType, 'triggers', new ListType(triggerType), {
        [CORE_ANNOTATIONS.CREATABLE]: true,
      })
    }

    const failedWorkflowsIds = new Set<string>()
    await Promise.all(
      elements
        .filter(isInstanceElement)
        .filter(isWorkflowV1Instance)
        .filter(workflow => workflow.value.name !== undefined)
        .map(async instance => {
          try {
            await Promise.all(
              (Object.values(instance.value.transitions) ?? []).map(async transition => {
                if (transition.id === undefined) {
                  log.warn(`Did not find transition id of transition ${safeJsonStringify(transition)}`)
                  return
                }

                const response = await client.getPrivate({
                  url: '/rest/triggers/1.0/workflow/config',
                  queryParams: {
                    workflowName: instance.value.name as string,
                    actionId: transition.id,
                  },
                })

                if (!isValidResponse(response.data)) {
                  return
                }

                _.set(
                  transition,
                  ['rules', 'triggers'],
                  response.data.map(trigger => _.omit(trigger, 'id')),
                )
              }),
            )
          } catch {
            log.warn(`Failed to add triggers to workflow, removing ${instance.elemID.getFullName()}`)
            failedWorkflowsIds.add(instance.elemID.getFullName())
          }
        }),
    )

    _.remove(elements, element => failedWorkflowsIds.has(element.elemID.getFullName()))
  },
})

export default filter
