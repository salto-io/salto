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
import _ from 'lodash'
import Joi from 'joi'
import { logger } from '@salto-io/logging'
import { createSchemeGuard, safeJsonStringify } from '@salto-io/adapter-utils'
import { Value } from '@salto-io/adapter-api'
import { extractIdFromUrl } from '../../../utils'
import { LINKS_FIELD } from '../../../constants'

const log = logger(module)

type linkProperty = {
  href: string
}

const LINK_PROPERTY_SCHEME = Joi.object({
  href: Joi.string().required(),
})
  .unknown(true)
  .required()

const isLinkProperty = createSchemeGuard<linkProperty>(LINK_PROPERTY_SCHEME, 'Received invalid link property')

const extractIdsFromUrls = (value: Value, fieldName: string): string | undefined => {
  const linksProp = _.get(value, [LINKS_FIELD, fieldName])
  if (linksProp !== undefined && isLinkProperty(linksProp)) {
    const id = extractIdFromUrl(linksProp.href)
    if (_.isString(id)) {
      return id
    }
  }
  log.warn(
    'Faild to extract id from url for field %s on application with values: %s',
    fieldName,
    safeJsonStringify(value),
  )
  return undefined
}

export const assignPolicyIdsToApplication = (value: unknown): Value => {
  if (!_.isObject(value)) {
    log.warn('Failed to assign policy ids to app due to invalid value')
    return value
  }
  return {
    ...value,
    profileEnrollment: extractIdsFromUrls(value, 'profileEnrollment'),
    accessPolicy: extractIdsFromUrls(value, 'accessPolicy'),
  }
}
