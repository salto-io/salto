/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
const ZUORA = 'zuora'
export const ZUORA_BILLING = `${ZUORA}_billing`
export const CUSTOM_OBJECT = 'CustomObject'
export const STANDARD_OBJECT = 'StandardObject'
export const CUSTOM_FIELD = 'CustomField'
export const ZUORA_CUSTOM_SUFFIX = '__c'
// suffix used by salto to distinguish custom objects in the `default` namespace from
// standard objects in the `com_zuora` namespace
export const CUSTOM_OBJECT_SUFFIX = '__c'

export const OBJECTS_PATH = 'Objects'

// annotations
export const METADATA_TYPE = 'metadataType'
export const LABEL = 'label'
export const OBJECT_TYPE = 'objectType'
export const REQUIRED = 'required'
export const FILTERABLE = 'filterable'
export const DESCRIPTION = 'description'
export const INTERNAL_ID = 'id'
export const FIELD_RELATIONSHIP_ANNOTATIONS = {
  REFERENCE_TO: 'referenceTo',
  CARDINALITY: 'cardinality',
  RECORD_CONSTRAINTS: 'recordConstraints',
}

// types
export const CUSTOM_OBJECT_DEFINITION_TYPE = 'CustomObjectDefinition'
export const STANDARD_OBJECT_DEFINITION_TYPE = 'StandardObjectDefinition'
export const TASK_TYPE = 'Task'
export const WORKFLOW_DETAILED_TYPE = 'Workflow'
export const WORKFLOW_EXPORT_TYPE = 'WorkflowExport'
export const PRODUCT_RATE_PLAN_TYPE = 'ProductRatePlanType'
export const ACCOUNTING_CODE_ITEM_TYPE = 'AccountingCodeItem'
export const LIST_ALL_SETTINGS_TYPE = 'ListAllSettings'
export const SETTINGS_TYPE_PREFIX = 'Settings_'
