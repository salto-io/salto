/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
export const WORKATO = 'workato'

export const SALESFORCE = 'salesforce'
export const NETSUITE = 'netsuite'
export const ZUORA_BILLING = 'zuora_billing'
export const ZENDESK = 'zendesk'
export const JIRA = 'jira'

export const CROSS_SERVICE_SUPPORTED_APPS = {
  [SALESFORCE]: ['salesforce', 'salesforce_secondary'],
  [NETSUITE]: ['netsuite', 'netsuite_secondary'],
  [ZUORA_BILLING]: ['zuora'],
  [ZENDESK]: ['zendesk', 'zendesk_secondary'],
  [JIRA]: ['jira', 'jira_secondary'],
}

export const PROPERTY_TYPE = 'property'
export const ROLE_TYPE = 'role'
export const CONNECTION_TYPE = 'connection'
export const RECIPE_TYPE = 'recipe'
export const RECIPE_CODE_TYPE = 'recipe__code'
export const RECIPE_CONFIG_TYPE = 'recipe__config'
export const FOLDER_TYPE = 'folder'
export const API_COLLECTION_TYPE = 'api_collection'
export const API_ENDPOINT_TYPE = 'api_endpoint'
export const API_CLIENT_TYPE = 'api_client'
export const API_ACCESS_PROFILE_TYPE = 'api_access_profile'
export const DEPLOY_USING_RLM_GROUP = 'RLM'

export const RLM_DEPLOY_SUPPORTED_TYPES = [RECIPE_TYPE, RECIPE_CODE_TYPE, CONNECTION_TYPE]
