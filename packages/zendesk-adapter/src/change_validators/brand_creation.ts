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
import {
  Change,
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceChange,
  isInstanceElement,
  isModificationChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { BRAND_TYPE_NAME } from '../constants'
import ZendeskClient from '../client/client'

const { awu } = collections.asynciterable
const log = logger(module)

type ValidRes = {
  success: boolean
}

const isValidRes = (res: unknown): res is ValidRes => _.isObject(res) && 'success' in res

const isSubdomainValid = async (brand: InstanceElement, client: ZendeskClient): Promise<boolean | undefined> => {
  if (brand.value.subdomain === undefined) {
    log.error(`brand ${brand.elemID.getFullName()} does not have a subdomain`)
    return false
  }
  let res
  try {
    res = (
      await client.get({
        url: `/api/v2/accounts/available.json?subdomain=${brand.value.subdomain}`,
      })
    ).data
  } catch (e) {
    log.error(`could not verify account subdomain availability for '${brand.value.sudomain}'. error: ${e}`)
    res = undefined
  }
  if (res === undefined || !isValidRes(res)) {
    return undefined
  }
  return res.success
}

const isChangeInSubdomain = (change: Change<InstanceElement>): boolean => {
  if (isAdditionChange(change)) {
    return true
  }
  if (isModificationChange(change)) {
    return change.data.before.value.subdomain !== change.data.after.value.subdomain
  }
  return false
}

/**
 * this validator checks if the subdomain of the brand is globally unique
 */
export const brandCreationValidator: (client: ZendeskClient) => ChangeValidator = client => async changes => {
  const brandSubdomainChanges = await awu(changes)
    .filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === BRAND_TYPE_NAME)
    .filter(isChangeInSubdomain)
    .map(getChangeData)
    .filter(isInstanceElement)
    .map(async instance => ({ instance, valid: await isSubdomainValid(instance, client) }))
    .toArray()

  return brandSubdomainChanges
    .filter(brandDetails => !brandDetails.valid)
    .map(({ instance, valid }): ChangeError => {
      if (valid === undefined) {
        return {
          elemID: instance.elemID,
          severity: 'Warning',
          message: 'Verify brand subdomain uniqueness',
          detailedMessage: `Brand subdomains are globally unique, and we were unable to check the uniqueness of the subdomain '${instance.value.subdomain}' used for brand ${instance.value.name}. Please ensure its uniqueness before deploying`,
        }
      }
      return {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Brand subdomain is already taken',
        detailedMessage: `Brand subdomains are globally unique, and the subdomain '${instance.value.subdomain}' used for brand ${instance.value.name} is not available. Please choose a different one.`,
      }
    })
}
