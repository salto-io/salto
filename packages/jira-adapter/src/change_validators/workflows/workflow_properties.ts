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
import _ from 'lodash'
import { ChangeValidator, getChangeData, isInstanceChange, SeverityLevel } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { Values } from '@salto-io/adapter-api/src/values'
import { isWorkflowInstance, Status, Transition } from '../../filters/workflow/types'


const { awu } = collections.asynciterable

const getPropertiesKeyGroups = (statusesOrTransitions: Status[]| Transition[]):
  string[][] => Array.from(statusesOrTransitions).map(param =>
  (param.properties ?? []).map(((property: Values) => property.key)))


export const workflowPropertiesValidator: ChangeValidator = async changes =>
  awu(changes)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(isWorkflowInstance)
    .filter(instance => {
      const items = [...(instance.value.statuses ?? []), ...(instance.value.transitions ?? [])]
      const countItemsKeys = getPropertiesKeyGroups(items).map(keyGroup => _.countBy(keyGroup))
      const duplicateItemsKeys = countItemsKeys.map(dictionary => _.values(dictionary))
        .flatMap(countList => countList.filter(count => count > 1))
      return !_.isEmpty(duplicateItemsKeys)
    })
    .map(async instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Can\'t deploy workflow with status or transition that have multiple properties with an identical key.',
      detailedMessage: `Can't deploy workflow ${instance.elemID.getFullName()} which has status or transition with multiple properties with an identical key.`,
    }))
    .toArray()
