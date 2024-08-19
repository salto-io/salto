/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  SeverityLevel,
  CORE_ANNOTATIONS,
  isAdditionChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { getParent, hasValidParent } from '@salto-io/adapter-utils'
import { QUEUE_TYPE } from '../constants'
import { JiraConfig } from '../config/config'

const { awu } = collections.asynciterable

/*
 * This validator prevents the addition of a queue with the same name as another queue in the same project.
 */
export const defaultAdditionQueueValidator: (config: JiraConfig) => ChangeValidator =
  config => async (changes, elementsSource) => {
    if (elementsSource === undefined || !config.fetch.enableJSM) {
      return []
    }

    const projectToQueues = await awu(await elementsSource.list())
      .filter(id => id.typeName === QUEUE_TYPE && id.idType === 'instance')
      .map(id => elementsSource.get(id))
      .filter(queue => isReferenceExpression(queue.annotations[CORE_ANNOTATIONS.PARENT]?.[0]))
      .groupBy(queue => queue.annotations[CORE_ANNOTATIONS.PARENT][0].elemID.getFullName())

    return awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === QUEUE_TYPE)
      .filter(queue => hasValidParent(queue))
      .filter(async instance => {
        const relatedQueues = projectToQueues[getParent(instance).elemID.getFullName()]
        return relatedQueues.filter(relatedQueue => relatedQueue.value.name === instance.value.name).length > 1
      })
      .map(instance => ({
        elemID: instance.elemID,
        severity: 'Error' as SeverityLevel,
        message: 'Cannot deploy queue, because queues names must be unique',
        detailedMessage: `Cannot deploy this queue, as it has the same name as another queue in project ${getParent(instance).elemID.name}.`,
      }))
      .toArray()
  }
