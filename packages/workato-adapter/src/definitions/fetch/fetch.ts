/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions, fetch as fetchUtils } from '@salto-io/adapter-components'
import { validatePlainObject } from '@salto-io/adapter-utils'
import { WorkatoOptions } from '../types'
import {
  API_ACCESS_PROFILE_TYPE,
  API_CLIENT_TYPE,
  API_COLLECTION_TYPE,
  API_ENDPOINT_TYPE,
  CONNECTION_TYPE,
  FOLDER_TYPE,
  PROPERTY_TYPE,
  RECIPE_CODE_TYPE,
  RECIPE_TYPE,
  ROLE_TYPE,
} from '../../constants'
import { ENABLE_DEPLOY_SUPPORT_FLAG, WorkatoUserConfig } from '../../user_config'

const NAME_ID_FIELD: definitions.fetch.FieldIDPart = { fieldName: 'name' }
const DEFAULT_ID_PARTS = [NAME_ID_FIELD]

const DEFAULT_FIELD_CUSTOMIZATIONS: Record<string, definitions.fetch.ElementFieldCustomization> = {
  created_at: { omit: true },
  updated_at: { omit: true },
}

const RECIPE_FIELD_CUSTOMIZATIONS: Record<string, definitions.fetch.ElementFieldCustomization> = {
  last_run_at: { omit: true },
  job_succeeded_count: { omit: true },
  job_failed_count: { omit: true },
  copy_count: { omit: true },
  lifetime_task_count: { omit: true },
}

const EXTENDED_SCHEMA_FIELDS: Record<string, definitions.fetch.ElementFieldCustomization> = {
  extended_input_schema: { omit: true },
  extended_output_schema: { omit: true },
}

const createCustomizations = (): Record<string, definitions.fetch.InstanceFetchApiDefinitions<WorkatoOptions>> => ({
  [CONNECTION_TYPE]: {
    requests: [
      {
        endpoint: { path: '/connections' },
      },
    ],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: {
        id: { hide: true },
        authorized_at: { omit: true },
        authorization_status: { omit: true },
      },
    },
  },
  [FOLDER_TYPE]: {
    requests: [
      {
        endpoint: {
          path: '/folders',
          queryArgs: { parent_id: '{parent_id}' },
          queryParamsSerializer: { omitEmpty: true },
        },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        child_folders: {
          typeName: FOLDER_TYPE,
          context: {
            args: {
              parent_id: { root: 'id' },
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'name' }, { fieldName: 'parent_id', isReference: true }] },
      },
      fieldCustomizations: {
        id: { hide: true },
        child_folders: {
          standalone: {
            typeName: FOLDER_TYPE,
            addParentAnnotation: false,
            referenceFromParent: false,
            nestPathUnderParent: false,
          },
        },
      },
    },
  },
  [RECIPE_TYPE]: {
    requests: [
      {
        endpoint: { path: '/recipes' },
        transformation: {
          root: 'items',
          adjust: async ({ value }) => {
            validatePlainObject(value, RECIPE_TYPE)
            return {
              value: { ...value, code: JSON.parse(value.code) },
            }
          },
        },
      },
    ],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'name' }, { fieldName: 'folder_id', isReference: true }] },
      },
      fieldCustomizations: {
        id: { hide: true },
        user_id: { hide: true },
        ...RECIPE_FIELD_CUSTOMIZATIONS,
        code: {
          standalone: {
            typeName: RECIPE_CODE_TYPE,
            addParentAnnotation: true,
            referenceFromParent: true,
            nestPathUnderParent: true,
          },
        },
      },
    },
  },
  [RECIPE_CODE_TYPE]: {
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [], // there is one code per recipe, so no need for additional details
          extendsParent: true,
        },
      },
    },
  },
  [API_COLLECTION_TYPE]: {
    requests: [
      {
        endpoint: { path: '/api_collections' },
      },
    ],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: {
        id: { hide: true },
      },
    },
  },
  [API_CLIENT_TYPE]: {
    requests: [
      {
        endpoint: { path: '/api_clients' },
      },
    ],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: {
        id: { hide: true },
      },
    },
  },
  [API_ENDPOINT_TYPE]: {
    requests: [
      {
        endpoint: { path: '/api_endpoints' },
      },
    ],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [{ fieldName: 'name' }, { fieldName: 'base_path' }],
        },
      },
      fieldCustomizations: {
        id: { hide: true },
      },
    },
  },
  [API_ACCESS_PROFILE_TYPE]: {
    requests: [
      {
        endpoint: { path: '/api_access_profiles' },
      },
    ],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: {
        id: { hide: true },
      },
    },
  },
  [ROLE_TYPE]: {
    requests: [{ endpoint: { path: '/roles' } }],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: {
        id: { hide: true },
      },
    },
  },
  [PROPERTY_TYPE]: {
    requests: [
      {
        endpoint: { path: '/properties', queryArgs: { prefix: '' } },
        transformation: { nestUnderField: 'value' },
      },
    ],
    resource: { directFetch: true },
    element: {
      topLevel: {
        isTopLevel: true,
        singleton: true,
      },
    },
  },
})

export const createFetchDefinitions = (
  userConfig: WorkatoUserConfig,
): definitions.fetch.FetchApiDefinitions<WorkatoOptions> => ({
  instances: {
    default: {
      resource: {
        serviceIDFields: ['id'],
        onError: fetchUtils.errors.createGetInsufficientPermissionsErrorFunction([403]),
      },
      element: {
        topLevel: {
          elemID: { parts: DEFAULT_ID_PARTS, useOldFormat: true },
        },
        fieldCustomizations: {
          ...DEFAULT_FIELD_CUSTOMIZATIONS,
          // only omit extended schema fields if deploy is disabled
          ...(userConfig[ENABLE_DEPLOY_SUPPORT_FLAG] === true ? {} : EXTENDED_SCHEMA_FIELDS),
        },
      },
    },
    customizations: createCustomizations(),
  },
})
