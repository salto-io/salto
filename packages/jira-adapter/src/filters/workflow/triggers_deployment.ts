/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { AdditionChange, getChangeData } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import JiraClient from '../../client/client'
import { WorkflowV1Instance } from './types'

const { awu } = collections.asynciterable

const log = logger(module)

export const deployTriggers = async (change: AdditionChange<WorkflowV1Instance>, client: JiraClient): Promise<void> => {
  const instance = getChangeData(change)

  const workflowName = instance.value.name
  // We never supposed to get here
  if (workflowName === undefined) {
    throw new Error('Cannot deploy a workflow without a name')
  }

  await awu(Object.values(instance.value.transitions) ?? []).forEach(async transition => {
    const transitionId = transition.id

    if (transitionId === undefined) {
      log.error(
        `Could not find the id of the transition ${transition.name} to deploy: ${safeJsonStringify(instance.value)}`,
      )
      throw new Error('Could not find the id of the transition to deploy')
    }

    await awu(transition.rules?.triggers ?? []).forEach(async trigger => {
      await client.putPrivate({
        url: '/rest/triggers/1.0/workflow/config',
        queryParams: {
          workflowName,
          actionId: transitionId,
        },
        data: {
          definitionConfig: trigger.configuration,
          triggerDefinitionKey: trigger.key,
        },
      })
    })
  })
}
