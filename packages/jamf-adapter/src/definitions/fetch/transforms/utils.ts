/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { regex as lowerdashRegex, values } from '@salto-io/lowerdash'
import _ from 'lodash'

export const MASK_VALUE = '**MASKED_PASSWORD**'

const PASSWORD_REGEX = /<key>Password<\/key><string>.*?<\/string>/
const MASKED_PASSWORD = `<key>Password</key><string>${MASK_VALUE}</string>`

const CLIENT_SECRET_REGEX = '^client_secret=.*'
const MASKED_CLIENT_SECRET = `client_secret=${MASK_VALUE}`

type WithIdType = {
  id: number
}

const isWithIdType = (value: unknown): value is WithIdType => values.isPlainObject(value) && 'id' in value

/*
 * Convert site object to site id to make reference
 */
export const adjustSiteObjectToSiteId = (value: Record<string, unknown>): void => {
  const site = _.get(value, 'general.site')
  if (isWithIdType(site)) {
    _.set(value, 'general.site', site.id === -1 ? _.get(value, 'general.site.name') : site.id)
  }
}

/*
 * Convert category object to category id to make reference
 */
export const adjustCategoryObjectToCategoryId = (value: Record<string, unknown>): void => {
  const category = _.get(value, 'general.category')
  if (isWithIdType(category)) {
    _.set(value, 'general.category', category.id === -1 ? _.get(value, 'general.category.name') : category.id)
  }
}

/*
 * Convert scripts object array to scripts ids to make reference
 */
export const removeIdsForScriptsObjectArray = (value: Record<string, unknown>): void => {
  const { scripts } = value
  if (Array.isArray(scripts) && scripts.every(isWithIdType)) {
    value.scripts = scripts.map(script => _.omit(script, 'id'))
  }
}

/*
 * Extract id field from being under "general" field to be top level
 */
export const adjustServiceIdToTopLevel = (value: Record<string, unknown>): void => {
  const { general } = value
  if (!values.isPlainRecord(general)) {
    throw new Error('Expected value to be a record')
  }
  const id = _.get(general, 'id')
  _.set(general, 'id', undefined)
  value.id = id
}

/*
 * Remove self_service_icon from self_service object
 */
export const removeSelfServiceIcon = (value: Record<string, unknown>): void => {
  const { self_service: selfService } = value
  if (values.isPlainRecord(selfService)) {
    delete selfService.self_service_icon
  }
}

/*
 * Remove security.password from self_service object as it's a secret
 */
export const removeSelfServiceSecurityPassword = (value: Record<string, unknown>): void => {
  const { self_service: selfService } = value
  if (values.isPlainRecord(selfService)) {
    const { security } = selfService
    if (values.isPlainRecord(security)) {
      delete security.password
    }
  }
}

export const maskPayloadsPassword = (value: Record<string, unknown>): void => {
  const payloads = _.get(value, 'general.payloads')
  if (typeof payloads === 'string') {
    _.set(value, 'general.payloads', payloads.replace(PASSWORD_REGEX, MASKED_PASSWORD))
  }
}

export const maskPasswordsForScriptsObjectArray = (value: Record<string, unknown>): void => {
  const { scripts } = value
  if (Array.isArray(scripts)) {
    scripts.forEach(script =>
      Object.keys(script).forEach(key => {
        if (lowerdashRegex.isFullRegexMatch(script[key], CLIENT_SECRET_REGEX)) {
          script[key] = MASKED_CLIENT_SECRET
        }
      }),
    )
  }
}
