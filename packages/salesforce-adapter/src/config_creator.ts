/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  BuiltinTypes,
  ConfigCreator,
  CORE_ANNOTATIONS,
  createRestriction,
  ElemID,
  InstanceElement,
  ListType,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import {
  createDefaultInstanceFromType,
  createMatchingObjectType,
  createOptionsTypeGuard,
  inspectValue,
} from '@salto-io/adapter-utils'
import { configType } from './types'
import * as constants from './constants'
import {
  CPQ_NAMESPACE,
  CUSTOM_OBJECT_ID_FIELD,
  MUTING_PERMISSION_SET_METADATA_TYPE,
  PERMISSION_SET_GROUP_METADATA_TYPE,
  PERMISSION_SET_METADATA_TYPE,
  PROFILE_METADATA_TYPE,
} from './constants'

const log = logger(module)

const excludeProfilesAndPermissionSets = [
  {
    metadataType: PROFILE_METADATA_TYPE,
  },
  {
    metadataType: PERMISSION_SET_METADATA_TYPE,
  },
  {
    metadataType: MUTING_PERMISSION_SET_METADATA_TYPE,
  },
  {
    metadataType: PERMISSION_SET_GROUP_METADATA_TYPE,
  },
]

export const configWithCPQ = new InstanceElement(ElemID.CONFIG_NAME, configType, {
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
        {
          metadataType: 'ManagedEventSubscription',
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
})

const optionsElemId = new ElemID(constants.SALESFORCE, 'configOptionsType')

const CPQ_MANAGED_PACKAGE = 'sbaa, SBQQ (CPQ)'

const MANAGED_PACKAGES = [CPQ_MANAGED_PACKAGE] as const

type ManagedPackage = (typeof MANAGED_PACKAGES)[number]

export type SalesforceConfigOptionsType = {
  cpq?: boolean
  managedPackages?: ManagedPackage[]
  manageProfilesAndPermissionSets?: boolean
}

export const optionsType = createMatchingObjectType<SalesforceConfigOptionsType>({
  elemID: optionsElemId,
  fields: {
    cpq: { refType: BuiltinTypes.BOOLEAN },
    managedPackages: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          values: MANAGED_PACKAGES,
          enforce_value: true,
        }),
        [CORE_ANNOTATIONS.DESCRIPTION]:
          'Names of managed packages to fetch into the environment [Learn more](https://help.salto.io/en/articles/9164974-extending-your-salesforce-configuration-with-managed-packages)',
      },
    },
    manageProfilesAndPermissionSets: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.DEFAULT]: false,
        [CORE_ANNOTATIONS.DESCRIPTION]:
          'Manage Profiles, PermissionSets, MutingPermissionSets and PermissionSetGroups in the Environment',
      },
    },
  },
})

export const getConfig = async (options?: InstanceElement): Promise<InstanceElement> => {
  let configInstance = await createDefaultInstanceFromType(ElemID.CONFIG_NAME, configType)
  const appendProfilesAndPermissionSetsExclude = (instance: InstanceElement): void => {
    const excludeSection = instance.value.fetch?.metadata?.exclude
    if (Array.isArray(excludeSection)) {
      instance.value.fetch.metadata.exclude = [...excludeSection, ...excludeProfilesAndPermissionSets]
    } else {
      log.error(
        'Failed to exclude Profiles and PermissionSets due to invalid exclude section in config instance: %s',
        inspectValue(instance.value),
      )
    }
  }
  if (options === undefined || !createOptionsTypeGuard<SalesforceConfigOptionsType>(optionsElemId)(options)) {
    appendProfilesAndPermissionSetsExclude(configInstance)
    return configInstance
  }

  if (options.value.cpq === true || options.value.managedPackages?.includes(CPQ_MANAGED_PACKAGE)) {
    configInstance = configWithCPQ.clone()
  }
  const shouldIncludeProfilesAndPermissionSets = options.value.manageProfilesAndPermissionSets ?? false
  if (!shouldIncludeProfilesAndPermissionSets) {
    appendProfilesAndPermissionSetsExclude(configInstance)
  }
  return configInstance
}

export const configCreator: ConfigCreator = {
  optionsType,
  getConfig,
}
