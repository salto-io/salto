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
import { ChangeValidator, getChangeData, ChangeError, ElemID } from '@salto-io/adapter-api'

const toChangeError = (
  elemID: ElemID,
): ChangeError => ({
  elemID,
  severity: 'Info',
  message: 'Dummy info with deploy actions',
  detailedMessage: 'Dummy info with deploy actions detailed',
  deployActions: {
    preAction: {
      title: 'Dummy pre title',
      description: 'Dummy description',
      subActions: [
        'Pre sub 1',
        'Pre sub 2',
      ],
    },
    postAction: {
      title: 'Dummy post title',
      description: 'Dummy description',
      subActions: [
        'Post sub 1',
        'Post sub 2',
      ],
    },
  },
})

const changeValidator: ChangeValidator = async changes => {
  const changeErrors = changes
    .map(change =>
      getChangeData(change))
    .filter(change => (change.elemID.getFullName()).match(/.*FullInst2.*/))
    .map(change => toChangeError(change.elemID))

  return changeErrors
}

export default changeValidator
