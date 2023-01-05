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
import {
  ChangeError,
  ChangeValidator, getChangeData, InstanceElement,
  isAdditionChange, isInstanceElement,
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

const isValidRes = (res: unknown): res is ValidRes => _.isObject(res) && ('success' in res)


const invalidSubdomain = async (brand: InstanceElement, client: ZendeskClient): Promise<boolean | undefined> => {
  if (brand.value.subdomain === undefined) {
    return true
  }
  let res
  try {
    res = (await client.getSinglePage({
      url: `/api/v2/accounts/available.json?subdomain=${brand.value.subdomain}`,
    })).data
  } catch (e) {
    log.error(e)
    res = undefined
  }
  if (res === undefined || !isValidRes(res)) {
    return undefined
  }
  return !res.success
}

/**
 * this validator checks if the subdomain of the brand is globally uniq
 */
export const brandCreationValidator: (client: ZendeskClient) =>
  ChangeValidator = client => async changes => {
    const brandAddition = await awu(changes)
      .filter(isAdditionChange)
      .map(getChangeData)
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === BRAND_TYPE_NAME)
      .map(async instance => ({ instance, invalid: await invalidSubdomain(instance, client) }))
      .toArray()

    return brandAddition
      .filter(brandDetails => brandDetails.invalid || brandDetails.invalid === undefined)
      .map(({ instance, invalid }): ChangeError => {
        if (invalid === undefined) {
          return { elemID: instance.elemID,
            severity: 'Warning',
            message: 'Verify brand subdomain uniqueness',
            detailedMessage: `Brand subdomains are globally unique, please make sure to set an available subdomain for brand ${instance.value.name} before attempting to create it from Salto` }
        }
        return {
          elemID: instance.elemID,
          severity: 'Error',
          message: 'Brand subdomain is already taken',
          detailedMessage: `Brand subdomains are globally unique, please make sure to set an available subdomain for brand ${instance.value.name} before attempting to create it from Salto`,
        }
      })
  }
