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
import { ChangeValidator, getChangeData, isInstanceChange, SeverityLevel, isRemovalChange, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { getParent } from '@salto-io/adapter-utils'
import { QUEUE_TYPE } from '../constants'
import { JiraConfig } from '../config/config'

const { awu } = collections.asynciterable

export const deleteLastQueueValidator: (
    config: JiraConfig,
  ) => ChangeValidator = config => async (changes, elementsSource) => {
    if (elementsSource === undefined || !config.fetch.enableJSM) {
      return []
    }
    const projectToQueues = await awu(await elementsSource.list())
      .filter(id => id.typeName === QUEUE_TYPE && id.idType === 'instance')
      .map(id => elementsSource.get(id))
      .groupBy(queue => queue.annotations[CORE_ANNOTATIONS.PARENT][0].elemID.getFullName())

    return awu(changes)
      .filter(isInstanceChange)
      .filter(isRemovalChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === QUEUE_TYPE)
      .filter(async instance => projectToQueues[getParent(instance).elemID.getFullName()] === undefined)
      .map(instance => ({
        elemID: instance.elemID,
        severity: 'Error' as SeverityLevel,
        message: 'Cannot delete a project’s only queue',
        detailedMessage: `Cannot delete this queue, as its the last remaining queue in project ${getParent(instance).elemID.name}.`,
      }))
      .toArray()
  }
