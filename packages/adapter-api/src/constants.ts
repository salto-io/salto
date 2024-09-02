/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
export const CORE_ANNOTATIONS = {
  DEFAULT: '_default',
  REQUIRED: '_required',
  RESTRICTION: '_restriction',
  HIDDEN: '_hidden',
  HIDDEN_VALUE: '_hidden_value',
  DEPENDS_ON: '_depends_on',
  PARENT: '_parent',
  GENERATED_DEPENDENCIES: '_generated_dependencies' as const,
  SERVICE_URL: '_service_url',
  SERVICE_ID: '_service_id',
  CREATED_BY: '_created_by',
  CREATED_AT: '_created_at',
  CHANGED_BY: '_changed_by',
  CHANGED_AT: '_changed_at',
  CREATABLE: '_creatable',
  UPDATABLE: '_updatable',
  DELETABLE: '_deletable',
  ADDITIONAL_PROPERTIES: '_additional_properties',
  ALIAS: '_alias',
  IMPORTANT_VALUES: '_important_values',
  SELF_IMPORTANT_VALUES: '_self_important_values',
  DESCRIPTION: '_description',
}

export const BUILTIN_TYPE_NAMES = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  SERVICEID: 'serviceid',
  SERVICEID_NUMBER: 'serviceid_number',
  JSON: 'json',
  UNKNOWN: 'unknown',
  RESTRICTION: 'restriction',
  DEPENDENCY_OCCURRENCE: 'dependencyOccurrence',
  DEPENDENCY: 'dependency',
  HIDDEN_STRING: 'hidden_string',
  HIDDEN_BOOLEAN: 'hidden_boolean',
  IMPORTANT_VALUE: 'important_value',
}
