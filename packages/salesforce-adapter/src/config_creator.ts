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

import {
  BuiltinTypes,
  ConfigCreator,
  ElemID,
  InstanceElement,
} from '@salto-io/adapter-api'
import {
  createDefaultInstanceFromType,
  createMatchingObjectType,
} from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { configType } from './types'
import * as constants from './constants'
import { CPQ_NAMESPACE, CUSTOM_OBJECT_ID_FIELD } from './constants'

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
            name: 'Marketo_?Email_?Templates/.*',
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
          {
            metadataType: 'EclairGeoData',
          },
          {
            metadataType:
              'OmniUiCard|OmniDataTransform|OmniIntegrationProcedure|OmniInteractionAccessConfig|OmniInteractionConfig|OmniScript',
          },
          {
            metadataType: 'DiscoveryAIModel',
          },
          {
            metadataType: 'Translations',
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
          'SBQQ__QuoteLineConsumptionRate__c',
          'SBQQ__InstallProcessorLog__c',
          'SBQQ__ProcessInputValue__c',
          'SBQQ__RecordJob__c',
          'SBQQ__TimingLog__c',
        ],
        allowReferenceTo: ['Product2', 'Pricebook2', 'PricebookEntry'],
        saltoIDSettings: {
          defaultIdFields: [CUSTOM_OBJECT_ID_FIELD],
        },
        brokenOutgoingReferencesSettings: {
          defaultBehavior: 'BrokenReference',
          perTargetTypeOverrides: {
            User: 'InternalId',
          },
        },
      },
    },
    maxItemsInRetrieveRequest: 2500,
  },
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
const isOptionsTypeInstance = (
  instance: InstanceElement,
): instance is InstanceElement & { value: ConfigOptionsType } => {
  if (instance.refType.elemID.isEqual(optionsElemId)) {
    return true
  }
  log.error(
    `Received an invalid instance for config options. Received instance with refType ElemId full name: ${instance.refType.elemID.getFullName()}`,
  )
  return false
}

export const getConfig = async (
  options?: InstanceElement,
): Promise<InstanceElement> => {
  const defaultConf = await createDefaultInstanceFromType(
    ElemID.CONFIG_NAME,
    configType,
  )
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
