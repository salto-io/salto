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
import { BuiltinTypes, CORE_ANNOTATIONS, Element, Field, isInstanceElement, MapType } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { values } from '@salto-io/lowerdash'
import { findObject } from '../../utils'
import { FilterCreator } from '../../filter'
import { WORKFLOW_TYPE_NAME } from '../../constants'
import { isWorkflowInstance, Transition, WorkflowInstance } from './types'

const log = logger(module)

export const getTransitionKey = (transition: Transition): string => [
  ...(transition.from ?? []),
  transition.name ?? '',
].join('-')

export const addTransitionIds = (
  instance: WorkflowInstance,
  transitions: Transition[] | undefined,
): void => {
  if (transitions === undefined) {
    return
  }
  instance.value.transitionIds = _(transitions)
    .keyBy(getTransitionKey)
    .mapValues(transition => transition.id)
    .pickBy(values.isDefined)
    .value()

  instance.value.transitions?.forEach(transition => {
    delete transition.id
  })
}

const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    const workflowType = findObject(elements, WORKFLOW_TYPE_NAME)
    if (workflowType === undefined) {
      log.warn(`${WORKFLOW_TYPE_NAME} type not found`)
    } else {
      workflowType.fields.transitionIds = new Field(
        workflowType,
        'transitionIds',
        new MapType(BuiltinTypes.STRING),
        { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true }
      )
    }

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === WORKFLOW_TYPE_NAME)
      .filter(isWorkflowInstance)
      .forEach(instance => {
        addTransitionIds(instance, instance.value.transitions)
      })
  },
})

export default filter
