/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { creator as salesforceAdapterCreator,
  credentialsType as salesforceCredentialsType,
  configType as salesforceConfigType } from '@salto-io/salesforce-adapter'
import { AdapterCreator, ObjectType } from '@salto-io/adapter-api'
import { creator as hubspotAdapterCreator,
  credentialsType as hubspotCredentialsType,
  configType as hubspotConfigType } from '@salto-io/hubspot-adapter'

const adapterCreators: Record<string, AdapterCreator> = {
  salesforce: salesforceAdapterCreator,
  hubspot: hubspotAdapterCreator,
}

export const adaptersCredentials: Record<string, ObjectType> = {
  salesforce: salesforceCredentialsType,
  hubspot: hubspotCredentialsType,
}

export const adaptersConfig: Record<string, ObjectType> = {
  salesforce: salesforceConfigType,
  hubspot: hubspotConfigType,
}

export default adapterCreators
