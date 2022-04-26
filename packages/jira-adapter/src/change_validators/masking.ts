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
import { ChangeError, ChangeValidator, ElemID, getChangeData,
  InstanceElement,
  isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { AUTOMATION_TYPE } from '../constants'
import { MASK_VALUE } from '../filters/masking'

export const createChangeError = (instanceElemId: ElemID): ChangeError => ({
  elemID: instanceElemId,
  severity: 'Info',
  message: 'Masked data will be deployed to the service',
  detailedMessage: '',
  deployActions: {
    preAction: {
      title: 'Masked data will be overridden in the service',
      description: `${instanceElemId.getFullName()} contains masked values which will override the real values in the service when deploying`,
      subActions: [],
    },
    postAction: {
      title: 'Update masked data in the service',
      description: `Please updated the masked values that were deployed to the service in ${instanceElemId.getFullName()} in the service`,
      subActions: [
        `In the Jira UI, open System > Global automation, and open the automation of ${instanceElemId.getFullName()}`,
        'Go over the headers with masked values (headers with <SECRET_TOKEN> values) and set the real values',
        'Click "Save"',
        'Click "Publish changes"',
      ],
    },
  },
})

const doesHaveMaskedValues = (instance: InstanceElement): boolean => {
  let maskedValueFound = false
  walkOnElement({
    element: instance,
    func: ({ value }) => {
      if (value === MASK_VALUE) {
        maskedValueFound = true
        return WALK_NEXT_STEP.EXIT
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })

  return maskedValueFound
}

export const maskingValidator: ChangeValidator = async changes => (
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === AUTOMATION_TYPE)
    .map(getChangeData)
    .filter(doesHaveMaskedValues)
    .flatMap(instance => ([createChangeError(instance.elemID)]))
)
