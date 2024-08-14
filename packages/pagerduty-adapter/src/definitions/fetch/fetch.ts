/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { Options } from '../types'
import { Credentials } from '../../auth'
import {
  BUSINESS_SERVICE_TYPE_NAME,
  ESCALATION_POLICY_TYPE_NAME,
  EVENT_ORCHESTRATION_TYPE_NAME,
  SCHEDULE_LAYERS_TYPE_NAME,
  SCHEDULE_TYPE_NAME,
  SERVICE_TYPE_NAME,
  TEAM_TYPE_NAME,
} from '../../constants'

const NAME_ID_FIELD: definitions.fetch.FieldIDPart = { fieldName: 'name' }
export const DEFAULT_ID_PARTS = [NAME_ID_FIELD]

const DEFAULT_FIELD_CUSTOMIZATIONS: Record<string, definitions.fetch.ElementFieldCustomization> = {
  self: {
    omit: true,
  },
  html_url: {
    omit: true,
  },
  summary: {
    omit: true,
  },
  created_at: {
    omit: true,
  },
  updated_at: {
    omit: true,
  },
  created_by: {
    omit: true,
  },
  updated_by: {
    omit: true,
  },
  version: {
    omit: true,
  },
}

const createCustomizations = (): Record<string, definitions.fetch.InstanceFetchApiDefinitions<Options>> => ({
  [SERVICE_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/services',
        },
        transformation: {
          root: 'services',
        },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        serviceOrchestration: {
          typeName: 'service__serviceOrchestration',
          single: true,
          context: {
            args: {
              serviceId: {
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
        serviceUrl: { path: '/services/{id}' },
      },
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
    },
  },
  service__serviceOrchestration: {
    requests: [
      {
        endpoint: {
          path: '/event_orchestrations/services/{serviceId}',
        },
        transformation: {
          root: 'orchestration_path',
        },
      },
    ],
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: {
        parent: {
          omit: true,
        },
      },
    },
  },
  [BUSINESS_SERVICE_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/business_services',
        },
        transformation: {
          root: 'business_services',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/business_services/{id}' },
      },
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
    },
  },
  [TEAM_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/teams',
        },
        transformation: {
          root: 'teams',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/teams/{id}' },
      },
      fieldCustomizations: {
        id: {
          hide: true,
        },
      },
    },
  },
  [ESCALATION_POLICY_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/escalation_policies',
        },
        transformation: {
          root: 'escalation_policies',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/escalation_policies/{id}' },
      },
      fieldCustomizations: {
        services: {
          omit: true,
        },
        id: {
          hide: true,
        },
      },
    },
  },
  [SCHEDULE_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/schedules',
          queryArgs: {
            'include[]': 'schedule_layers',
          },
        },
        transformation: {
          root: 'schedules',
        },
      },
    ],
    resource: {
      directFetch: true,
    },
    element: {
      topLevel: {
        isTopLevel: true,
        serviceUrl: { path: '/schedules/{id}' },
      },
      fieldCustomizations: {
        escalation_policies: {
          omit: true,
        },
        id: {
          hide: true,
        },
        users: {
          omit: true,
        },
        schedule_layers: {
          sort: { properties: [{ path: 'name' }, { path: 'end', order: 'desc' }] },
          standalone: {
            typeName: SCHEDULE_LAYERS_TYPE_NAME,
            addParentAnnotation: true,
            referenceFromParent: true,
            nestPathUnderParent: true,
          },
        },
      },
    },
  },
  [SCHEDULE_LAYERS_TYPE_NAME]: {
    element: {
      topLevel: {
        isTopLevel: true,
        elemID: { extendsParent: true },
      },
      fieldCustomizations: {
        id: {
          hide: true,
        },
        start: {
          hide: true,
        },
      },
    },
  },
  [EVENT_ORCHESTRATION_TYPE_NAME]: {
    requests: [
      {
        endpoint: {
          path: '/event_orchestrations',
        },
        transformation: {
          root: 'orchestrations',
        },
      },
    ],
    resource: {
      directFetch: true,
      recurseInto: {
        eventOrchestrationsRouter: {
          typeName: 'eventOrchestration__eventOrchestrationsRouter',
          single: true,
          context: {
            args: {
              eventOrchestration: {
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
        serviceUrl: { path: '/event_orchestrations/{id}' },
      },
      fieldCustomizations: {
        routes: {
          omit: true,
        },
        id: {
          hide: true,
        },
      },
    },
  },
  eventOrchestration__eventOrchestrationsRouter: {
    requests: [
      {
        endpoint: {
          path: '/event_orchestrations/{eventOrchestration}/router',
        },
        transformation: {
          root: 'orchestration_path',
        },
      },
    ],
    element: {
      topLevel: {
        isTopLevel: true,
      },
      fieldCustomizations: {
        parent: {
          omit: true,
        },
      },
    },
  },
})

export const createFetchDefinitions = (credentials: Credentials): definitions.fetch.FetchApiDefinitions<Options> => ({
  instances: {
    default: {
      resource: {
        serviceIDFields: ['id'],
      },
      element: {
        topLevel: {
          elemID: { parts: DEFAULT_ID_PARTS },
          serviceUrl: { baseUrl: `https://${credentials.subdomain}.pagerduty.com` },
        },
        fieldCustomizations: DEFAULT_FIELD_CUSTOMIZATIONS,
      },
    },
    customizations: createCustomizations(),
  },
})
