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
import { Change, getAllChangeData, InstanceElement, isModificationChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { ACTIVE_STATUS, INACTIVE_STATUS } from '../../../constants'

export const isActivationChange = (change: Change<InstanceElement>): boolean =>
  isModificationChange(change) &&
  _.isEqual(
    getAllChangeData(change).map(data => data.value.status),
    [INACTIVE_STATUS, ACTIVE_STATUS],
  )

export const isDeactivationChange = (change: Change<InstanceElement>): boolean =>
  isModificationChange(change) &&
  _.isEqual(
    getAllChangeData(change).map(data => data.value.status),
    [ACTIVE_STATUS, INACTIVE_STATUS],
  )
