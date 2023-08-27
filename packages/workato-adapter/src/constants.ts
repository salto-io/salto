/*
*                      Copyright 2023 Salto Labs Ltd.
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
export const FOLDER_TYPE = 'folder'
export const API_COLLECTION_TYPE = 'api_collection'
export const API_ENDPOINT_TYPE = 'api_endpoint'
export const API_CLIENT_TYPE = 'api_client'
export const API_ACCESS_PROFILE_TYPE = 'api_access_profile'
