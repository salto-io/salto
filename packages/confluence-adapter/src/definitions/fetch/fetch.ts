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
import { definitions } from '@salto-io/adapter-components'
import { Options } from '../types'
import { adjustLabelsToIdsFunc, adjustRestriction, createAdjustUserReferences } from '../utils'
import {
  BLOG_POST_TYPE_NAME,
  GLOBAL_TEMPLATE_TYPE_NAME,
  GROUP_TYPE_NAME,
  LABEL_TYPE_NAME,
  PAGE_TYPE_NAME,
  PERMISSION_TYPE_NAME,
  RESTRICTION_TYPE_NAME,
  SPACE_SETTINGS_TYPE_NAME,
  SPACE_TYPE_NAME,
  TEMPLATE_TYPE_NAME,
} from '../../constants'
import { getSpaceRequests, spaceMergeAndTransformAdjust } from '../utils/space'
import { UserConfig } from '../../config'

const NAME_ID_FIELD: definitions.fetch.FieldIDPart = { fieldName: 'name' }
const DEFAULT_ID_PARTS = [NAME_ID_FIELD]

const DEFAULT_FIELD_CUSTOMIZATIONS: Record<string, definitions.fetch.ElementFieldCustomization> = {
  // hide
  created_at: {
    hide: true,
  },
  createdAt: {
    hide: true,
  },
  updated_at: {
    hide: true,
  },
  created_by_id: {
    hide: true,
  },
  updated_by_id: {
    hide: true,
  },

  // omit
  _links: {
    omit: true,
  },
  _expandable: {
    omit: true,
  },
}

const createCustomizations = (
  userConfig: UserConfig,
): Record<string, definitions.fetch.InstanceFetchApiDefinitions<Options>> => ({
  [LABEL_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/wiki/api/v2/labels',
        },
        transformation: {
          root: 'results',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [{ fieldName: 'prefix' }, { fieldName: 'name' }],
        },
        alias: {
          aliasComponents: [{ fieldName: 'name' }],
        },
      },
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
    },
  },
  [SPACE_TYPE_NAME]: {
    requests: getSpaceRequests(userConfig, {
      endpoint: {
        path: '/wiki/api/v2/spaces',
        queryArgs: {
          'description-format': 'plain',
        },
      },
      transformation: {
        root: 'results',
        adjust: createAdjustUserReferences(SPACE_TYPE_NAME),
      },
    }),
    resource: {
      directFetch: true,
      mergeAndTransform: {
        adjust: spaceMergeAndTransformAdjust,
      },
      recurseInto: {
        permissions: {
          typeName: PERMISSION_TYPE_NAME,
          context: {
            args: {
              id: {
                root: 'id',
              },
            },
          },
        },
        templates: {
          typeName: TEMPLATE_TYPE_NAME,
          context: {
            args: {
              key: {
                root: 'key',
              },
            },
          },
        },
        settings: {
          typeName: SPACE_SETTINGS_TYPE_NAME,
          context: {
            args: {
              key: {
                root: 'key',
              },
            },
          },
        },
        ...(userConfig.fetch.managePagesForSpaces !== undefined
          ? {
              pages: {
                typeName: PAGE_TYPE_NAME,
                conditions: [
                  {
                    fromField: 'name',
                    match: userConfig.fetch.managePagesForSpaces ?? [],
                  },
                ],
                context: {
                  args: {
                    spaceId: {
                      root: 'id',
                    },
                  },
                },
              },
            }
          : {}),
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        alias: {
          aliasComponents: [{ fieldName: 'name' }],
        },
      },
      fieldCustomizations: {
        permissionInternalIdMap: {
          hide: true,
        },
        id: {
          hide: true,
        },
        templates: {
          standalone: {
            typeName: TEMPLATE_TYPE_NAME,
            addParentAnnotation: true,
            referenceFromParent: false,
            nestPathUnderParent: true,
          },
        },
        pages: {
          standalone: {
            typeName: PAGE_TYPE_NAME,
            addParentAnnotation: false,
            referenceFromParent: false,
            nestPathUnderParent: false,
          },
        },
        settings: {
          standalone: {
            typeName: SPACE_SETTINGS_TYPE_NAME,
            addParentAnnotation: true,
            referenceFromParent: false,
            nestPathUnderParent: true,
          },
        },
        permissions: {
          sort: {
            properties: [{ path: 'type' }, { path: 'key' }, { path: 'targetType' }],
          },
        },
      },
    },
  },
  [PERMISSION_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/wiki/api/v2/spaces/{id}/permissions',
        },
        transformation: {
          root: 'results',
        },
      },
    ],
  },
  [SPACE_SETTINGS_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/wiki/rest/api/settings/lookandfeel',
          queryArgs: {
            spaceKey: '{key}',
          },
        },
      },
    ],
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          extendsParent: true,
          parts: [],
        },
        alias: {
          aliasComponents: [{ fieldName: '_parent.0', referenceFieldName: '_alias' }],
        },
      },
    },
    resource: {
      directFetch: false,
      serviceIDFields: [],
    },
  },
  [PAGE_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/wiki/api/v2/spaces/{spaceId}/pages',
        },
        transformation: {
          root: 'results',
          omit: ['position'],
          adjust: createAdjustUserReferences(PAGE_TYPE_NAME),
        },
      },
    ],
    resource: {
      directFetch: false,
      recurseInto: {
        restriction: {
          typeName: RESTRICTION_TYPE_NAME,
          context: {
            args: {
              id: {
                root: 'id',
              },
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          // Confluence does not allow pages with the same title in the same space
          parts: [{ fieldName: 'spaceId', isReference: true }, { fieldName: 'title' }],
        },
        path: {
          // only the filename matters, the paths are updated in the custom_paths filter
          pathParts: [{ parts: [{ fieldName: 'title' }] }],
        },
        alias: {
          aliasComponents: [{ fieldName: 'title' }],
        },
      },
      fieldCustomizations: {
        id: {
          hide: true,
        },
        version: {
          hide: true,
        },
      },
    },
  },
  settings: {
    requests: [
      {
        endpoint: {
          path: '/wiki/rest/api/settings/lookandfeel',
        },
      },
    ],
    resource: {
      directFetch: true,
      serviceIDFields: [],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        singleton: true,
      },
    },
  },
  [BLOG_POST_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/wiki/api/v2/blogposts',
        },
        transformation: {
          root: 'results',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [{ fieldName: 'spaceId', isReference: true }, { fieldName: 'title' }],
        },
        alias: {
          aliasComponents: [{ fieldName: 'title' }],
        },
      },
      fieldCustomizations: {
        version: {
          hide: true,
        },
        id: {
          hide: true,
        },
      },
    },
  },
  [RESTRICTION_TYPE_NAME]: {
    // make topLevel undefined after merging with default definitions
    element: {},
    requests: [
      {
        endpoint: {
          path: '/wiki/rest/api/content/{id}/restriction',
          queryArgs: {
            expand: 'restrictions.user,restrictions.group',
          },
        },
        transformation: {
          root: 'results',
          adjust: adjustRestriction,
        },
      },
    ],
    resource: {
      directFetch: false,
      serviceIDFields: [],
    },
  },
  [TEMPLATE_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/wiki/rest/api/template/page',
          queryArgs: {
            spaceKey: '{key}',
            expand: 'body',
          },
        },
        transformation: {
          root: 'results',
          omit: ['space'],
          adjust: adjustLabelsToIdsFunc,
        },
      },
    ],
    resource: {
      directFetch: false,
      serviceIDFields: ['templateId'],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          extendsParent: true,
          parts: [{ fieldName: 'name' }],
        },
        alias: {
          aliasComponents: [{ fieldName: 'name' }],
        },
      },
      fieldCustomizations: {
        templateId: {
          hide: true,
        },
      },
    },
  },
  [GLOBAL_TEMPLATE_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/wiki/rest/api/template/page',
          queryArgs: {
            expand: 'body',
          },
        },
        transformation: {
          root: 'results',
          adjust: adjustLabelsToIdsFunc,
        },
      },
    ],
    resource: {
      directFetch: true,
      serviceIDFields: ['templateId'],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [{ fieldName: 'name' }],
        },
        alias: {
          aliasComponents: [{ fieldName: 'name' }],
        },
      },
      fieldCustomizations: {
        templateId: {
          hide: true,
        },
      },
    },
  },
  [GROUP_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/wiki/rest/api/group',
        },
        transformation: {
          root: 'results',
          omit: ['type'],
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        alias: {
          aliasComponents: [{ fieldName: 'name' }],
        },
      },
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
    },
  },
})

export const createFetchDefinitions = (userConfig: UserConfig): definitions.fetch.FetchApiDefinitions<Options> => ({
  instances: {
    default: {
      requests: [
        {
          transformation: {
            root: 'results',
          },
        },
      ],
      resource: {
        serviceIDFields: ['id'],
      },
      element: {
        topLevel: {
          elemID: { parts: DEFAULT_ID_PARTS },
        },
        fieldCustomizations: DEFAULT_FIELD_CUSTOMIZATIONS,
      },
    },
    customizations: createCustomizations(userConfig),
  },
})
