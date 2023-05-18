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
import { isInstanceElement, Element, SaltoError } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { LOCALE_TYPE_NAME } from '../constants'

const log = logger(module)


const getWarningsForLocale = (
): SaltoError[] => [{
  message: 'Please be aware that your Zendesk account\'s default locale is not set to English (en-US), which may impact your ability to compare environments with different default locales',
  severity: 'Warning',
}]

/**
 * This filter checks that the default locale is set to en-US, if not it will raise a warning. We have seen that the
 * default locale determines the language of different values and therefore may affect the elemId. This can cause
 * elements to unintentionally appear as removed/added when comparing environments
 */
const filterCreator: FilterCreator = () => ({
  name: 'locale',
  onFetch: async (elements: Element[]) => {
    const defaultLocale = elements
      .filter(isInstanceElement)
      .filter(obj => obj.elemID.typeName === LOCALE_TYPE_NAME)
      .find(localeInstance => localeInstance.value.default === true)

    if (defaultLocale === undefined) {
      log.warn('could not find a default locale')
      return { errors: [] }
    }

    const warnings = defaultLocale.value.locale === 'en-US'
      ? []
      : getWarningsForLocale()
    return { errors: warnings }
  },
})
export default filterCreator
