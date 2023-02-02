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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, isInstanceElement, ListType, ObjectType } from '@salto-io/adapter-api'
import JiraClient from '../client/client'
import { FilterCreator } from '../filter'
import { ACCOUNT_INFO_TYPE, JIRA, LICENSED_APPLICATION_TYPE, LICENSE_TYPE } from '../constants'

const log = logger(module)

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
export const accountInfoType = new ObjectType({
  elemID: new ElemID(JIRA, ACCOUNT_INFO_TYPE),
  isSettings: true,
  fields: {
    license: { refType: new ListType(licenseType) },
  },
  annotations: {
    [CORE_ANNOTATIONS.HIDDEN]: true,
  },
})


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

const getCloudLicense = async (client: JiraClient): Promise<InstanceElement> => {
  const response = await client.getSinglePage({
    url: '/rest/api/3/instance/license',
  })
  if (!isLicenseResponse(response.data)) {
    throw new Error('Received an invalid license response')
  }
  const accountInfoInstance = new InstanceElement(
    ElemID.CONFIG_NAME,
    accountInfoType,
    {
      license: {
        applications: response.data.applications,
      },
    },
    undefined,
    { [CORE_ANNOTATIONS.HIDDEN]: true },
  )
  log.info(`jira license is: ${safeJsonStringify(response.data)}`)
  return accountInfoInstance
}

const getDCLicense = async (client: JiraClient): Promise<InstanceElement> => {
  const response = await client.getSinglePage({
    url: '/rest/plugins/applications/1.0/installed/jira-software/license',
  })
  if (!Object.prototype.hasOwnProperty.call(response.data, 'licenseType') || Array.isArray(response.data)) {
    throw new Error('Received an invalid dc license response')
  }
  delete response.data.rawLicense
  const accountInfoInstance = new InstanceElement(
    ElemID.CONFIG_NAME,
    accountInfoType,
    {
      license: {
        applications: [{
          id: 'jira-software',
          plan: response.data.licenseType,
          raw: response.data,
        }],
      },
    },
    undefined,
    { [CORE_ANNOTATIONS.HIDDEN]: true },
  )
  log.info(`jira dc license is: ${safeJsonStringify(response.data)}`)
  return accountInfoInstance
}


/*
 * Brings account info and stores it in an hidden nacl
 * the info includes license data
*/
const filter: FilterCreator = ({ client }) => ({
  name: 'accountInfo',
  onFetch: async elements => log.time(async () => {
    try {
      const accountInfoInstance = client.isDataCenter
        ? await getDCLicense(client)
        : await getCloudLicense(client)
      elements.push(licenseType, licensedApplications, accountInfoType, accountInfoInstance)
    } catch (e) {
      if (e instanceof clientUtils.HTTPError && e.message !== undefined) {
        log.error(`Received an error when fetching jira license, ${e.message}.`)
      } else {
        log.error('Received a non http error when fetching jira license.', e)
      }
    }

    const applicationRoles = elements
      .filter(element => element.elemID.typeName === 'ApplicationRole')
      .filter(isInstanceElement)
    log.info('jira user count is: %d',
      applicationRoles
        .filter(role => role.value.key === 'jira-software')
        .map(role => role.value.userCount) ?? 'unknown')
    applicationRoles
      .forEach(role => {
        delete role.value.userCount
      })
  }, 'account info filter'),
})
export default filter
