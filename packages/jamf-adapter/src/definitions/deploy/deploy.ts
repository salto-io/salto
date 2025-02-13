/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { definitions, deployment } from '@salto-io/adapter-components'
import { AdditionalAction, ClientOptions } from '../types'
import {
  API_ROLE_TYPE_NAME,
  BUILDING_TYPE_NAME,
  CATEGORY_TYPE_NAME,
  CLASS_TYPE_NAME,
  DEPARTMENT_TYPE_NAME,
  DISK_ENCRYPTION_CONFIGURATION_TYPE_NAME,
  MAC_APPLICATION_TYPE_NAME,
  MOBILE_DEVICE_CONFIGURATION_PROFILE_TYPE_NAME,
  OS_X_CONFIGURATION_PROFILE_TYPE_NAME,
  PACKAGE_TYPE_NAME,
  POLICY_TYPE_NAME,
  SCRIPT_TYPE_NAME,
  SITE_TYPE_NAME,
} from '../../constants'
import { createClassicApiDefinitionsForType } from './classic_api_utils'
import { adjustPolicyOnDeploy } from './policy'
import { UserConfig } from '../../config'

type InstanceDeployApiDefinitions = definitions.deploy.InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>

const createCustomizations = (userConfig: UserConfig): Record<string, InstanceDeployApiDefinitions> => {
  const standardRequestDefinitions = deployment.helpers.createStandardDeployDefinitions<
    AdditionalAction,
    ClientOptions
  >({
    [BUILDING_TYPE_NAME]: { bulkPath: '/api/v1/buildings' },
    [DEPARTMENT_TYPE_NAME]: { bulkPath: '/api/v1/departments' },
    [CATEGORY_TYPE_NAME]: { bulkPath: '/api/v1/categories' },
    [SCRIPT_TYPE_NAME]: { bulkPath: '/api/v1/scripts' },
    [PACKAGE_TYPE_NAME]: { bulkPath: '/api/v1/packages' },
  })
  const customDefinitions: Record<string, Partial<InstanceDeployApiDefinitions>> = {
    [CLASS_TYPE_NAME]: createClassicApiDefinitionsForType(userConfig, CLASS_TYPE_NAME, `${CLASS_TYPE_NAME}es`),
    [POLICY_TYPE_NAME]: createClassicApiDefinitionsForType(userConfig, POLICY_TYPE_NAME, 'policies', {
      add: adjustPolicyOnDeploy,
      modify: adjustPolicyOnDeploy,
    }),
    [DISK_ENCRYPTION_CONFIGURATION_TYPE_NAME]: createClassicApiDefinitionsForType(
      userConfig,
      DISK_ENCRYPTION_CONFIGURATION_TYPE_NAME,
      'diskencryptionconfigurations',
    ),
    [OS_X_CONFIGURATION_PROFILE_TYPE_NAME]: createClassicApiDefinitionsForType(
      userConfig,
      OS_X_CONFIGURATION_PROFILE_TYPE_NAME,
      'osxconfigurationprofiles',
    ),
    [MOBILE_DEVICE_CONFIGURATION_PROFILE_TYPE_NAME]: createClassicApiDefinitionsForType(
      userConfig,
      'configuration_profile',
      'mobiledeviceconfigurationprofiles',
    ),
    [API_ROLE_TYPE_NAME]: {
      requestsByAction: {
        customizations: {
          add: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/api-roles',
                  method: 'post',
                },
              },
            },
          ],
          modify: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/api-roles/{id}',
                  method: 'put',
                },
                transformation: {
                  omit: ['id'],
                },
              },
            },
          ],
          remove: [
            {
              request: {
                endpoint: {
                  path: '/api/v1/api-roles/{id}',
                  method: 'delete',
                },
              },
            },
          ],
        },
      },
    },
    [SITE_TYPE_NAME]: createClassicApiDefinitionsForType(userConfig, SITE_TYPE_NAME, `${SITE_TYPE_NAME}s`),
    [MAC_APPLICATION_TYPE_NAME]: createClassicApiDefinitionsForType(
      userConfig,
      MAC_APPLICATION_TYPE_NAME,
      'macapplications',
    ),
  }
  return _.merge(standardRequestDefinitions, customDefinitions)
}

export const createDeployDefinitions = (
  userConfig: UserConfig,
): definitions.deploy.DeployApiDefinitions<never, ClientOptions> => ({
  instances: {
    default: {
      requestsByAction: {
        default: {
          request: {
            context: deployment.helpers.DEFAULT_CONTEXT,
          },
        },
        customizations: {},
      },
      changeGroupId: deployment.grouping.selfGroup,
    },
    customizations: createCustomizations(userConfig),
  },
})
