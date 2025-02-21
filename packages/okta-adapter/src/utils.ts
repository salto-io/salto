/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { isInstanceElement, Element } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import OktaClient from './client/client'
import { GROUP_TYPE_NAME } from './constants'

const log = logger(module)

type OktaOrgResponse = {
  pipeline: string
}

const isOktaOrgResponse = (value: unknown): value is OktaOrgResponse => _.isObject(value) && 'pipeline' in value

/**
 * Determine if an account is Classic Engine Org or Okta Identity Engine Org
 */
export const isClassicEngineOrg = async (oktaClient: OktaClient): Promise<boolean> => {
  try {
    const { data } = await oktaClient.get({ url: '/.well-known/okta-organization' })
    if (!isOktaOrgResponse(data)) {
      log.debug('Recived invalid response when trying to determine org type')
      return false
    }
    // pipeline is idx for Okta Identity Engine, and v1 for Classic Engine
    return data.pipeline === 'v1'
  } catch {
    log.debug('Failed to determine org type, defaults to Identity Engine Account')
    return false
  }
}

/**
 * Extract id from okta's _links object urls
 * Example url: https://subdomain.okta.com/api/v1/group/abc123
 */
export const extractIdFromUrl = (url: string): string | undefined => {
  if (url.includes('/')) {
    const urlParts = url.split('/')
    return urlParts.pop()
  }
  log.warn(`Failed to extract id from url: ${url}`)
  return undefined
}

export const validateOktaBaseUrl = (baseUrl: string): void => {
  // Okta's org url must be from one of the following formats:
  //   - Standard domain: companyname.okta.com
  //   - EMEA domain: companyname.okta-emea.com
  //   - Sandbox subdomain: companyname.oktapreview.com
  //   Source: https://developer.okta.com/docs/concepts/okta-organizations/
  //   Customized domains also works with the Okta domain (https://developer.okta.com/docs/guides/custom-url-domain/main/#about-okta-domain-customizations)
  if (!/^https:\/\/([a-zA-Z0-9.-]+\.(okta\.com|oktapreview\.com|okta-emea\.com|trexcloud\.com))(\/)?$/.test(baseUrl)) {
    log.error(`${baseUrl} is not a valid account url`)
    throw new Error('baseUrl is invalid')
  }
}

export const logUsersCount = async (elements: Element[], oktaClient: OktaClient): Promise<void> => {
  const everyoneUserGroup = elements
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === GROUP_TYPE_NAME)
    .find(group => group.value.type === 'BUILT_IN' && group.value.profile?.name === 'Everyone')
  const everyoneGroupId = everyoneUserGroup?.value.id
  if (!_.isString(everyoneGroupId)) {
    log.warn('failed to find Everyone group id, skipping logging users count')
    return
  }
  try {
    const res = await oktaClient.get({ url: `/api/v1/groups/${everyoneGroupId}/stats` })
    const usersCount = _.get(res, 'data.usersCount')
    log.info('Users count: %d', usersCount)
  } catch (error) {
    log.warn('failed to get users count with error %s', safeJsonStringify(error))
  }
}
