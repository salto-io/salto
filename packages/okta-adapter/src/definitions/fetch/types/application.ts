/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import Joi from 'joi'
import { logger } from '@salto-io/logging'
import { createSchemeGuard, safeJsonStringify } from '@salto-io/adapter-utils'
import { Value, Values } from '@salto-io/adapter-api'
import { extractIdFromUrl } from '../../../utils'
import { LINKS_FIELD, SAML_2_0_APP } from '../../../constants'

const log = logger(module)

const AUTO_LOGIN_APP = 'AUTO_LOGIN'

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

const endsWithNumberRegex = new RegExp(/_\d+$/)

export const isCustomApp = (value: Values, subdomain: string): boolean => {
  const subdomainMatch =
    value.name !== undefined &&
    // custom app names starts with subdomain and '_'
    _.startsWith(value.name, `${subdomain}_`)

  const endsWithNumberMatch =
    value.name !== undefined &&
    // custom app names ends with a number
    endsWithNumberRegex.test(value.name)

  if (subdomainMatch !== endsWithNumberMatch) {
    log.warn(
      'isCustomApp matching methods disagree for %s: subdomainMatch=%s, endsWithNumberMatch=%s',
      value.name,
      subdomainMatch,
      endsWithNumberMatch,
    )
  } else {
    log.info(
      'isCustomApp matching methods agree for %s: subdomainMatch=%s, endsWithNumberMatch=%s',
      value.name,
      subdomainMatch,
      endsWithNumberMatch,
    )
  }

  return [AUTO_LOGIN_APP, SAML_2_0_APP].includes(value.signOnMode) && subdomainMatch
}
