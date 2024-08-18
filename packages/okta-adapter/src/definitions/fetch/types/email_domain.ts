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
import { Values } from '@salto-io/adapter-api'
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'

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
  return false
}
