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
import _ from 'lodash'
import { ChangeValidator, getChangeData, isInstanceChange, SeverityLevel } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { isWorkflowInstance, Status, Transition } from '../filters/workflow/types'
import { Values } from '../../../adapter-api/src/values'
import { WORKFLOW_TYPE_NAME } from '../constants'


const { awu } = collections.asynciterable

const getPropertiesKeys = (statusesOrTransitions: Status[]| Transition[]):
  Array<string>[] => Array.from(statusesOrTransitions).map((param: Transition | Status) =>
  (param.properties ?? []).map(((property: Values) => property.key)))


export const workflowPropertiesValidator: ChangeValidator = async changes =>
  awu(changes)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
    .filter(isWorkflowInstance)
    .filter(instance => {
      const statuses = instance.value?.statuses
      const transitions = instance.value?.transitions
      const countStatusesKeys = (statuses !== undefined ? getPropertiesKeys(statuses) : [])
        .map(key => _.countBy(key))
      const countTransitionsKeys = (transitions !== undefined ? getPropertiesKeys(transitions) : [])
        .map(key => _.countBy(key))
      const duplicateTransitionKeys = countTransitionsKeys.map(dictionary => _.values(dictionary))
        .flatMap(countList => countList.filter(count => count > 1))
      const duplicateStatusKeys = countStatusesKeys.map(dictionary => _.values(dictionary))
        .flatMap(countList => countList.filter(count => count > 1))
      return !_.isEmpty(duplicateTransitionKeys) || !_.isEmpty(duplicateStatusKeys)
    })
    .map(async instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Deploy workflow instance that has properties with the same key is not allowed',
      detailedMessage: `Deploy the workflow ${instance.elemID.getFullName()} is not allowed because it has status or transition properties with the same key`,
    }))
    .toArray()
