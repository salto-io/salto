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
import { Element, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FilterWith } from '../filter'
import { isInstanceOfType } from './utils'
import { ACTIVATE_RSS, INSTALLED_PACKAGE_METADATA } from '../constants'

const { awu } = collections.asynciterable

const setDefaultActivateRSSValue = ({ value }: InstanceElement): void => {
  value[ACTIVATE_RSS] = false
}

/**
 * Fixing InstalledPackage instances to the default activateRSS value: false
 * Salesforce never returns this value, and instead `{ xsi:nil: true }` is returned
 */
const filterCreator = (): FilterWith<'onFetch'> => ({
  name: 'defaultActiveRSSFilter',
  onFetch: async (elements: Element[]) => {
    await awu(elements)
      .filter(isInstanceElement)
      .filter(isInstanceOfType(INSTALLED_PACKAGE_METADATA))
      .forEach(setDefaultActivateRSSValue)
  },
})

export default filterCreator
