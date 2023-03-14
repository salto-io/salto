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
import _ from 'lodash'
import Joi from 'joi'
import { Change, InstanceElement, Element, isInstanceChange, getChangeData, isAdditionOrModificationChange, isAdditionChange, AdditionChange, isInstanceElement, ElemID, ReadOnlyElementsSource, Values } from '@salto-io/adapter-api'
import { config as configUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { APPLICATION_TYPE_NAME, INACTIVE_STATUS, OKTA, ORG_SETTING_TYPE_NAME } from '../constants'
import OktaClient from '../client/client'
import { OktaConfig, API_DEFINITIONS_CONFIG } from '../config'
import { FilterCreator } from '../filter'
import { deployChanges, defaultDeployChange, deployEdges } from '../deployment'

const log = logger(module)

const AUTO_LOGIN_APP = 'AUTO_LOGIN'
const SAML_2_0_APP = 'SAML_2_0'
const CUSTOM_NAME_FIELD = 'customName'
const APP_ASSIGNMENT_FIELDS: Record<string, configUtils.DeploymentRequestsByAction> = {
  assignedGroups: {
    add: {
      url: '/api/v1/apps/{source}/groups/{target}',
      method: 'put',
    },
    remove: {
      url: '/api/v1/apps/{source}/groups/{target}',
      method: 'delete',
    },
  },
  profileEnrollment: {
    add: {
      url: '/api/v1/apps/{source}/policies/{target}',
      method: 'put',
    },
  },
  accessPolicy: {
    add: {
      url: '/api/v1/apps/{source}/policies/{target}',
      method: 'put',
    },
  },
}

type Application = {
  id: string
  name: string
  signOnMode: string
}

const EXPECTED_APP_SCHEMA = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required(),
  signOnMode: Joi.string().required(),
}).unknown(true)

export const isAppResponse = createSchemeGuard<Application>(EXPECTED_APP_SCHEMA, 'Received an invalid application response')

const isCustomApp = (value: Values, subdomain: string): boolean => (
  [AUTO_LOGIN_APP, SAML_2_0_APP].includes(value.signOnMode)
  && value.name !== undefined
  && _.startsWith(value.name, subdomain)
)

// Set fields that are created by the service to the returned app instance
const assignCreatedFieldsToApp = (
  change: AdditionChange<InstanceElement>,
  appResponse: Application,
  subdomain?: string,
): void => {
  const instance = getChangeData(change)
  const signing = _.get(appResponse, ['credentials', 'signing'])
  if (_.isPlainObject(signing)) {
    _.set(instance, ['value', 'credentials', 'signing'], signing)
  }
  // Assign created name field which is not multi-env in custom apps to customName field, which is hidden
  if (subdomain !== undefined && isCustomApp(appResponse, subdomain)) {
    const createdAppName = appResponse.name
    _.set(instance, ['value', CUSTOM_NAME_FIELD], createdAppName)
  }
  if (instance.value.licensing !== undefined) {
    const licensing = _.get(appResponse, ['licensing'])
    if (_.isPlainObject(licensing)) {
      _.set(instance, ['value', 'licensing'], licensing)
    }
  }
}

const getSubdomainFromElementsSource = async (elementsSource: ReadOnlyElementsSource): Promise<string | undefined> => {
  const orgSettingInstance = await elementsSource.get(
    new ElemID(OKTA, ORG_SETTING_TYPE_NAME, 'instance', ElemID.CONFIG_NAME)
  )
  if (!isInstanceElement(orgSettingInstance)) {
    log.error(`Failed to get ${ORG_SETTING_TYPE_NAME} instance, can not find subdomain`)
    return undefined
  }
  return orgSettingInstance.value.subdomain
}

// TODO SALTO-2736 : adjust to support addition of more application types
const deployApp = async (
  change: Change<InstanceElement>,
  client: OktaClient,
  config: OktaConfig,
  elementsSource: ReadOnlyElementsSource,
): Promise<void> => {
  const fieldsToIgnore = [
    ...Object.keys(APP_ASSIGNMENT_FIELDS),
    // TODO SALTO-2690: remove this once completed
    'id', 'created', 'lastUpdated', 'licensing', '_links', '_embedded', CUSTOM_NAME_FIELD,
  ]

  const response = await defaultDeployChange(
    change,
    client,
    config[API_DEFINITIONS_CONFIG],
    fieldsToIgnore,
    // Application is created with status 'ACTIVE' by default, unless we provide activate='false' as a query param
    isAdditionChange(change) && getChangeData(change).value?.status === INACTIVE_STATUS ? { activate: 'false' } : undefined
  )

  if (isAdditionOrModificationChange(change)) {
    if (isAdditionChange(change) && isAppResponse(response)) {
      const subdomain = await getSubdomainFromElementsSource(elementsSource)
      assignCreatedFieldsToApp(change, response, subdomain)
    }
    await deployEdges(change, APP_ASSIGNMENT_FIELDS, client)
  }
}

/**
 * Application type is deployed separately to update application's status,
 * application's assigned group and application's policies
 */
const filterCreator: FilterCreator = ({ elementsSource, client, config }) => ({
  name: 'appDeploymentFilter',
  onFetch: async (elements: Element[]) => {
    const instances = elements.filter(isInstanceElement)
    const appInstances = instances
      .filter(instance => instance.elemID.typeName === APPLICATION_TYPE_NAME)
    // OrgSetting is settings type
    const orgInstance = instances.find(instance => instance.elemID.typeName === ORG_SETTING_TYPE_NAME)
    const subdomain = orgInstance?.value?.subdomain
    if (!_.isString(subdomain)) {
      log.error('Could not create customName field for custom apps because subdomain was missing')
      return
    }
    // create customName field for non custom apps and delete name field as its value is not multienv
    appInstances.forEach(app => {
      if (isCustomApp(app.value, subdomain)) {
        app.value.customName = app.value.name
        delete app.value.name
      }
    })
  },
  preDeploy: async (changes: Change<InstanceElement>[]) => {
    changes
      .map(getChangeData)
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === APPLICATION_TYPE_NAME)
      .forEach(
        async instance => {
          const { customName } = instance.value
          if (customName !== undefined) {
            instance.value.name = customName
          }
        }
      )
  },
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
            && getChangeData(change).elemID.typeName === APPLICATION_TYPE_NAME
    )

    const deployResult = await deployChanges(
      relevantChanges.filter(isInstanceChange),
      async change => deployApp(change, client, config, elementsSource)
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
  onDeploy: async (changes: Change<InstanceElement>[]) => {
    changes
      .map(getChangeData)
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === APPLICATION_TYPE_NAME)
      .forEach(
        async instance => {
          const { customName } = instance.value
          if (customName !== undefined) {
            delete instance.value.name
          }
        }
      )
  },
})

export default filterCreator
