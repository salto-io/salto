/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { ChangeValidator, getChangeData, ChangeError, ElemID } from '@salto-io/adapter-api'
import { getNamespaceSync, isInstanceOfCustomObjectChangeSync } from '../filters/utils'
import { BILLING_NAMESPACE } from '../constants'

const getBillingError = (elemID: ElemID): ChangeError => ({
  elemID,
  severity: 'Info',
  message: 'Salesforce Billing data changes detected',
  detailedMessage: '',
  deployActions: {
    preAction: {
      title: 'Disable Salesforce Billing Triggers',
      description: 'Salesforce Billing triggers should be disabled before deploying:',
      subActions: [
        'In Salesforce, navigate to Setup > Installed Packages > Salesforce Billing > Configure',
        'Enable the "Disable triggers" setting',
        'Click "Save"',
        'There may also be custom Apex triggers created by your team that fire on events on Billing objects. If you have such triggers, you may consider disabling them too. Note that Salesforce only allows disabling Apex triggers in sandbox orgs, but your development team may have other mechanisms for disabling them in production, such as custom metadata types. ',
      ],
    },
    postAction: {
      title: 'Re-enable Salesforce Billing Triggers',
      description: 'Salesforce Billing triggers should now be re-enabled:',
      showOnFailure: true,
      subActions: [
        'In Salesforce, navigate to Setup > Installed Packages > Salesforce Billing > Configure',
        'Disable the "Disable triggers" setting',
        'Click "Save"',
        'If you disabled any custom Apex triggers before deploying, re-enable them now',
      ],
    },
  },
})

const changeValidator: ChangeValidator = async changes => {
  const billingInstance = changes
    .filter(isInstanceOfCustomObjectChangeSync)
    .map(change => getChangeData(change))
    .find(instance => getNamespaceSync(instance.getTypeSync()) === BILLING_NAMESPACE)
  return billingInstance !== undefined ? [getBillingError(billingInstance.elemID)] : []
}

export default changeValidator
