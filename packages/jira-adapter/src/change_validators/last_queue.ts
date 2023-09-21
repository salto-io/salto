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
import { ChangeValidator, getChangeData, isInstanceChange, SeverityLevel, isRemovalChange, ReadOnlyElementsSource, InstanceElement, isInstanceElement, isEqualValues, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { getParent } from '@salto-io/adapter-utils'
import { QUEUE_TYPE } from '../constants'
import { JiraConfig } from '../config/config'

const { awu } = collections.asynciterable
const getProjectQueues = async (project: InstanceElement, elementsSource: ReadOnlyElementsSource):
Promise<InstanceElement[]> => {
  const queues = await awu(await elementsSource.getAll())
    .filter(isInstanceElement)
    .filter(inst => inst.elemID.typeName === QUEUE_TYPE)
    .toArray()
  return queues.filter(queue => {
    const queueProject = queue.annotations[CORE_ANNOTATIONS.PARENT][0]
    return isEqualValues(queueProject.elemID.getFullName(), project.elemID.getFullName())
  })
}

export const deleteLastQueueValidator: (
    config: JiraConfig,
  ) => ChangeValidator = config => async (changes, elementsSource) => {
    if (elementsSource === undefined || !config.fetch.enableJSM) {
      return []
    }

    const relevantChanges = await awu(changes)
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === QUEUE_TYPE)
      .filter(isRemovalChange)
      .map(getChangeData)
      .filter(async inst => {
        const parent = getParent(inst)
        const projects = await getProjectQueues(parent, elementsSource)
        return projects.length === 0
      })
      .toArray()

    return relevantChanges
      .map(inst => ({
        elemID: inst.elemID,
        severity: 'Error' as SeverityLevel,
        message: 'Cannot delete a queue if its related project has no remaining queues.',
        detailedMessage: `Cannot delete queue ${inst.elemID.name} as its related project ${getParent(inst).elemID.name} must have at least one remaining queue.`,
      }))
  }
