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
import { Values } from '@salto-io/adapter-api'
import {
  ACCESS_POLICY_RULE_TYPE_NAME,
  ACCESS_POLICY_TYPE_NAME,
  APPLICATION_TYPE_NAME,
  APP_GROUP_ASSIGNMENT_TYPE_NAME,
  GROUP_RULE_TYPE_NAME,
  GROUP_TYPE_NAME,
  NETWORK_ZONE_TYPE_NAME,
  PROFILE_ENROLLMENT_POLICY_TYPE_NAME,
  PROFILE_ENROLLMENT_RULE_TYPE_NAME,
  USER_SCHEMA_TYPE_NAME,
  BRAND_TYPE_NAME,
  BRAND_THEME_TYPE_NAME,
  DOMAIN_TYPE_NAME,
} from '../src/constants'

export const mockDefaultValues: Record<string, Values> = {
  [ACCESS_POLICY_TYPE_NAME]: {
    status: 'ACTIVE',
    name: 'authentication policy',
    system: false,
    type: 'ACCESS_POLICY',
  },
  [ACCESS_POLICY_RULE_TYPE_NAME]: {
    status: 'ACTIVE',
    name: 'authentication rule',
    system: false,
    conditions: {
      network: { connection: 'ANYWHERE' },
      riskScore: { level: 'ANY' },
    },
    actions: {
      appSignOn: {
        access: 'ALLOW',
        verificationMethod: {
          factorMode: '1FA',
          type: 'ASSURANCE',
          reauthenticateIn: 'PT43800H',
        },
      },
    },
    type: 'ACCESS_POLICY',
  },
  [APPLICATION_TYPE_NAME]: {
    label: 'SAML Test',
    status: 'ACTIVE',
    accessibility: {
      selfService: false,
    },
    visibility: {
      autoLaunch: false,
      autoSubmitToolbar: false,
      hide: {
        iOS: true,
        web: true,
      },
    },
    signOnMode: 'SAML_2_0',
    credentials: {
      userNameTemplate: {
        // eslint-disable-next-line no-template-curly-in-string
        template: '${source.login}',
        type: 'BUILT_IN',
      },
    },
    settings: {
      notifications: {
        vpn: {
          network: {
            connection: 'DISABLED',
          },
        },
      },
      notes: {
        admin: 'test note',
        enduser: 'note',
      },
      signOn: {
        ssoAcsUrl: 'https://sso.test.io',
        // eslint-disable-next-line no-template-curly-in-string
        idpIssuer: 'http://www.okta.com/${org.externalKey}',
        audience: 'https://sso.test.io',
        recipient: 'https://sso.test.io',
        destination: 'https://sso.test.io',
        // eslint-disable-next-line no-template-curly-in-string
        subjectNameIdTemplate: '${user.userName}',
        subjectNameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified',
        responseSigned: true,
        assertionSigned: true,
        signatureAlgorithm: 'RSA_SHA256',
        digestAlgorithm: 'SHA256',
        honorForceAuthn: true,
        authnContextClassRef: 'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport',
        requestCompressed: false,
        allowMultipleAcsEndpoints: false,
        samlSignedRequestEnabled: false,
        slo: {
          enabled: false,
        },
      },
      manualProvisioning: false,
      implicitAssignment: false,
    },
  },
  [GROUP_TYPE_NAME]: {
    objectClass: ['okta:user_group'],
    type: 'OKTA_GROUP',
    profile: { name: 'Employees', description: 'all employees' },
  },
  [APP_GROUP_ASSIGNMENT_TYPE_NAME]: {
    priority: 0,
  },
  [GROUP_RULE_TYPE_NAME]: {
    type: 'group_rule',
    status: 'INACTIVE',
    name: 'test',
    allGroupsValid: true,
  },
  [NETWORK_ZONE_TYPE_NAME]: {
    type: 'IP',
    name: 'myNewZone',
    status: 'ACTIVE',
    usage: 'POLICY',
    system: false,
    gateways: [
      {
        type: 'RANGE',
        value: '100.100.100.100-100.100.100.100',
      },
    ],
  },
  [PROFILE_ENROLLMENT_POLICY_TYPE_NAME]: {
    status: 'ACTIVE',
    name: 'profile',
    system: false,
    type: 'PROFILE_ENROLLMENT',
  },
  [PROFILE_ENROLLMENT_RULE_TYPE_NAME]: {
    status: 'ACTIVE',
    name: 'Catch-all Rule',
    system: true,
    type: 'PROFILE_ENROLLMENT',
  },
  [USER_SCHEMA_TYPE_NAME]: {
    definitions: {
      base: {
        id: '#base',
        type: 'object',
        properties: {
          firstName: {
            title: 'First name',
            type: 'string',
            required: true,
            mutability: 'READ_WRITE',
            scope: 'NONE',
            minLength: 1,
            maxLength: 50,
            permissions: [{ principal: 'SELF', action: 'READ_WRITE' }],
            master: { type: 'PROFILE_MASTER' },
          },
          lastName: {
            title: 'Last name',
            type: 'string',
            required: true,
            mutability: 'READ_WRITE',
            scope: 'NONE',
            minLength: 1,
            maxLength: 50,
            permissions: [{ principal: 'SELF', action: 'READ_WRITE' }],
            master: { type: 'PROFILE_MASTER' },
          },
          email: {
            title: 'Primary email',
            type: 'string',
            required: true,
            format: 'email',
            mutability: 'READ_WRITE',
            scope: 'NONE',
            permissions: [{ principal: 'SELF', action: 'READ_WRITE' }],
            master: { type: 'PROFILE_MASTER' },
          },
        },
      },
    },
  },
  [BRAND_TYPE_NAME]: {
    removePoweredByOkta: false,
    agreeToCustomPrivacyPolicy: true,
  },
  [BRAND_THEME_TYPE_NAME]: {
    primaryColorHex: '#1662dd',
    primaryColorContrastHex: '#ffffff',
    secondaryColorHex: '#ebebed',
    secondaryColorContrastHex: '#000000',
    signInPageTouchPointVariant: 'OKTA_DEFAULT',
    endUserDashboardTouchPointVariant: 'OKTA_DEFAULT',
    errorPageTouchPointVariant: 'OKTA_DEFAULT',
    emailTemplateTouchPointVariant: 'OKTA_DEFAULT',
    loadingPageTouchPointVariant: 'OKTA_DEFAULT',
  },
  [DOMAIN_TYPE_NAME]: {
    certificateSourceType: 'OKTA_MANAGED',
    validationStatus: 'NOT_STARTED',
  },
}
