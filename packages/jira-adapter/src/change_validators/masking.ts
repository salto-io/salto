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
import { Change, ChangeError, ChangeValidator, CORE_ANNOTATIONS, getChangeData,
  InstanceElement,
  isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import JiraClient from '../client/client'
import { MASK_VALUE } from '../filters/masking'

const log = logger(module)
export const DETAILED_MESSAGE = 'This element will be deployed with masked values instead of the intended values. It will not operate correctly until manually fixing this after deployment. Learn more at https://help.salto.io/en/articles/6933977-masked-data-will-be-deployed-to-the-service'
export const DOCUMENTATION_URL = 'https://help.salto.io/en/articles/6933977-masked-data-will-be-deployed-to-the-service'
export const createChangeError = (
  change: Change<InstanceElement>,
  client: JiraClient,
): ChangeError => {
  const serviceUrl = getChangeData(change).annotations[CORE_ANNOTATIONS.SERVICE_URL]
  return {
    elemID: getChangeData(change).elemID,
    severity: 'Warning',
    message: 'Masked data will be deployed to the service',
    detailedMessage: DETAILED_MESSAGE,
    deployActions: {
      postAction: {
        title: 'Update deployed masked data',
        description: `Please update the masked values that were deployed to Jira in ${getChangeData(change).elemID.getFullName()}`,
        subActions: [
          serviceUrl !== undefined
            ? `Go to ${serviceUrl}`
            : `Go to ${client.baseUrl} and open the relevant page for ${getChangeData(change).elemID.getFullName()}`,
          'Search for masked values (which contain <SECRET_TOKEN>) and set them to the correct value',
          'Save the page',
        ],
        documentationURL: DOCUMENTATION_URL,
      },
    },
  }
}

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

export const maskingValidator: (client: JiraClient) =>
  ChangeValidator = client => async changes => log.time(() => (
    changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .filter(change => doesHaveMaskedValues(getChangeData(change)))
      .map(change => createChangeError(change, client))
  ), 'masking change validator')
