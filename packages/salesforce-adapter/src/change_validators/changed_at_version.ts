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

import { logger } from '@salto-io/logging'
import { ChangeValidator, ElemID } from '@salto-io/adapter-api'
import { isChangedAtSingletonOutdated } from '../filters/utils'
import { SALESFORCE } from '../constants'

const log = logger(module)

const changeValidator: ChangeValidator = async (_changes, elementsSource) => {
  if (elementsSource === undefined) {
    log.error('Change validator did not receive an element source.')
    return []
  }

  if (await isChangedAtSingletonOutdated(elementsSource)) {
    return [
      {
        elemID: new ElemID(SALESFORCE),
        severity: 'Error',
        message:
          'There have been major changes to the adapter, please fetch before deploying',
        detailedMessage:
          'There have been major changes to the Salesforce adapter since the last time data was fetched for the environment. This may create problems with the deployment. Please fetch the environment and refresh the deployment before deploying.',
      },
    ]
  }

  return []
}

export default changeValidator
