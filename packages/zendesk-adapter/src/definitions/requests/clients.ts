/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { Options } from '../types'

export const createClientDefinitions = (
  clients: Record<
    definitions.ResolveClientOptionsType<Options>,
    definitions.RESTApiClientDefinition<definitions.ResolvePaginationOptionsType<Options>>['httpClient']
  >,
): definitions.ApiDefinitions<Options>['clients'] => ({
  default: 'main',
  options: {
    main: {
      httpClient: clients.main,
      endpoints: {
        default: {
          get: {
            pagination: 'basic_cursor',
            // only readonly endpoint calls are allowed during fetch. we assume by default that GET endpoints are safe
            readonly: true,
          },
          delete: {
            omitBody: true,
          },
        },
        customizations: {
          '/api/v2/organizations': { get: { pagination: 'links' } },
          '/api/v2/groups': { get: { pagination: 'links' } },
          '/api/v2/triggers': { get: { pagination: 'links' } },
          '/api/v2/trigger_categories': { get: { pagination: 'links' } },
          '/api/v2/automations': { get: { pagination: 'links' } },
          '/api/v2/brands': { get: { pagination: 'links' } },
          '/api/v2/recipient_addresses': { get: { pagination: 'links' } },
          '/api/v2/views': { get: { pagination: 'links' } },
          '/api/v2/macros': { get: { pagination: 'links', queryArgs: { access: 'shared' } } },
          '/api/v2/ticket_fields': { get: { pagination: 'links' } },
          '/api/v2/user_fields': { get: { pagination: 'links' } },
          '/api/v2/organization_fields': { get: { pagination: 'links' } },
          '/api/v2/apps/installations': { get: { pagination: 'links' } },
          '/api/v2/apps/owned': { get: { pagination: 'links' } },
          '/api/v2/oauth/clients': { get: { pagination: 'links' } },
          '/api/v2/oauth/global_clients': { get: { pagination: 'links' } },
          '/api/v2/resource_collections': { get: { pagination: 'settings' } },
          '/api/v2/dynamic_content/items': { get: { pagination: 'links' } },
          '/api/v2/webhooks': { get: { pagination: 'links' } },
          '/api/v2/oauth/tokens': { get: { pagination: 'links' } },
          '/api/v2/custom_objects': { get: { pagination: 'basic_cursor_with_args' } },
          '/api/v2/custom_objects/{custom_object_key}/fields': { get: { pagination: 'links' } },
          '/api/v2/guide/permission_groups': { get: { pagination: 'basic_cursor_with_args' } },
          '/api/v2/help_center/user_segments': { get: { pagination: 'links' } },
        },
      },
    },
    guide: {
      httpClient: clients.guide,
      endpoints: {
        default: {
          get: {
            pagination: 'basic_cursor',
            // only readonly endpoint calls are allowed during fetch. we assume by default that GET endpoints are safe
            readonly: true,
          },
          delete: {
            omitBody: true,
          },
        },
        customizations: {
          '/hc/api/internal/general_settings': { get: { pagination: 'links' } },
          '/hc/api/internal/help_center_translations': { get: { pagination: 'links' } },
          '/api/v2/help_center/categories': { get: { pagination: 'links' } },
          '/api/v2/help_center/sections': { get: { pagination: 'links' } },
          '/api/v2/help_center/articles/{article.id}/attachments': { get: { pagination: 'links' } },
          '/api/v2/help_center/categories/{parent.id}/articles': { get: { pagination: 'links' } },
        },
      },
    },
  },
})
