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
import { ChangeValidator, isRemovalChange, getChangeData } from '@salto-io/adapter-api'
import { isFileCabinetInstance } from '../types'

const changeValidator: ChangeValidator = async changes => (
  changes
    .filter(isRemovalChange)
    .map(getChangeData)
    .filter(isFileCabinetInstance)
    .map(({ elemID }) => ({
      elemID,
      severity: 'Error',
      message: 'Removal of file cabinet instances is only supported when Salto SuiteApp is configured',
      detailedMessage: `${elemID.name} cannot be removed`,
    }))
)

export default changeValidator
