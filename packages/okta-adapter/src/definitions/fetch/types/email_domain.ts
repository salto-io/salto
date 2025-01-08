/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Values } from '@salto-io/adapter-api'
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'

const log = logger(module)

// This is a partial schema with only the field we access below.
const EMAIL_DOMAIN_SCHEMA = Joi.object({
  validationStatus: Joi.string().required(),
}).unknown(true)

type EmailDomain = {
  validationStatus: string
}

const hasValidationStatus = createSchemeGuard<EmailDomain>(EMAIL_DOMAIN_SCHEMA)

/**
 * Omit email domains with a DELETED status.
 *
 * When deleting an email domain, Okta marks it as deleted instead of removing it. This can cause a merge error when
 * recreating the email domain with the same name.
 */
export const isNotDeletedEmailDomain = (value: unknown): value is Values => {
  if (hasValidationStatus(value)) {
    return value.validationStatus !== 'DELETED'
  }
  log.error('Email domain is missing a validationStatus field, this is unexpected: %o', value)
  return false
}
