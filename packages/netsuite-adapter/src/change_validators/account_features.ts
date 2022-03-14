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
import _ from 'lodash'
import { values } from '@salto-io/lowerdash'
import {
  ChangeError, ChangeValidator, getChangeData, InstanceElement, isAdditionChange,
  isInstanceChange, isModificationChange, isRemovalChange, ModificationChange,
} from '@salto-io/adapter-api'
import { ACCOUNT_FEATURES, ACCOUNT_FEATURES_VALID_STATUS_VALUES } from '../constants'

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

const INVALID_MODIFICATION_ERROR: Omit<ChangeError, 'elemID'> = {
  severity: 'Error',
  message: 'Only feature.status field modification is supported',
  detailedMessage: 'Only feature.status field modification is supported, with the following values: ENABLED, DISABLED',
}

const UNDEPLOYABLE_FEATURE_ERROR: Omit<ChangeError, 'elemID'> = {
  severity: 'Warning',
  message: 'Feature configuration is not supported',
  detailedMessage: 'You cannot use Salto to configure this feature because it requires a Terms of Service user agreement.',
}

const getModificationErrors = (change: ModificationChange<InstanceElement>): ChangeError[] => {
  const beforeFeatures = change.data.before.value.features
  const afterFeatures = change.data.after.value.features
  const featuresElemID = change.data.after.elemID.createNestedID('features')

  if (!_.isPlainObject(afterFeatures) || !_.isPlainObject(beforeFeatures)
    || Object.keys(beforeFeatures).length !== Object.keys(afterFeatures).length) {
    return [{
      elemID: featuresElemID,
      ...INVALID_MODIFICATION_ERROR,
    }]
  }

  return Object.entries(afterFeatures).map(([key, feature]) => {
    if (_.isEqual(feature, beforeFeatures[key])) {
      return undefined
    }
    if (!beforeFeatures[key]
      || !values.isPlainRecord(feature)
      || feature.label !== beforeFeatures[key].label
      || feature.id !== beforeFeatures[key].id
      || !_.isString(feature.status)
      || !ACCOUNT_FEATURES_VALID_STATUS_VALUES.includes(feature.status)) {
      return {
        elemID: featuresElemID.createNestedID(key),
        ...INVALID_MODIFICATION_ERROR,
      }
    }
    return UNDEPLOYABLE_FEATURES.includes(key) ? {
      elemID: featuresElemID.createNestedID(key),
      ...UNDEPLOYABLE_FEATURE_ERROR,
    } : undefined
  }).filter(values.isDefined)
}

const changeValidator: ChangeValidator = async changes => {
  const accountFeaturesChanges = changes
    .filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === ACCOUNT_FEATURES)

  const removalErrors: ChangeError[] = accountFeaturesChanges
    .filter(isRemovalChange)
    .map(getChangeData)
    .map(({ elemID }) => ({
      elemID,
      severity: 'Error',
      message: 'Removal of the accountFeatures instance has no effect on your NetSuite account',
      detailedMessage: 'Removal of the accountFeatures instance has no effect on your NetSuite account. This instance will be restored in the next fetch.',
    }))

  const additionErrors: ChangeError[] = accountFeaturesChanges
    .filter(isAdditionChange)
    .map(getChangeData)
    .map(({ elemID }) => ({
      elemID,
      severity: 'Error',
      message: 'Addition of an accountFeatures instance is not supported',
      detailedMessage: 'Addition of an accountFeatures instance is not supported. This instance can only be modified.',
    }))

  const modificationErrors: ChangeError[] = accountFeaturesChanges
    .filter(isModificationChange)
    .flatMap(getModificationErrors)

  return removalErrors.concat(additionErrors).concat(modificationErrors)
}

export default changeValidator
