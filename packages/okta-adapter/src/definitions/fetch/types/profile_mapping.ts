/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { Values } from '@salto-io/adapter-api'

const OKTA_AUTHENTICATOR_APP_NAME = 'Okta_Authenticator'

const PROFILE_MAPPING_SCHEMA = Joi.object({
  source: Joi.object({
    name: Joi.string().optional(),
    type: Joi.string().optional(),
  })
    .optional()
    .unknown(true),
  target: Joi.object({
    name: Joi.string().optional(),
    type: Joi.string().optional(),
  })
    .optional()
    .unknown(true),
}).unknown(true)

type ProfileMapping = {
  source?: {
    name?: string
    type?: string
  }
  target?: {
    name?: string
    type?: string
  }
}

const isValidProfileMappingValues = createSchemeGuard<ProfileMapping>(PROFILE_MAPPING_SCHEMA)

/**
 * Omit profile mapping instances that maps to Okta_Authenticator application,
 * Okta_Authenticator is an internal Okta app and its mapping cannot be managed
 */
export const isNotMappingToAuthenticatorApp = (value: unknown): value is Values => {
  if (isValidProfileMappingValues(value)) {
    return !(
      (value?.source?.name === OKTA_AUTHENTICATOR_APP_NAME && value?.source?.type === 'appuser') ||
      (value?.target?.name === OKTA_AUTHENTICATOR_APP_NAME && value?.target?.type === 'appuser')
    )
  }
  return false
}
