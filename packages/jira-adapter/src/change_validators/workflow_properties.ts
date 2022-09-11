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
import { ChangeValidator, getChangeData, isInstanceChange, SeverityLevel } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { map } from 'lodash'
import { WORKFLOW_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable

export const workflowPropertiesValidator: ChangeValidator = async changes =>
  awu(changes)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
    .filter(instance => {
      const statusesKeys = map(instance.value.statuses ?? [],
        (status => map(status.properties, property => property.key)))
      const transitionsKeys = map(instance.value.transitions ?? [],
        (transition => map(transition.properties, property => property.key)))
      const statusKeySets = statusesKeys.map(keyList => new Set<string>(keyList))
      const transitionKeySets = transitionsKeys.map(keyList => new Set<string>(keyList))
      const overrideStatusesKeys = statusesKeys.filter(
        (keyList, i) => keyList.length !== statusKeySets[i].size
      )
      const overrideTransitionsKeys = transitionsKeys.filter(
        (keyList, i) => keyList.length !== transitionKeySets[i].size
      )
      return overrideStatusesKeys.length !== 0 || overrideTransitionsKeys.length !== 0
    })
    .map(async instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Deploy workflow instance that has properties with the same key is not allowed',
      detailedMessage: `Deploy the workflow ${instance.elemID.getFullName()} is not allowed because it has status or transition properties with the same key`,
    }))
    .toArray()
