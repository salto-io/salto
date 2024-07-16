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

import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { GetInsightsFunc, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { AUTOMATION_TYPE_NAME } from '../constants'

const { makeArray } = collections.array

const AUTOMATION = 'automation'

const isAutomationInstance = (instance: InstanceElement): boolean => instance.elemID.typeName === AUTOMATION_TYPE_NAME

const isDefaultHoursSinceSolvedCSATValue = (instance: InstanceElement): boolean => {
  const allConditions = makeArray(instance.value.conditions?.all)
  return (
    allConditions.find(condition =>
      _.isEqual(condition, {
        field: 'satisfaction_score',
        operator: 'is',
        value: 'unoffered',
      }),
    ) !== undefined &&
    allConditions.find(condition =>
      _.isEqual(condition, {
        field: 'SOLVED',
        operator: 'is',
        value: '24',
      }),
    ) !== undefined
  )
}

const getInsights: GetInsightsFunc = elements => {
  const instances = elements.filter(isInstanceElement).filter(isAutomationInstance)

  const defaultHoursSinceSolvedCSATValue = instances.filter(isDefaultHoursSinceSolvedCSATValue).map(instance => ({
    path: instance.elemID,
    ruleId: `${AUTOMATION}.defaultHoursSinceSolvedCSATValue`,
    message: 'CSAT automation uses default "hours since solved" value',
  }))

  return defaultHoursSinceSolvedCSATValue
}

export default getInsights
