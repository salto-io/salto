/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElementFieldCustomization, FieldIDPart } from './types'

export const DEFAULT_FIELD_CUSTOMIZATIONS: Record<string, ElementFieldCustomization> = {
  // hide
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
  // This field is used to define a consistent service id (for elements that don't have unique id across the tenant)
  parent_id: {
    hide: true,
  },

  // omit
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
  securityIdentifier: {
    omit: true,
  },
  onPremisesLastSyncDateTime: {
    omit: true,
  },
  onPremisesSecurityIdentifier: {
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

export const ID_FIELD_TO_HIDE = { id: { hide: true } }

export const NAME_ID_FIELD: FieldIDPart = { fieldName: 'displayName' }
export const DEFAULT_ID_PARTS = [NAME_ID_FIELD]

export const DEFAULT_TRANSFORMATION = { root: 'value' }

// Values to that are added to the context of specific calls
export const CONTEXT_LIFE_CYCLE_POLICY_MANAGED_GROUP_TYPES = 'lifeCyclePolicyManagedGroupTypes'
