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
import { ChangeError, ChangeValidator, getChangeData, isInstanceElement, isRemovalChange } from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import { SCHEDULE_LAYERS_TYPE_NAME, SCHEDULE_TYPE_NAME } from '../constants'

// We don't support removal of schedule layers, CV will throw an error if we try to remove a schedule layer without removing the schedule
// If the user will remove the schedule, the schedule layer will be removed as well

export const scheduleLayerRemovalValidator: ChangeValidator = async changes => {
  const layersRemoval = changes
    .filter(isRemovalChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === SCHEDULE_LAYERS_TYPE_NAME)
  const schedulesRemovalElemIds = changes
    .filter(isRemovalChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === SCHEDULE_TYPE_NAME)
    .map(instance => instance.elemID.getFullName())

  return layersRemoval
    .filter(layer => !schedulesRemovalElemIds.includes(getParent(layer).elemID.getFullName()))
    .map(
      ({ elemID }): ChangeError => ({
        elemID,
        severity: 'Error',
        message: 'Can not remove schedule layer',
        detailedMessage:
          'PagerDuty does not remove schedule layers, you can go to the service and disable the schedule layer',
      }),
    )
}
