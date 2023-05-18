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
import { Values } from '@salto-io/adapter-api'

export const mockDefaultValues: Record<string, Values> = {
  AccessPolicy: {
    status: 'ACTIVE',
    name: 'authentication policy',
    priority: 1,
    system: false,
    type: 'ACCESS_POLICY',
  },
  AccessPolicyRule: {
    status: 'ACTIVE',
    name: 'authentication rule',
    priority: 0,
    system: false,
    conditions: {
      network: { connection: 'ANYWHERE' },
      riskScore: { level: 'ANY' },
    },
    actions: {
      appSignOn: {
        access: 'ALLOW',
        verificationMethod: {
          factorMode: '2FA',
          type: 'ASSURANCE',
          reauthenticateIn: 'PT2H',
          constraints: [
            {
              knowledge: {
                types: ['password'],
                reauthenticateIn: 'PT2H',
              },
              possession: {
                deviceBound: 'REQUIRED',
              },
            },
          ],
        },
      },
    },
    type: 'ACCESS_POLICY',
  },
  Application: {
    label: 'SAML Test',
    status: 'INACTIVE',
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
    },
  },
  Group: {
    objectClass: ['okta:user_group'],
    type: 'OKTA_GROUP',
    profile: { name: 'Employees', description: 'all employees' },
  },
  GroupRule: {
    type: 'group_rule',
    status: 'INACTIVE',
    name: 'test',
    allGroupsValid: true,
  },
  NetworkZone: {
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
  ProfileEnrollmentPolicy: {},
  ProfileEnrollmentPolicyRule: {},
}
