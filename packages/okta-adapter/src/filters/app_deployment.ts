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

import _ from 'lodash'
import Joi from 'joi'
import {
  InstanceElement,
  Element,
  getChangeData,
  isInstanceElement,
  Values,
  isObjectType,
  CORE_ANNOTATIONS, ModificationChange,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import {
  APPLICATION_TYPE_NAME, CUSTOM_NAME_FIELD, INACTIVE_STATUS,
  ORG_SETTING_TYPE_NAME,
  SAML_2_0_APP,
} from '../constants'
import { FilterCreator } from '../filter'

const log = logger(module)

const AUTO_LOGIN_APP = 'AUTO_LOGIN'
/*
const APPLICATION_FIELDS_TO_IGNORE = ['id', '_links', CUSTOM_NAME_FIELD]
const APP_ASSIGNMENT_FIELDS: Record<string, configUtils.DeploymentRequestsByAction> = {
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
 */

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

export const isAppResponse = createSchemeGuard<Application>(
  EXPECTED_APP_SCHEMA,
  'Received an invalid application response',
)

const isCustomApp = (value: Values, subdomain: string): boolean =>
  [AUTO_LOGIN_APP, SAML_2_0_APP].includes(value.signOnMode) &&
  value.name !== undefined &&
  // custom app names starts with subdomain and '_'
  _.startsWith(value.name, `${subdomain}_`)

export const isInactiveCustomAppChange = (change: ModificationChange<InstanceElement>): boolean =>
  change.data.before.value.status === INACTIVE_STATUS &&
  change.data.after.value.status === INACTIVE_STATUS &&
  // customName field only exist in custom applications
  getChangeData(change).value[CUSTOM_NAME_FIELD] !== undefined


/*
const assignNameToCustomApp = (
  change: AdditionChange<InstanceElement>,
  appResponse: Application,
  subdomain?: string,
): void => {
  const instance = getChangeData(change)
  // Assign created name field which is not multi-env in custom apps to customName field, which is hidden
  if (subdomain !== undefined && isCustomApp(appResponse, subdomain)) {
    const createdAppName = appResponse.name
    _.set(instance, ['value', CUSTOM_NAME_FIELD], createdAppName)
  }
}

const getSubdomainFromElementsSource = async (elementsSource: ReadOnlyElementsSource): Promise<string | undefined> => {
  const orgSettingInstance = await elementsSource.get(
    new ElemID(OKTA, ORG_SETTING_TYPE_NAME, 'instance', ElemID.CONFIG_NAME),
  )
  if (!isInstanceElement(orgSettingInstance)) {
    log.error(`Failed to get ${ORG_SETTING_TYPE_NAME} instance, can not find subdomain`)
    return undefined
  }
  return orgSettingInstance.value.subdomain
}

const deployApp = async (
  change: Change<InstanceElement>,
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
  apiDefinitions: OktaSwaggerApiConfig,
  subdomain?: string,
): Promise<void> => {
  const fieldsToIgnore = [...Object.keys(APP_ASSIGNMENT_FIELDS), ...APPLICATION_FIELDS_TO_IGNORE]

  try {
    if (
      isModificationChange(change) &&
      (isActivationChange({ before: change.data.before.value.status, after: change.data.after.value.status }) ||
        // Custom app must be activated before applying any other changes
        isInactiveCustomAppChange(change))
    ) {
      log.debug(`Changing status to ${ACTIVE_STATUS}, for instance ${getChangeData(change).elemID.getFullName()}`)
      await deployStatusChange(change, client, apiDefinitions, 'activate')
    }

    const response = await defaultDeployChange(
      isModificationChange(change)
        ? deployment.transformRemovedValuesToNull(_.cloneDeep(change), ['settings'])
        : change,
      client,
      apiDefinitions,
      fieldsToIgnore,
      // Application is created with status 'ACTIVE' by default, unless we provide activate='false' as a query param
      isAdditionChange(change) && getChangeData(change).value?.status === INACTIVE_STATUS
        ? { activate: 'false' }
        : undefined,
    )

    if (
      isModificationChange(change) &&
      (isDeactivationChange({ before: change.data.before.value.status, after: change.data.after.value.status }) ||
        isInactiveCustomAppChange(change))
    ) {
      log.debug(`Changing status to ${INACTIVE_STATUS}, for instance ${getChangeData(change).elemID.getFullName()}`)
      await deployStatusChange(change, client, apiDefinitions, 'deactivate')
    }

    if (isAdditionOrModificationChange(change)) {
      if (isAdditionChange(change) && isAppResponse(response)) {
        assignNameToCustomApp(change, response, subdomain)
      }
      await deployEdges(change, APP_ASSIGNMENT_FIELDS, client)
    }
  } catch (err) {
    throw getOktaError(getChangeData(change).elemID, err)
  }
}

 */

/**
 * Application type is deployed separately to update application's configuration, status and application's policies
 */
const filterCreator: FilterCreator = () => ({
  name: 'appDeploymentFilter',
  onFetch: async (elements: Element[]) => {
    const instances = elements.filter(isInstanceElement)
    const appInstances = instances.filter(instance => instance.elemID.typeName === APPLICATION_TYPE_NAME)
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

    // Set deployment annotaitons for `features` field which cannot be managed through the API
    const appType = elements.filter(isObjectType).find(type => type.elemID.name === APPLICATION_TYPE_NAME)
    if (appType?.fields.features !== undefined) {
      appType.fields.features.annotations[CORE_ANNOTATIONS.CREATABLE] = false
      appType.fields.features.annotations[CORE_ANNOTATIONS.UPDATABLE] = false
      appType.fields.features.annotations[CORE_ANNOTATIONS.DELETABLE] = false
    }
  },
})

export default filterCreator
