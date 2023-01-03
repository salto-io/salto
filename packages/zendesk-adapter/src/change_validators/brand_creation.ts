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
  ChangeValidator, getChangeData, InstanceElement,
  isAdditionChange, isInstanceElement,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { BRAND_TYPE_NAME } from '../constants'
import ZendeskClient from '../client/client'

const { awu } = collections.asynciterable

type SuccessRes = {
  success: boolean
}

const isSuccess = (res: unknown): res is SuccessRes => _.isObject(res) && ('success' in res)


const invalidSubdomain = async (brand: InstanceElement, client: ZendeskClient): Promise<boolean> => {
  if (brand.value.subdomain === undefined) {
    return true
  }
  const res = (await client.getSinglePage({
    url: `/api/v2/accounts/available.json?subdomain=${brand.value.subdomain}`,
  })).data
  return isSuccess(res) && !res.success
}


export const brandCreationValidator: (client: ZendeskClient) =>
  ChangeValidator = client => async changes => {
    const brandAddition = await awu(changes)
      .filter(isAdditionChange)
      .map(getChangeData)
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === BRAND_TYPE_NAME)
      .filter(instance => invalidSubdomain(instance, client))
      .toArray()

    return brandAddition.flatMap(instance => (
      [{
        elemID: instance.elemID,
        severity: 'Warning',
        message: 'Verify brand subdomain uniqueness',
        detailedMessage: `Brand subdomains are globally unique, please make sure to set an available subdomain for brand ${instance.value.name}`,
      }]
    ))
  }
