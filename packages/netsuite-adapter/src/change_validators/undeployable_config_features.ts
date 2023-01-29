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
import {
  getChangeData, InstanceElement, isInstanceChange, isModificationChange,
  ModificationChange,
} from '@salto-io/adapter-api'
import { CONFIG_FEATURES } from '../constants'
import { NetsuiteChangeValidator } from './types'


// These features cannot be configure using SDF
// because they require a Terms of Service user agreement
const UNDEPLOYABLE_FEATURES = [
  'AUTOLOCATIONASSIGNMENT',
  'FULFILLMENTREQUEST',
  'WEEKLYTIMESHEETSNEWUI',
  'SUPPLYCHAINPREDICTEDRISKS',
  'WEBDUPLICATEEMAILMANAGEMENT',
  'OPENIDSSO',
  'OIDC',
  'SAMLSSO',
  'OAUTH2',
  'NSASOIDCPROVIDER',
  'SUITEAPPCONTROLCENTER',
  'MULTICURRENCYCUSTOMER',
  'MULTICURRENCYVENDOR',
  'FXRATEUPDATES',
  'MOBILEPUSHNTF',
  'EFT',
  'ACHVEND',
  'MAILMERGE',
  'ITEMOPTIONS',
  'CUSTOMRECORDS',
  'ADVANCEDPRINTING',
  'CUSTOMCODE',
  'SERVERSIDESCRIPTING',
  'WEBAPPLICATIONS',
  'WORKFLOW',
  'CUSTOMGLLINES',
  'CUSTOMSEGMENTS',
  'CREATESUITEBUNDLES',
  'WEBSERVICESEXTERNAL',
  'RESTWEBSERVICES',
  'SUITESIGNON',
  'TBA',
]

const getDiffFeatureNames = (change: ModificationChange<InstanceElement>): string[] =>
  Object.keys(change.data.after.value)
    .filter(fieldName => change.data.after.value[fieldName] !== change.data.before.value[fieldName])

const changeValidator: NetsuiteChangeValidator = async changes => {
  const featuresChange = changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .find(change => getChangeData(change).elemID.typeName === CONFIG_FEATURES)

  if (!featuresChange) return []

  return getDiffFeatureNames(featuresChange)
    .filter(featureName => UNDEPLOYABLE_FEATURES.includes(featureName))
    .map(featureName => ({
      elemID: featuresChange.data.after.elemID.createNestedID(featureName),
      severity: 'Warning',
      message: 'Feature configuration is not supported',
      detailedMessage: 'This feature cannot be configured using Salto because it requires a manual'
        + ' Terms of Service agreement in NetSuite UI. Configuring this feature will be ignored by NetSuite.',
    }))
}

export default changeValidator
