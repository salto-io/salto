/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Values } from '@salto-io/adapter-api'
import { e2eUtils } from '@salto-io/microsoft-security-adapter'

const {
  entraConstants: { TOP_LEVEL_TYPES: entraTopLevelTypes, ...entraConstants },
} = e2eUtils

export const mockDefaultValues: Record<string, Values> = {
  [entraTopLevelTypes.ADMINISTRATIVE_UNIT_TYPE_NAME]: {
    isMemberManagementRestricted: false,
  },
  [entraTopLevelTypes.APPLICATION_TYPE_NAME]: {
    isFallbackPublicClient: false,
    publisherDomain: 'e2eAdapter.onmicrosoft.com',
    signInAudience: 'AzureADMyOrg',
    parentalControlSettings: {
      legalAgeGroupRule: 'Allow',
    },
    web: {
      implicitGrantSettings: {
        enableAccessTokenIssuance: false,
        enableIdTokenIssuance: true,
      },
    },
  },
  [entraConstants.AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME]: {
    '_odata_type@mv': '#microsoft.graph.externalAuthenticationMethodConfiguration',
    state: 'disabled',
    openIdConnectSetting: {
      clientId: '00000000-0000-0000-0000-000000000000',
      discoveryUrl: 'https://e2e.test.authentication.method/',
    },
    includeTargets: [
      {
        targetType: 'group',
        id: 'all_users',
        isRegistrationRequired: false,
      },
    ],
  },
  [entraTopLevelTypes.AUTHENTICATION_METHOD_POLICY_TYPE_NAME]: {
    registrationEnforcement: {
      authenticationMethodsRegistrationCampaign: {
        snoozeDurationInDays: 5,
        enforceRegistrationAfterAllowedSnoozes: true,
        state: 'default',
        includeTargets: [
          {
            id: 'all_users',
            targetType: 'group',
            targetedAuthenticationMethod: 'microsoftAuthenticator',
          },
        ],
      },
    },
  },
  [entraTopLevelTypes.AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME]: {
    description: 'e2e test Authentication strength policy description',
    policyType: 'custom',
    requirementsSatisfied: 'mfa',
    allowedCombinations: ['fido2', 'x509CertificateMultiFactor', 'deviceBasedPush', 'password,sms'],
  },
  [entraTopLevelTypes.CONDITIONAL_ACCESS_POLICY_TYPE_NAME]: {
    conditions: {
      applications: {
        includeApplications: ['None'],
      },
      users: {
        includeUsers: ['None'],
      },
      clientAppTypes: ['all'],
    },
    grantControls: {
      operator: 'OR',
      builtInControls: ['block'],
    },
    state: 'enabledForReportingButNotEnforced',
  },
  [entraTopLevelTypes.CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME]: {
    '_odata_type@mv': '#microsoft.graph.countryNamedLocation',
    countriesAndRegions: ['IL'],
    includeUnknownCountriesAndRegions: false,
    countryLookupMethod: 'clientIpAddress',
  },
  [entraTopLevelTypes.DOMAIN_TYPE_NAME]: {
    authenticationType: 'Managed',
    isAdminManaged: true,
    isDefault: true,
    isInitial: true,
    isRoot: true,
    isVerified: true,
    supportedServices: ['Email', 'OfficeCommunicationsOnline'],
    passwordValidityPeriodInDays: 2147483647,
    passwordNotificationWindowInDays: 15,
  },
  [entraTopLevelTypes.GROUP_TYPE_NAME]: {
    groupTypes: ['DynamicMembership', 'Unified'],
    mailEnabled: true,
    membershipRule: '(user.country -eq "IL")',
    membershipRuleProcessingState: 'On',
    securityEnabled: false,
    visibility: 'Private',
  },
  [entraTopLevelTypes.LIFE_CYCLE_POLICY_TYPE_NAME]: {
    groupLifetimeInDays: 100,
    managedGroupTypes: 'Selected',
    alternateNotificationEmails: 'salto@e2eAdapter.onmicrosoft.com',
  },
  [entraTopLevelTypes.ROLE_DEFINITION_TYPE_NAME]: {
    isBuiltIn: false,
    isEnabled: true,
    templateId: '7780f1bb-6ca0-4bbc-9409-266983a87da4',
    rolePermissions: [
      {
        allowedResourceActions: ['microsoft.directory/users/identities/read'],
      },
    ],
  },
  [entraTopLevelTypes.SERVICE_PRINCIPAL_TYPE_NAME]: {
    accountEnabled: true,
    appRoleAssignmentRequired: true,
    servicePrincipalType: 'Application',
    tags: ['WindowsAzureActiveDirectoryCustomSingleSignOnApplication', 'WindowsAzureActiveDirectoryIntegratedApp'],
  },
}

export const modificationChangesBeforeAndAfterOverrides: Record<string, { before: Values; after: Values }> = {
  [entraTopLevelTypes.LIFE_CYCLE_POLICY_TYPE_NAME]: {
    before: { groupLifetimeInDays: 100 },
    after: { groupLifetimeInDays: 200 },
  },
  [entraTopLevelTypes.AUTHENTICATION_METHOD_POLICY_TYPE_NAME]: {
    before: {
      registrationEnforcement: {
        authenticationMethodsRegistrationCampaign: {
          snoozeDurationInDays: 1,
        },
      },
    },
    after: {
      registrationEnforcement: {
        authenticationMethodsRegistrationCampaign: {
          snoozeDurationInDays: 2,
        },
      },
    },
  },
  [entraTopLevelTypes.CUSTOM_SECURITY_ATTRIBUTE_SET_TYPE_NAME]: {
    before: {
      maxAttributesPerSet: 10,
    },
    after: {
      maxAttributesPerSet: 20,
    },
  },
  [entraTopLevelTypes.CUSTOM_SECURITY_ATTRIBUTE_DEFINITION_TYPE_NAME]: {
    after: { status: 'Available' },
    before: { status: 'Deprecated' },
  },
  [entraConstants.CUSTOM_SECURITY_ATTRIBUTE_ALLOWED_VALUES_TYPE_NAME]: {
    after: { isActive: true },
    before: { isActive: false },
  },
}
