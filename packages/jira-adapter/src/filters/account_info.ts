/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { logger } from '@salto-io/logging'
import Joi from 'joi'
import { client as clientUtils } from '@salto-io/adapter-components'
import { createSchemeGuard, safeJsonStringify } from '@salto-io/adapter-utils'
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, isInstanceElement, ListType, ObjectType, Value } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { ACCOUNT_INFO_TYPE, JIRA, LICENSED_APPLICATION_TYPE, LICENSE_TYPE } from '../constants'
import JiraClient from '../client/client'

const log = logger(module)

const createAccountTypes = ():
  {accountInfoType: ObjectType
  licenseType: ObjectType
  licensedApplications: ObjectType} => {
  const licensedApplications = new ObjectType({
    elemID: new ElemID(JIRA, LICENSED_APPLICATION_TYPE),
    isSettings: true,
    fields: {
      id: { refType: BuiltinTypes.STRING },
      plan: { refType: BuiltinTypes.STRING },
    },
    annotations: {
      [CORE_ANNOTATIONS.HIDDEN]: true,
    },
  })
  const licenseType = new ObjectType({
    elemID: new ElemID(JIRA, LICENSE_TYPE),
    isSettings: true,
    fields: {
      applications: { refType: new ListType(licensedApplications) },
    },
    annotations: {
      [CORE_ANNOTATIONS.HIDDEN]: true,
    },
  })
  const accountInfoType = new ObjectType({
    elemID: new ElemID(JIRA, ACCOUNT_INFO_TYPE),
    isSettings: true,
    fields: {
      license: { refType: new ListType(licenseType) },
    },
    annotations: {
      [CORE_ANNOTATIONS.HIDDEN]: true,
    },
  })
  return { accountInfoType, licenseType, licensedApplications }
}

type LicenseResponse = {
  applications: [{
    id: string
    plan: string
  }]
}

const LICENSE_RESPONSE_SCHEME = Joi.object({
  applications: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    plan: Joi.string().required(),
  }).required()),
}).required()

const isLicenseResponse = createSchemeGuard<LicenseResponse>(LICENSE_RESPONSE_SCHEME, 'Received an invalid license response')

const getCloudLicense = async (client: JiraClient): Promise<Value> => {
  const response = await client.getSinglePage({
    url: '/rest/api/3/instance/license',
  })
  if (!isLicenseResponse(response.data)) {
    throw new Error('Received an invalid license response')
  }
  log.info(`jira license (type cloud) is: ${safeJsonStringify(response.data)}`)
  return { applications: response.data.applications }
}
const getDCLicense = async (client: JiraClient): Promise<Value> => {
  const response = await client.getSinglePage({
    url: '/rest/plugins/applications/1.0/installed/jira-software/license',
  })
  if (!Object.prototype.hasOwnProperty.call(response.data, 'licenseType') || Array.isArray(response.data)) {
    throw new Error('Received an invalid dc license response')
  }
  delete response.data.rawLicense
  delete response.data.organizationName
  delete response.data.supportEntitlementNumber

  log.info(`jira license (type dc) is: ${safeJsonStringify(response.data)}`)
  return {
    applications: [{
      id: 'jira-software',
      plan: response.data.licenseType,
      raw: response.data,
    }],
  }
}
const getAccountInfo = async (client: JiraClient, accountInfoType: ObjectType): Promise<InstanceElement> => {
  const accountInfoInstance = new InstanceElement(
    ElemID.CONFIG_NAME,
    accountInfoType,
    {
      license: client.isDataCenter
        ? await getDCLicense(client)
        : await getCloudLicense(client),
    },
    undefined,
    { [CORE_ANNOTATIONS.HIDDEN]: true },
  )
  return accountInfoInstance
}

/*
 * Brings account info and stores it in an hidden nacl
 * the info includes license data
*/
const filter: FilterCreator = ({ client }) => ({
  name: 'accountInfo',
  onFetch: async elements => log.time(async () => {
    const { accountInfoType, licenseType, licensedApplications } = createAccountTypes()
    try {
      elements.push(licenseType, licensedApplications, accountInfoType, await getAccountInfo(client, accountInfoType))
    } catch (e) {
      if (e instanceof clientUtils.HTTPError && e.message !== undefined) {
        log.error(`Received an error when fetching jira license, ${e.message}.`)
      } else {
        log.error('Received a non http error when fetching jira license.', e)
      }
    }

    // take user count from application roles and delete it from the nacl
    const applicationRoles = elements
      .filter(element => element.elemID.typeName === 'ApplicationRole')
      .filter(isInstanceElement)
    log.info('jira user count is: %s',
      applicationRoles
        .find(role => role.value.key === 'jira-software')?.value.userCount ?? 'unknown')
    applicationRoles
      .forEach(role => {
        delete role.value.userCount
      })
  }, 'account info filter'),
})
export default filter
