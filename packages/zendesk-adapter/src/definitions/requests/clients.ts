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
import { ClientOptions, PaginationOptions } from '../types'

export const createClientDefinitions = (
  clients: Record<ClientOptions, definitions.RESTApiClientDefinition<PaginationOptions>['httpClient']>,
): definitions.ApiDefinitions<{ clientOptions: ClientOptions; paginationOptions: PaginationOptions }>['clients'] => ({
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
  },
})
