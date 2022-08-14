/*
*                      Copyright 2022 Salto Labs Ltd.
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
export const FEATURE_CONSUMER_KEY = '9dc4d9f6c593fcc417636990a7581ee1272c824eca0847fed5075276d630c338'
export const FEATURE_CONSUMER_SECRET = '13f886e062f985b96068994b231f1b28c53d89b0dde04cc74244653f94226a38'
export const REQUIRED_FEATUERS = ['tba', 'webservicesexternal', 'createsuitebundles', 'restwebservices', 'suiteappdevelopmentframework']
export const FEATURE_TO_UI_NAME: Record<string, string> = { tba: 'TOKEN BASED AUTHENTICATION',
  webservicesexternal: 'SOAP WEB SERVICES',
  createsuitebundles: 'CREATE BUNDLES WITH SUITEBUNDLER',
  restwebservices: 'REST WEB SERVICES',
  suiteappdevelopmentframework: 'SUITECLOUD DEVELOPMENT FREAMEWORK' }
