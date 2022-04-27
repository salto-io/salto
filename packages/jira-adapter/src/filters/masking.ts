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
import { ElemID, isInstanceElement } from '@salto-io/adapter-api'
import { createSchemeGuard, walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import Joi, { string } from 'joi'
import { AUTOMATION_TYPE } from '../constants'
import { FilterCreator } from '../filter'

const log = logger(module)

export const MASK_VALUE = '<SECRET_TOKEN>'

type Header = {
  name: string
  value: string
}

const HEADERS_SCHEME = Joi.array().items(
  Joi.object({
    name: string().allow('').required(),
    value: string().allow('').required(),
  }).unknown(true)
)

const isHeaders = createSchemeGuard<Header[]>(HEADERS_SCHEME, 'Found an invalid headers in automation')

const maskHeaders = (
  headers: Header[],
  headersToMask: string[],
  id: ElemID
): void => {
  const headerRegexes = headersToMask.map(header => new RegExp(`^${header}$`))
  headers
    .filter(({ name }) => headerRegexes.some(regex => regex.test(name)))
    .forEach(header => {
      log.debug(`Masked header ${header.name} in ${id.getFullName()}`)
      header.value = MASK_VALUE
    })
}

/**
 * Replace sensitive data in the NaCls with some placeholder
 * currently only relevant for Automations' headers
 */
const filter: FilterCreator = ({ config }) => ({
  onFetch: async elements => {
    if (config.masking.automationHeaders.length === 0) {
      return
    }

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)
      .forEach(instance => {
        walkOnElement({
          element: instance,
          func: ({ path, value }) => {
            if (path.name === 'headers' && isHeaders(value)) {
              maskHeaders(value, config.masking.automationHeaders, instance.elemID)
            }

            return WALK_NEXT_STEP.RECURSE
          },
        })
      })
  },
})

export default filter
