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

import {
  ChangeError,
  ChangeValidator,
  getChangeData,
  isInstanceChange,
} from '@salto-io/adapter-api'

// We should check that there is no reference stay after resolving
// (if we wanna support cross_service fetch without deploy)
export const changeValidator: ChangeValidator = async changes => (
  // TODO check supported services. maybe should be in warining at the resolving procedure
  changes
    .filter(isInstanceChange)
    .filter(() => false)
    .map(getChangeData)
    .map(element => ({
      elemID: element.elemID,
      severity: 'Error',
      message: `Removing element of type '${element.elemID.typeName}' is not supported`,
      detailedMessage: `Removing element of type '${element.elemID.typeName}' is not supported`,
    } as ChangeError))
)

export default changeValidator
