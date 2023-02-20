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
import { ObjectType, ElemID, BuiltinTypes, toChange, InstanceElement, getChangeData } from '@salto-io/adapter-api'
import { APPLICATION_TYPE_NAME, OKTA, POLICY_TYPE_NAME } from '../src/constants'
import { flattenDiscriminatorFields, getDiscriminatorFields, getDiscriminatorTypeEntries } from '../src/discriminator'

describe('discriminator', () => {
  const appType = new ObjectType({
    elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME),
    fields: {
      signOnMode: { refType: BuiltinTypes.STRING },
      BOOKMARK: { refType: new ObjectType({
        elemID: new ElemID(OKTA, 'BookmarkApplication'),
        fields: {
          name: { refType: BuiltinTypes.STRING },
          settings: { refType: BuiltinTypes.UNKNOWN },
          credentials: { refType: BuiltinTypes.UNKNOWN },
        },
      }) },
      SAML_2_0: { refType: new ObjectType({
        elemID: new ElemID(OKTA, 'SamlApplication'),
        fields: {
          name: { refType: BuiltinTypes.STRING },
          settings: { refType: BuiltinTypes.UNKNOWN },
          credentials: { refType: BuiltinTypes.UNKNOWN },
        },
      }) },
    },
  })
  const appEntries = [
    {
      id: '123',
      name: 'bookmark',
      label: 'Sample Bookmark App',
      status: 'ACTIVE',
      accessibility: { selfService: false, errorRedirectUrl: null, loginRedirectUrl: null },
      visibility: {
        autoLaunch: false,
        autoSubmitToolbar: false,
        hide: { iOS: false, web: false },
        appLinks: { login: true },
      },
      signOnMode: 'BOOKMARK',
      credentials: { userNameTemplate: { template: '{source.login}', type: 'BUILT_IN' }, signing: {} },
      settings: { app: { requestIntegration: false, url: 'https://balba.com/bookmark.htm' }, notifications: { vpn: { network: { connection: 'DISABLED' }, message: null, helpUrl: null } }, notes: { admin: null, enduser: null } },
    },
    { id: '123',
      name: 'samltest_1',
      label: 'SAML Test',
      status: 'INACTIVE',
      accessibility: { selfService: false, errorRedirectUrl: null, loginRedirectUrl: null },
      visibility: { autoSubmitToolbar: false, hide: { iOS: false, web: false }, appLinks: { 'dev-77735201_dpsamltest_1_link': true } },
      signOnMode: 'SAML_2_0',
      credentials: { userNameTemplate: { template: '{source.login}', type: 'BUILT_IN' }, signing: { kid: 'kL1Y_qp8LBS_EZUWU3T83fva3e2FZ4MIQe8V1SoVTuw' } },
      settings: {
        app: {},
        notifications: { vpn: { network: { connection: 'DISABLED' }, message: null, helpUrl: null } },
        signOn: { defaultRelayState: '', ssoAcsUrl: 'https://sso.putman.io', idpIssuer: 'http://www.okta.com/{org.externalKey}', audience: 'https://app.salto.io', recipient: 'https://sso.putman.io', destination: 'https://sso.putman.io', subjectNameIdTemplate: '{user.userName}', subjectNameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified', responseSigned: true, assertionSigned: true, signatureAlgorithm: 'RSA_SHA256', digestAlgorithm: 'SHA256', honorForceAuthn: true, authnContextClassRef: 'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport', spIssuer: null, requestCompressed: false, attributeStatements: [], inlineHooks: [], allowMultipleAcsEndpoints: false, acsEndpoints: [], samlSignedRequestEnabled: false, slo: { enabled: false } },
      } },
  ]
  const appValuesAfterFetch = [
    {
      id: '123',
      label: 'Sample Bookmark App',
      status: 'ACTIVE',
      accessibility: { selfService: false, errorRedirectUrl: null, loginRedirectUrl: null },
      visibility: {
        autoLaunch: false,
        autoSubmitToolbar: false,
        hide: { iOS: false, web: false },
        appLinks: { login: true },
      },
      signOnMode: 'BOOKMARK',
      BOOKMARK: {
        name: 'bookmark',
        credentials: { userNameTemplate: { template: '{source.login}', type: 'BUILT_IN' }, signing: {} },
        settings: { app: { requestIntegration: false, url: 'https://balba.com/bookmark.htm' }, notifications: { vpn: { network: { connection: 'DISABLED' }, message: null, helpUrl: null } }, notes: { admin: null, enduser: null } },
      },
    },
    { id: '123',
      label: 'SAML Test',
      status: 'INACTIVE',
      accessibility: { selfService: false, errorRedirectUrl: null, loginRedirectUrl: null },
      visibility: { autoSubmitToolbar: false, hide: { iOS: false, web: false }, appLinks: { 'dev-77735201_dpsamltest_1_link': true } },
      signOnMode: 'SAML_2_0',
      SAML_2_0: {
        name: 'samltest_1',
        credentials: { userNameTemplate: { template: '{source.login}', type: 'BUILT_IN' }, signing: { kid: 'kL1Y_qp8LBS_EZUWU3T83fva3e2FZ4MIQe8V1SoVTuw' } },
        settings: {
          app: {},
          notifications: { vpn: { network: { connection: 'DISABLED' }, message: null, helpUrl: null } },
          signOn: { defaultRelayState: '', ssoAcsUrl: 'https://sso.putman.io', idpIssuer: 'http://www.okta.com/{org.externalKey}', audience: 'https://app.salto.io', recipient: 'https://sso.putman.io', destination: 'https://sso.putman.io', subjectNameIdTemplate: '{user.userName}', subjectNameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified', responseSigned: true, assertionSigned: true, signatureAlgorithm: 'RSA_SHA256', digestAlgorithm: 'SHA256', honorForceAuthn: true, authnContextClassRef: 'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport', spIssuer: null, requestCompressed: false, attributeStatements: [], inlineHooks: [], allowMultipleAcsEndpoints: false, acsEndpoints: [], samlSignedRequestEnabled: false, slo: { enabled: false } },
        },
      } },
  ]

  describe('getDiscriminatorFields', () => {
    const schemaDef = {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          readOnly: true,
        },
      },
      discriminator: {
        propertyName: 'signOnMode',
        mapping: {
          BOOKMARK: '#/components/schemas/BookmarkApplication',
          SAML_2_0: '#/components/schemas/SamlApplication',
        },
      },
    }
    const res = getDiscriminatorFields(schemaDef)
    expect(res).toEqual({
      BOOKMARK: {
        $ref: '#/components/schemas/BookmarkApplication',
        inheritParentProps: false,
      },
      SAML_2_0: {
        $ref: '#/components/schemas/SamlApplication',
        inheritParentProps: false,
      },
    })
  })
  describe('getDiscriminatorTypeEntries', () => {
    const policyType = new ObjectType({
      elemID: new ElemID(OKTA, POLICY_TYPE_NAME),
      fields: {
        MFA_ENROLL: { refType: new ObjectType({
          elemID: new ElemID(OKTA, 'MultifactorEnrollmentPolicy'),
          fields: {
            settings: { refType: BuiltinTypes.UNKNOWN },
            conditions: { refType: BuiltinTypes.UNKNOWN },
          },
        }) },
      },
    })
    const policyEntries = [
      { id: '123',
        status: 'INACTIVE',
        name: '2-Factors policy',
        priority: 1,
        system: false,
        conditions: { people: { groups: { include: [] } } },
        settings: { type: 'AUTHENTICATORS', authenticators: [{ key: 'okta_email', enroll: { self: 'REQUIRED' } }, { key: 'google_otp', enroll: { self: 'NOT_ALLOWED' } }, { key: 'okta_verify', enroll: { self: 'NOT_ALLOWED' } }, { key: 'okta_password', enroll: { self: 'REQUIRED' } }, { key: 'security_question', enroll: { self: 'NOT_ALLOWED' } }] },
        type: 'MFA_ENROLL' },
    ]
    it('should change the entries structure to match type', async () => {
      const appResults = await getDiscriminatorTypeEntries(appEntries, appType)
      expect(appResults).toHaveLength(2)
      expect(appResults).toEqual(appValuesAfterFetch)
      const policyResult = await getDiscriminatorTypeEntries(policyEntries, policyType)
      expect(policyResult).toHaveLength(1)
      expect(policyResult).toEqual([
        { id: '123',
          status: 'INACTIVE',
          name: '2-Factors policy',
          priority: 1,
          system: false,
          type: 'MFA_ENROLL',
          MFA_ENROLL: {
            conditions: { people: { groups: { include: [] } } },
            settings: { type: 'AUTHENTICATORS', authenticators: [{ key: 'okta_email', enroll: { self: 'REQUIRED' } }, { key: 'google_otp', enroll: { self: 'NOT_ALLOWED' } }, { key: 'okta_verify', enroll: { self: 'NOT_ALLOWED' } }, { key: 'okta_password', enroll: { self: 'REQUIRED' } }, { key: 'security_question', enroll: { self: 'NOT_ALLOWED' } }] },
          } },
      ])
    })
  })

  describe('flattenDiscriminatorFields', () => {
    it('should flatten fields that are part of discriminator type', async () => {
      const instances = appValuesAfterFetch.map(value => new InstanceElement(value.label, appType, value))
      const changes = instances.map(i => toChange({ after: i }))
      const res1 = await flattenDiscriminatorFields(changes[0])
      expect(getChangeData(res1).value).toEqual(appEntries[0])
      const res2 = await flattenDiscriminatorFields(changes[1])
      expect(getChangeData(res2).value).toEqual(appEntries[1])
    })
  })
})
