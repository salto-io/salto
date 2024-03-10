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
import {
  ChangeError,
  ChangeValidator,
  Element,
  getChangeData,
  isAdditionChange,
  isField,
  isObjectType,
} from '@salto-io/adapter-api'
import { isCustom } from '../transformers/transformer'
import { apiNameSync, getFLSProfiles } from '../filters/utils'
import { SalesforceConfig } from '../types'

const createFLSInfo = (
  element: Element,
  flsProfiles: string[],
): ChangeError => {
  const typeOrField = isField(element) ? 'CustomField' : 'CustomObject'
  return {
    message: `${typeOrField} visibility in Profiles.`,
    detailedMessage: `Deploying this new ${typeOrField} will make it accessible by the following Profiles: [${flsProfiles.join(', ')}].`,
    severity: 'Info',
    elemID: element.elemID,
  }
}

const changeValidator =
  (config: SalesforceConfig): ChangeValidator =>
  async (changes) => {
    const flsProfiles = getFLSProfiles(config)
    return changes
      .filter(isAdditionChange)
      .map((change) => getChangeData(change))
      .filter((element) => isObjectType(element) || isField(element))
      .filter((element) => isCustom(apiNameSync(element)))
      .map((element) => createFLSInfo(element, flsProfiles))
  }

export default changeValidator
