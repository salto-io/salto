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
import {
  ChangeError, getChangeData, ChangeValidator,
  isInstanceChange, InstanceElement, isRemovalChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FLOW_METADATA_TYPE } from '../constants'
import { isInstanceOfType } from '../filters/utils'

const { awu } = collections.asynciterable

const createChangeError = (instance: InstanceElement): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message: 'Cannot delete flow',
  detailedMessage: `Cannot delete flow via metadata API. Flow name: ${instance.elemID.getFullName()}`,
})

/**
 * We can only delete flows that are currently at draft status
 */
const changeValidator: ChangeValidator = async changes => awu(changes)
  .filter(isInstanceChange)
  .filter(isRemovalChange)
  .map(getChangeData)
  .filter(isInstanceOfType(FLOW_METADATA_TYPE))
  .map(createChangeError)
  .toArray()

export default changeValidator
