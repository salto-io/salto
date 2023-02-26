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
import { ChangeValidator, getChangeData, isAdditionOrModificationChange,
  isInstanceChange, Values } from '@salto-io/adapter-api'

const TYPES_WITH_ACTIONS = ['trigger', 'macro', 'automation']

const NOT_SUPPORTED_ACTION_TYPES = ['deflection']

const isNotSupportedAction = (action: Values): boolean =>
  _.isPlainObject(action) && NOT_SUPPORTED_ACTION_TYPES.includes(action.field)

export const invalidActionsValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(change => TYPES_WITH_ACTIONS.includes(getChangeData(change).elemID.typeName))
    .filter(change => (getChangeData(change).value.actions ?? []).some(isNotSupportedAction))
    .map(getChangeData)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Cannot change this element since one of its action types is not supported',
      detailedMessage: `Actions {${_.uniq(instance.value.actions.filter(isNotSupportedAction).map((action: Values) => action.field)).join(', ')}} are not supported`,
    }))
