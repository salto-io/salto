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
import { ElementFieldCustomization, FieldIDPart } from './types'

const DEFAULT_FIELDS_TO_HIDE: Record<string, { hide: true }> = {
  created_at: {
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
}

const DEFAULT_FIELDS_TO_OMIT: Record<string, { omit: true }> = {
  _links: {
    omit: true,
  },
  createdDateTime: {
    omit: true,
  },
  renewedDateTime: {
    omit: true,
  },
  modifiedDateTime: {
    omit: true,
  },
  expirationDateTime: {
    omit: true,
  },
  includeUsers: {
    omit: true,
  },
  excludeUsers: {
    omit: true,
  },
  '_odata_context@mv': {
    omit: true,
  },
  'includes_odata_context@mv': {
    omit: true,
  },
  'excludes_odata_context@mv': {
    omit: true,
  },
  'includeTargets_odata_context@mv': {
    omit: true,
  },
  'combinationConfigurations_odata_context@mv': {
    omit: true,
  },
  'authenticationStrength_odata_context@mv': {
    omit: true,
  },
  'inheritsPermissionsFrom_odata_context@mv': {
    omit: true,
  },
  // It's just the tenant id, which is always the same for a single env and is not required when deploying
  appOwnerOrganizationId: {
    omit: true,
  },
}

export const DEFAULT_FIELD_CUSTOMIZATIONS: Record<string, ElementFieldCustomization> = _.merge(
  {},
  DEFAULT_FIELDS_TO_HIDE,
  DEFAULT_FIELDS_TO_OMIT,
)

export const ID_FIELD_TO_HIDE = { id: { hide: true } }

export const NAME_ID_FIELD: FieldIDPart = { fieldName: 'displayName' }
export const DEFAULT_ID_PARTS = [NAME_ID_FIELD]

export const DEFAULT_TRANSFORMATION = { root: 'value' }
