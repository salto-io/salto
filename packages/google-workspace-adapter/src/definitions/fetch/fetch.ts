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
import { definitions } from '@salto-io/adapter-components'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { Options } from '../types'

// Note: hiding fields inside arrays is not supported, and can result in a corrupted workspace.
// when in doubt, it's best to hide fields only for relevant types, or to omit them.
const DEFAULT_FIELDS_TO_HIDE: Record<string, definitions.fetch.ElementFieldCustomization> = {}
const DEFAULT_FIELDS_TO_OMIT: Record<string, definitions.fetch.ElementFieldCustomization> = {
  creationTime: {
    omit: true,
  },
  kind: {
    omit: true,
  },
  etag: {
    omit: true,
  },
  etags: {
    omit: true,
  },
}

const NAME_ID_FIELD: definitions.fetch.FieldIDPart = { fieldName: 'name' }
const DEFAULT_ID_PARTS = [NAME_ID_FIELD]

const DEFAULT_FIELD_CUSTOMIZATIONS: Record<string, definitions.fetch.ElementFieldCustomization> = _.merge(
  {},
  DEFAULT_FIELDS_TO_HIDE,
  DEFAULT_FIELDS_TO_OMIT,
)

const createCustomizations = (): Record<string, definitions.fetch.InstanceFetchApiDefinitions<Options>> => ({
  role: {
    requests: [
      {
        endpoint: {
          path: '/admin/directory/v1/customer/my_customer/roles',
        },
        transformation: {
          root: 'items',
        },
      },
    ],
    resource: {
      directFetch: true,
      serviceIDFields: ['roleId'],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'roleName' }] },
        serviceUrl: { path: 'ac/roles/{roleId}' },
        alias: { aliasComponents: [{ fieldName: 'roleName' }] },
      },
      fieldCustomizations: {
        roleId: {
          hide: true,
        },
      },
    },
  },
  // privilege is a closed list so we do not need to fetch it
  domain: {
    requests: [
      {
        endpoint: {
          path: '/admin/directory/v1/customer/my_customer/domains',
        },
        transformation: {
          root: 'domains',
        },
      },
    ],
    resource: {
      directFetch: true,
      serviceIDFields: ['domainName'],
      recurseInto: {
        groups: {
          typeName: 'group',
          context: {
            args: {
              domain: {
                root: 'domainName',
              },
            },
          },
        },
      },
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'domainName' }] },
        serviceUrl: { path: 'ac/domains' },
        alias: { aliasComponents: [{ fieldName: 'domainName' }] },
      },
      fieldCustomizations: {
        groups: {
          standalone: {
            typeName: 'group',
            addParentAnnotation: false,
            referenceFromParent: false,
            nestPathUnderParent: false,
          },
        },
        // domainAliases: {
        //   standalone: {
        //     typeName: 'domain__domainAliases',
        //     addParentAnnotation: false,
        //     referenceFromParent: true,
        //     nestPathUnderParent: true,
        //   },
        // },
      },
    },
  },
  domain__domainAliases: {
    element: {
      fieldCustomizations: {
        parentDomainName: {
          omit: true,
        },
      },
    },
  },
  group: {
    requests: [
      {
        endpoint: {
          path: '/admin/directory/v1/groups',
          queryArgs: {
            domain: '{domain}',
          },
        },
        transformation: {
          root: 'groups',
        },
      },
    ],
    resource: {
      directFetch: false,
      recurseInto: {
        groupSettings: {
          typeName: 'group__groupSettings',
          single: true,
          context: {
            args: {
              groupKey: {
                root: 'email',
              },
            },
          },
        },
        roleAssignments: {
          typeName: 'roleAssignment',
          context: {
            args: {
              groupId: {
                root: 'id',
              },
            },
          },
        },
        groupMembers: {
          typeName: 'groupMember',
          context: {
            args: {
              groupId: {
                root: 'id',
              },
            },
          },
        },
        labels: {
          typeName: 'label',
          single: true,
          context: {
            args: {
              groupId: {
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
        serviceUrl: { path: 'ac/groups/{id}' },
        elemID: { parts: [NAME_ID_FIELD] },
      },
      fieldCustomizations: {
        roleAssignments: {
          standalone: {
            typeName: 'roleAssignment',
            addParentAnnotation: false,
            referenceFromParent: false,
            nestPathUnderParent: false,
          },
        },
        groupMembers: {
          standalone: {
            typeName: 'groupMember',
            addParentAnnotation: true,
            referenceFromParent: false,
            nestPathUnderParent: true,
          },
        },
        id: {
          hide: true,
        },
        directMembersCount: {
          omit: true,
        },
        adminCreated: {
          omit: true,
        },
        nonEditableAliases: {
          omit: true,
        },
      },
    },
  },
  label: {
    requests: [
      {
        endpoint: {
          path: '/v1/groups/{groupId}',
          client: 'cloudIdentity',
        },
        transformation: {
          root: 'labels',
        },
      },
    ],
  },
  groupMember: {
    requests: [
      {
        endpoint: {
          path: '/admin/directory/v1/groups/{groupId}/members',
        },
        transformation: {
          root: 'members',
        },
      },
    ],
    resource: {
      directFetch: false,
      // the id field in groupMember is not unique, as it the member id.
      serviceIDFields: [],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          extendsParent: true,
          parts: [{ fieldName: 'email', isReference: true }],
        },
      },
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
    },
  },
  // RoleAssignment is assigned to a user/group we currently fetch the groups only
  roleAssignment: {
    requests: [
      {
        endpoint: {
          path: '/admin/directory/v1/customer/my_customer/roleassignments',
          queryArgs: {
            userKey: '{groupId}',
          },
        },
        transformation: {
          root: 'items',
        },
      },
    ],
    resource: {
      directFetch: false,
      serviceIDFields: ['roleAssignmentId'],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: {
          parts: [
            { fieldName: 'roleId', isReference: true },
            { fieldName: 'assignedTo', isReference: true },
          ],
        },
        alias: {
          aliasComponents: [
            { fieldName: 'roleId', referenceFieldName: '_alias' },
            { fieldName: 'assignedTo', referenceFieldName: '_alias' },
          ],
        },
      },
      fieldCustomizations: {
        roleAssignmentId: {
          hide: true,
        },
        assigneeType: {
          omit: true,
        },
      },
    },
  },
  group__groupSettings: {
    requests: [
      {
        endpoint: {
          path: '/groups/v1/groups/{groupKey}',
          queryArgs: {
            alt: 'json',
          },
          client: 'groupSettings',
        },
      },
    ],
    element: {
      fieldCustomizations: {
        email: {
          omit: true,
        },
        name: {
          omit: true,
        },
        description: {
          omit: true,
        },
      },
    },
  },
  orgUnit: {
    requests: [
      {
        endpoint: {
          path: '/admin/directory/v1/customer/my_customer/orgunits',
          queryArgs: {
            type: 'ALL_INCLUDING_PARENT',
          },
        },
        transformation: {
          root: 'organizationUnits',
        },
      },
    ],
    resource: {
      directFetch: true,
      serviceIDFields: ['orgUnitId'],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'orgUnitPath' }] },

        serviceUrl: { path: 'ac/orgunits' },
        alias: {
          aliasComponents: [{ fieldName: 'name' }],
        },
        path: {
          pathParts: [{ parts: [{ fieldName: 'name' }] }, { parts: [{ fieldName: 'name' }] }],
        },
      },

      fieldCustomizations: {
        orgUnitId: {
          hide: true,
        },
        orgUnitPath: {
          hide: true,
        },
        parentOrgUnitPath: {
          omit: true,
        },
      },
    },
  },
  schema: {
    requests: [
      {
        endpoint: {
          path: '/admin/directory/v1/customer/my_customer/schemas',
        },
        transformation: {
          root: 'schemas',
          adjust: item => {
            const { value } = item
            if (!(lowerdashValues.isPlainRecord(value) && Array.isArray(value.fields))) {
              throw new Error('Expected schema to be an object')
            }
            return {
              value: {
                ...value,
                fields: _.keyBy(value.fields, 'fieldName'),
              },
            }
          },
        },
      },
    ],
    resource: {
      directFetch: true,
      serviceIDFields: ['schemaId'],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'schemaName' }] },
        serviceUrl: { path: 'ac/customschema' },
        alias: { aliasComponents: [{ fieldName: 'schemaName' }] },
      },
      fieldCustomizations: {
        schemaId: {
          hide: true,
        },
        fields: {
          isMapWithDynamicType: true,
        },
      },
    },
  },
  schema__fields: {
    element: {
      fieldCustomizations: {
        fieldId: {
          hide: true,
        },
      },
    },
  },
  building: {
    requests: [
      {
        endpoint: {
          path: '/admin/directory/v1/customer/my_customer/resources/buildings',
        },
        transformation: {
          root: 'buildings',
        },
      },
    ],
    resource: {
      directFetch: true,
      serviceIDFields: ['buildingId'],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'buildingName' }] },
        serviceUrl: { path: 'ac/calendarresources/resources' },
        alias: { aliasComponents: [{ fieldName: 'buildingName' }] },
      },
      fieldCustomizations: {
        buildingId: {
          hide: true,
        },
      },
    },
  },
  room: {
    requests: [
      {
        endpoint: {
          path: '/admin/directory/v1/customer/my_customer/resources/calendars',
        },
        transformation: {
          root: 'items',
        },
      },
    ],
    resource: {
      directFetch: true,
      serviceIDFields: ['resourceId'],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { parts: [{ fieldName: 'resourceName' }] },
        serviceUrl: { path: 'ac/calendarresources/resources' },
        alias: { aliasComponents: [{ fieldName: 'resourceName' }] },
      },
      fieldCustomizations: {
        resourceId: {
          hide: true,
        },
        generatedResourceName: {
          omit: true,
        },
      },
    },
  },
  feature: {
    requests: [
      {
        endpoint: {
          path: '/admin/directory/v1/customer/my_customer/resources/features',
        },
        transformation: {
          root: 'features',
        },
      },
    ],
    resource: {
      directFetch: true,
      serviceIDFields: ['name'],
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: 'ac/calendarresources/resources' },
        alias: { aliasComponents: [NAME_ID_FIELD] },
      },
    },
  },
})

export const createFetchDefinitions = (): definitions.fetch.FetchApiDefinitions<Options> => ({
  instances: {
    default: {
      resource: {
        serviceIDFields: ['id'],
      },
      element: {
        topLevel: {
          elemID: { parts: DEFAULT_ID_PARTS },
          serviceUrl: { baseUrl: 'https://admin.google.com' },
        },
        fieldCustomizations: DEFAULT_FIELD_CUSTOMIZATIONS,
      },
    },
    customizations: createCustomizations(),
  },
})
