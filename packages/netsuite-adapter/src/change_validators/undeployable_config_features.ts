/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isModificationChange,
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
  Object.keys(change.data.after.value).filter(
    fieldName => change.data.after.value[fieldName] !== change.data.before.value[fieldName],
  )

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
      message: "Can't deploy a feature configuration",
      detailedMessage:
        "Can't configure this element via Salto because it requires approving the Terms of Service in NetSuite's UI.",
    }))
}

export default changeValidator
