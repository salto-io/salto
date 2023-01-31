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

import { BuiltinTypes, ConfigCreator, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { createDefaultInstanceFromType, createMatchingObjectType } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { configType } from './types'
import * as constants from './constants'
import { CPQ_NAMESPACE } from './constants'

const log = logger(module)

export const configWithCPQ = new InstanceElement(
  ElemID.CONFIG_NAME,
  configType,
  {
    fetch: {
      metadata: {
        include: [
          {
            metadataType: '.*',
            namespace: '',
            name: '.*',
          },
          {
            metadataType: '.*',
            namespace: CPQ_NAMESPACE,
            name: '.*',
          },
          {
            metadataType: '.*',
            namespace: 'sbaa',
            name: '.*',
          },
        ],
        exclude: [
          {
            metadataType: 'Report',
          },
          {
            metadataType: 'ReportType',
          },
          {
            metadataType: 'ReportFolder',
          },
          {
            metadataType: 'Dashboard',
          },
          {
            metadataType: 'DashboardFolder',
          },
          {
            metadataType: 'Document',
          },
          {
            metadataType: 'DocumentFolder',
          },
          {
            metadataType: 'Profile',
          },
          {
            metadataType: 'PermissionSet',
          },
          {
            metadataType: 'SiteDotCom',
          },
          {
            metadataType: 'EmailTemplate',
            name: 'MarketoEmailTemplates/.*',
          },
          {
            metadataType: 'ContentAsset',
          },
          {
            metadataType: 'CustomObjectTranslation',
          },
          {
            metadataType: 'AnalyticSnapshot',
          },
          {
            metadataType: 'WaveDashboard',
          },
          {
            metadataType: 'WaveDataflow',
          },
          {
            metadataType: 'StandardValueSet',
            name: '^(AddressCountryCode)|(AddressStateCode)$',
            namespace: '',
          },
          {
            metadataType: 'Layout',
            name: 'CollaborationGroup-Group Layout',
          },
          {
            metadataType: 'Layout',
            name: 'CaseInteraction-Case Feed Layout',
          },
        ],
      },
      data: {
        includeObjects: [
          'SBQQ__.*',
          'sbaa__ApprovalChain__c',
          'sbaa__ApprovalCondition__c',
          'sbaa__ApprovalRule__c',
          'sbaa__ApprovalVariable__c',
          'sbaa__Approver__c',
          'sbaa__EmailTemplate__c',
          'sbaa__TrackedField__c',
        ],
        excludeObjects: [
          'SBQQ__ContractedPrice__c',
          'SBQQ__Quote__c',
          'SBQQ__QuoteDocument__c',
          'SBQQ__QuoteLine__c',
          'SBQQ__QuoteLineGroup__c',
          'SBQQ__Subscription__c',
          'SBQQ__SubscribedAsset__c',
          'SBQQ__SubscribedQuoteLine__c',
          'SBQQ__SubscriptionConsumptionRate__c',
          'SBQQ__SubscriptionConsumptionSchedule__c',
          'SBQQ__WebQuote__c',
          'SBQQ__WebQuoteLine__c',
          'SBQQ__QuoteLineConsumptionSchedule__c',
          'SBQQ__QuoteLineConsumptionsRate__c',
          'SBQQ__InstallProcessorLog__c',
          'SBQQ__ProcessInputValue__c',
          'SBQQ__RecordJob__c',
          'SBQQ__TimingLog__c',
        ],
        allowReferenceTo: [
          'Product2',
          'Pricebook2',
          'PricebookEntry',
        ],
        saltoIDSettings: {
          defaultIdFields: [
            '##allMasterDetailFields##',
            'Name',
          ],
          overrides: [
            {
              objectsRegex: 'SBQQ__CustomAction__c',
              idFields: [
                'SBQQ__Location__c',
                'SBQQ__DisplayOrder__c',
                'SBQQ__Type__c',
                'Name',
              ],
            },
            {
              objectsRegex: 'SBQQ__ProductFeature__c',
              idFields: [
                '##allMasterDetailFields##',
                'SBQQ__ConfiguredSKU__c',
                'SBQQ__Category__c',
                'SBQQ__Number__c',
                'Name',
              ],
            },
            {
              objectsRegex: 'SBQQ__ConfigurationAttribute__c',
              idFields: [
                '##allMasterDetailFields##',
                'SBQQ__Product__c',
                'SBQQ__Feature__c',
                'SBQQ__TargetField__c',
                'Name',
              ],
            },
            {
              objectsRegex: 'SBQQ__FavoriteProduct__c',
              idFields: [
                '##allMasterDetailFields##',
                'SBQQ__DynamicOptionId__c',
                'Name',
              ],
            },
            {
              objectsRegex: 'SBQQ__LineColumn__c',
              idFields: [
                '##allMasterDetailFields##',
                'SBQQ__FieldName__c',
                'Name',
              ],
            },
            {
              objectsRegex: 'SBQQ__LookupQuery__c',
              idFields: [
                '##allMasterDetailFields##',
                'SBQQ__PriceRule2__c',
                'Name',
              ],
            },
            {
              objectsRegex: 'SBQQ__TemplateContent__c',
              idFields: [
                '##allMasterDetailFields##',
                'SBQQ__Type__c',
                'Name',
              ],
            },
            {
              objectsRegex: 'SBQQ__Dimension__c',
              idFields: [
                '##allMasterDetailFields##',
                'SBQQ__Product__c',
                'Name',
              ],
            },
            {
              objectsRegex: 'PricebookEntry',
              idFields: [
                'Pricebook2Id',
                'Name',
              ],
            },
            {
              objectsRegex: 'Product2',
              idFields: [
                'Name',
                'ProductCode',
                'Family',
              ],
            },
            {
              objectsRegex: 'sbaa__ApprovalRule__c',
              idFields: [
                'Name',
                'sbaa__TargetObject__c',
                'sbaa__ApprovalChain__c',
                'sbaa__Approver__c',
                'sbaa__ApproverField__c',
              ],
            },
            {
              objectsRegex: 'sbaa__Approver__c',
              idFields: [
                'Name',
              ],
            },
            {
              objectsRegex: 'sbaa__EmailTemplate__c',
              idFields: [
                'Name',
                'sbaa__TemplateId__c',
              ],
            },
            {
              objectsRegex: 'sbaa__ApprovalCondition__c',
              idFields: [
                'sbaa__ApprovalRule__c',
                'sbaa__Index__c',
              ],
            },
            {
              objectsRegex: 'sbaa__ApprovalChain__c',
              idFields: [
                'sbaa__TargetObject__c',
                'Name',
              ],
            },
            {
              objectsRegex: 'sbaa__ApprovalVariable__c',
              idFields: [
                'sbaa__TargetObject__c',
                'Name',
              ],
            },
            {
              objectsRegex: 'sbaa__TrackedField__c',
              idFields: [
                'sbaa__ApprovalRule__c',
                'sbaa__RecordField__c',
                'sbaa__TrackedField__c',
                'sbaa__TrackedObject__c',
                'sbaa__TrackingType__c',
              ],
            },
          ],
        },
      },
    },
    maxItemsInRetrieveRequest: 2500,
  }
)

const optionsElemId = new ElemID(constants.SALESFORCE, 'configOptionsType')

type ConfigOptionsType = {
  cpq?: boolean
}

export const optionsType = createMatchingObjectType<ConfigOptionsType>({
  elemID: optionsElemId,
  fields: {
    cpq: { refType: BuiltinTypes.BOOLEAN },
  },
})
const isOptionsTypeInstance = (instance: InstanceElement):
  instance is InstanceElement & { value: ConfigOptionsType } => {
  if (instance.refType.elemID.isEqual(optionsElemId)) {
    return true
  }
  log.error(`Received an invalid instance for config options. Received instance with refType ElemId full name: ${instance.refType.elemID.getFullName()}`)
  return false
}

export const getConfig = async (
  options?: InstanceElement
): Promise<InstanceElement> => {
  const defaultConf = await createDefaultInstanceFromType(ElemID.CONFIG_NAME, configType)
  if (options === undefined || !isOptionsTypeInstance(options)) {
    return defaultConf
  }
  if (options.value.cpq === true) {
    return configWithCPQ
  }
  return defaultConf
}

export const configCreator: ConfigCreator = {
  optionsType,
  getConfig,
}
