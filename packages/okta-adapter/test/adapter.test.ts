/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import nock from 'nock'
import _ from 'lodash'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import {
  InstanceElement,
  Element,
  isInstanceElement,
  ObjectType,
  FetchResult,
  AdapterOperations,
  ElemID,
  toChange,
  Change,
  getChangeData,
  ProgressReporter,
  BuiltinTypes,
  ReferenceExpression,
  CORE_ANNOTATIONS,
  isObjectType,
  StaticFile,
  TemplateExpression,
} from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { adapter } from '../src/adapter_creator'
import { accessTokenCredentialsType } from '../src/auth'
import { DEFAULT_CONFIG } from '../src/user_config'
import fetchMockReplies from './fetch_mock_replies.json'
import {
  USER_TYPE_NAME,
  BRAND_TYPE_NAME,
  GROUP_TYPE_NAME,
  OKTA,
  DOMAIN_TYPE_NAME,
  USERTYPE_TYPE_NAME,
  DEVICE_ASSURANCE_TYPE_NAME,
  SMS_TEMPLATE_TYPE_NAME,
  LINKS_FIELD,
  APPLICATION_TYPE_NAME,
  INACTIVE_STATUS,
  CUSTOM_NAME_FIELD,
  ACTIVE_STATUS,
  SAML_2_0_APP,
  ORG_SETTING_TYPE_NAME,
  PROFILE_ENROLLMENT_POLICY_TYPE_NAME,
  ACCESS_POLICY_TYPE_NAME,
  BRAND_THEME_TYPE_NAME,
  GROUP_MEMBERSHIP_TYPE_NAME,
  AUTHORIZATION_SERVER,
  AUTHORIZATION_POLICY,
  APP_GROUP_ASSIGNMENT_TYPE_NAME,
  BRAND_LOGO_TYPE_NAME,
  FAV_ICON_TYPE_NAME,
  GROUP_SCHEMA_TYPE_NAME,
  PROFILE_MAPPING_TYPE_NAME,
  APP_LOGO_TYPE_NAME,
  NETWORK_ZONE_TYPE_NAME,
  GROUP_RULE_TYPE_NAME,
  USER_SCHEMA_TYPE_NAME,
} from '../src/constants'

const nullProgressReporter: ProgressReporter = {
  reportProgress: () => null,
}

const loadMockReplies = (filename: string): void => {
  const defs: nock.Definition[] = nock.loadDefs(`${__dirname}/mock_replies/${filename}`)
  defs.forEach(def => {
    if (def.scope === '') {
      def.scope = 'https://test.okta.com:443'
    }
  })
  nock.define(defs)
  nock.disableNetConnect()
  nock.enableNetConnect('raw.githubusercontent.com')
}

type MockReply = {
  url: string
  method: definitions.HTTPMethod
  params?: Record<string, string>
  response: unknown
}

const getMockFunction = (method: definitions.HTTPMethod, mockAxiosAdapter: MockAdapter): MockAdapter['onAny'] => {
  switch (method.toLowerCase()) {
    case 'get':
      return mockAxiosAdapter.onGet
    case 'put':
      return mockAxiosAdapter.onPut
    case 'post':
      return mockAxiosAdapter.onPost
    case 'patch':
      return mockAxiosAdapter.onPatch
    case 'delete':
      return mockAxiosAdapter.onDelete
    case 'head':
      return mockAxiosAdapter.onHead
    case 'options':
      return mockAxiosAdapter.onOptions
    default:
      return mockAxiosAdapter.onGet
  }
}

describe('adapter', () => {
  describe('fetch', () => {
    jest.setTimeout(10 * 5000)
    let mockAxiosAdapter: MockAdapter

    beforeEach(async () => {
      mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
      mockAxiosAdapter
        .onGet('/api/v1/org')
        .replyOnce(200, { id: 'accountId' })
        .onGet('/api/v1/org')
        .replyOnce(200, { id: 'accountId' })
      ;([...fetchMockReplies] as MockReply[]).forEach(({ url, method, params, response }) => {
        const mock = getMockFunction(method, mockAxiosAdapter).bind(mockAxiosAdapter)
        const handler = mock(url, !_.isEmpty(params) ? { params } : undefined)
        handler.replyOnce(200, response)
      })
    })

    afterEach(() => {
      mockAxiosAdapter.restore()
      jest.clearAllMocks()
    })

    describe('full fetch with default config', () => {
      let elements: Element[]
      beforeEach(async () => {
        mockAxiosAdapter
          .onGet('/.well-known/okta-organization')
          .replyOnce(200, { id: '00o1lvvlyBZMbsvu6696', pipeline: 'idx' })
        elements = (
          await adapter
            .operations({
              credentials: new InstanceElement('config', accessTokenCredentialsType, {
                baseUrl: 'https://test.okta.com',
                token: 't',
              }),
              config: new InstanceElement('config', adapter.configType as ObjectType, DEFAULT_CONFIG),
              elementsSource: buildElementsSourceFromElements([]),
            })
            .fetch({ progressReporter: nullProgressReporter })
        ).elements
      })
      it('should generate the right types on fetch', async () => {
        expect([...new Set(elements.filter(isInstanceElement).map(e => e.elemID.typeName))].sort()).toEqual([
          'AccessPolicy',
          'AccessPolicyRule',
          'AccessPolicyRulePriority',
          'AppUserSchema',
          'Application',
          'ApplicationGroupAssignment',
          'Authenticator',
          'Automation',
          'AutomationRule',
          'BehaviorRule',
          'Brand',
          'BrandTheme',
          'BrowserPlugin',
          'DeviceAssurance',
          'Domain',
          'EmailNotifications',
          'EmbeddedSignInSuppport',
          'EndUserSupport',
          'Feature',
          'Group',
          'GroupPush',
          'GroupRule',
          'GroupSchema',
          'IdentityProviderPolicy',
          'IdentityProviderPolicyRule',
          'IdentityProviderPolicyRulePriority',
          'InlineHook',
          'NetworkZone',
          'OktaSignOnPolicy',
          'OktaSignOnPolicyPriority',
          'OktaSignOnPolicyRule',
          'OktaSignOnPolicyRulePriority',
          'PasswordPolicy',
          'PasswordPolicyPriority',
          'PasswordPolicyRule',
          'PasswordPolicyRulePriority',
          'PerClientRateLimitSettings',
          'ProfileMapping',
          'RateLimitAdminNotifications',
          'Reauthentication',
          'ResourceSet',
          'Role',
          'SmsTemplate',
          'ThirdPartyAdmin',
          'UserSchema',
          'UserType',
        ])
      })
      it('should generate the right instances on fetch', async () => {
        expect(
          elements
            .filter(isInstanceElement)
            .map(e => e.elemID.getFullName())
            .sort(),
        ).toEqual([
          'okta.AccessPolicy.instance.Classic_Migrated@s',
          'okta.AccessPolicy.instance.Default_Policy@s',
          'okta.AccessPolicy.instance.Microsoft_Office_365@s',
          'okta.AccessPolicy.instance.Neta_test1234@s',
          'okta.AccessPolicy.instance.Okta_Admin_Console@s',
          'okta.AccessPolicy.instance.One_factor_access@s',
          'okta.AccessPolicy.instance.Password_only@s',
          'okta.AccessPolicy.instance.Seamless_access_based_on_network_context@s',
          'okta.AccessPolicy.instance.custom_policy@s',
          'okta.AccessPolicyRule.instance.Classic_Migrated_s__Catch_all_Rule@umuubs',
          'okta.AccessPolicyRule.instance.Default_Policy__Catch_all_Rule@suubs',
          'okta.AccessPolicyRule.instance.Default_Policy__shir_test@suus',
          'okta.AccessPolicyRule.instance.Microsoft_Office_365_s__Allow_Web_and_Modern_Auth@uumuussss',
          'okta.AccessPolicyRule.instance.Microsoft_Office_365_s__Catch_all_Rule@uumuubs',
          'okta.AccessPolicyRule.instance.Neta_test1234_s__Catch_all_Rule@umuubs',
          'okta.AccessPolicyRule.instance.Okta_Admin_Console_s__Admin_App_Policy@uumuuss',
          'okta.AccessPolicyRule.instance.Okta_Admin_Console_s__Catch_all_Rule@uumuubs',
          'okta.AccessPolicyRule.instance.One_factor_access_s__Catch_all_Rule@uumuubs',
          'okta.AccessPolicyRule.instance.Password_only_s__Catch_all_Rule@umuubs',
          'okta.AccessPolicyRule.instance.Seamless_access_based_on_network_context_s__Catch_all_Rule@uuuuumuubs',
          'okta.AccessPolicyRule.instance.Seamless_access_based_on_network_context_s__In_network@uuuuumuus',
          'okta.AccessPolicyRule.instance.Seamless_access_based_on_network_context_s__Off_network@uuuuumuus',
          'okta.AccessPolicyRule.instance.custom_policy_s__Catch_all_Rule@umuubs',
          'okta.AccessPolicyRule.instance.custom_policy_s__Low_Assurance2_0@umuusv',
          'okta.AccessPolicyRule.instance.custom_policy_s__Low_Assurance@umuus',
          'okta.AccessPolicyRule.instance.custom_policy_s__Test_dpelotmwnt@umuus',
          'okta.AccessPolicyRule.instance.custom_policy_s__another_rule@umuus',
          'okta.AccessPolicyRule.instance.custom_policy_s__custom_rule@umuus',
          'okta.AccessPolicyRulePriority.instance.Classic_Migrated_priority@su',
          'okta.AccessPolicyRulePriority.instance.Default_Policy_priority@su',
          'okta.AccessPolicyRulePriority.instance.Microsoft_Office_365_priority@ssu',
          'okta.AccessPolicyRulePriority.instance.Neta_test1234_priority@su',
          'okta.AccessPolicyRulePriority.instance.Okta_Admin_Console_priority@ssu',
          'okta.AccessPolicyRulePriority.instance.One_factor_access_priority@ssu',
          'okta.AccessPolicyRulePriority.instance.Password_only_priority@su',
          'okta.AccessPolicyRulePriority.instance.Seamless_access_based_on_network_context_priority@sssssu',
          'okta.AccessPolicyRulePriority.instance.custom_policy_priority@su',
          'okta.AppUserSchema.instance.Auth0',
          'okta.AppUserSchema.instance.Microsoft_Office_365_s@uum',
          'okta.AppUserSchema.instance.Okta_Access_Requests_s@uum',
          'okta.AppUserSchema.instance.Okta_Workflows_OAuth_s@uum',
          'okta.AppUserSchema.instance.Okta_Workflows_s@um',
          'okta.AppUserSchema.instance.Salto_Okta_Adapter_OAuth_s@uuum',
          'okta.AppUserSchema.instance.Salto_Staging_s@um',
          'okta.AppUserSchema.instance.Zendesk',
          'okta.AppUserSchema.instance.test_test_s@um',
          'okta.Application.instance.Auth0',
          'okta.Application.instance.Microsoft_Office_365@s',
          'okta.Application.instance.Okta_Access_Requests@s',
          'okta.Application.instance.Okta_Admin_Console@s',
          'okta.Application.instance.Okta_Browser_Plugin@s',
          'okta.Application.instance.Okta_Dashboard@s',
          'okta.Application.instance.Okta_Workflows@s',
          'okta.Application.instance.Okta_Workflows_OAuth@s',
          'okta.Application.instance.Salto_Okta_Adapter_OAuth@s',
          'okta.Application.instance.Salto_Staging@s',
          'okta.Application.instance.Zendesk',
          'okta.Application.instance.test_test@s',
          'okta.ApplicationGroupAssignment.instance.Salto_Staging_s__best_admins_ever_s@umuuuum',
          'okta.ApplicationGroupAssignment.instance.Zendesk__best_admins_ever_s@uuuum',
          'okta.ApplicationGroupAssignment.instance.Zendesk__test_group_s@uuum',
          'okta.Authenticator.instance.Email',
          'okta.Authenticator.instance.Google_Authenticator@s',
          'okta.Authenticator.instance.Okta_Verify@s',
          'okta.Authenticator.instance.Password',
          'okta.Authenticator.instance.Phone',
          'okta.Authenticator.instance.Security_Key_or_Biometric@s',
          'okta.Authenticator.instance.Security_Question@s',
          'okta.Automation.instance.Idp_Discovery_Policy@s',
          'okta.AutomationRule.instance.Idp_Discovery_Policy_s__Default_Rule@uumuus',
          'okta.BehaviorRule.instance.New_City@s',
          'okta.BehaviorRule.instance.New_Country@s',
          'okta.BehaviorRule.instance.New_Device@s',
          'okta.BehaviorRule.instance.New_Geo_Location@sb',
          'okta.BehaviorRule.instance.New_IP@s',
          'okta.BehaviorRule.instance.New_State@s',
          'okta.BehaviorRule.instance.Velocity',
          'okta.Brand.instance.Shir_Brand_Test@b',
          'okta.Brand.instance.salto_org_4289783@b',
          'okta.BrandTheme.instance.Shir_Brand_Test_b@uum',
          'okta.BrandTheme.instance.salto_org_4289783_b@uum',
          'okta.BrowserPlugin.instance',
          'okta.DeviceAssurance.instance.IOS_policy@s',
          'okta.DeviceAssurance.instance.another_test@s',
          'okta.DeviceAssurance.instance.mac_policy___updated@ssbs',
          'okta.DeviceAssurance.instance.some_test@s',
          'okta.DeviceAssurance.instance.test_device_assurance@s',
          'okta.DeviceAssurance.instance.windows_policy@s',
          'okta.Domain.instance.salto_okta_com@v',
          'okta.Domain.instance.test_salto_io@v',
          'okta.EmailNotifications.instance',
          'okta.EmbeddedSignInSuppport.instance',
          'okta.EndUserSupport.instance',
          'okta.Feature.instance.Direct_Authentication@s',
          'okta.Feature.instance.Okta_Verify_user_verification_with_passcode@s',
          'okta.Group.instance.Engineers',
          'okta.Group.instance.Everyone',
          'okta.Group.instance.Okta_Administrators@s',
          'okta.Group.instance.best_admins_ever@s',
          'okta.Group.instance.ido_group@s',
          'okta.Group.instance.test_group@s',
          'okta.GroupPush.instance.Okta_Access_Requests_s__best_admins_ever_s@uumuuuum',
          'okta.GroupRule.instance.rule_with_missign_ref@s',
          'okta.GroupSchema.instance.Okta_group@s',
          'okta.IdentityProviderPolicy.instance.Default_Policy@s',
          'okta.IdentityProviderPolicyRule.instance.Default_Policy_s__Default_Rule@umuus',
          'okta.IdentityProviderPolicyRulePriority.instance.Default_Policy_priority@su',
          'okta.InlineHook.instance.phone_hook@s',
          'okta.NetworkZone.instance.BlockedIpZone',
          'okta.NetworkZone.instance.LegacyIpZone',
          'okta.OktaSignOnPolicy.instance.Default_Policy@s',
          'okta.OktaSignOnPolicyPriority.instance.OktaSignOnPolicy_priority',
          'okta.OktaSignOnPolicyRule.instance.Default_Policy_s__Catch_all_Rule@umuubs',
          'okta.OktaSignOnPolicyRulePriority.instance.Default_Policy_priority@su',
          'okta.PasswordPolicy.instance.Default_Policy@s',
          'okta.PasswordPolicyPriority.instance.PasswordPolicy_priority',
          'okta.PasswordPolicyRule.instance.Default_Policy_s__Default_Rule@umuus',
          'okta.PasswordPolicyRulePriority.instance.Default_Policy_priority@su',
          'okta.PerClientRateLimitSettings.instance',
          'okta.ProfileMapping.instance.Auth0_user',
          'okta.ProfileMapping.instance.Okta_Access_Requests_s_user@uumu',
          'okta.ProfileMapping.instance.Okta_Workflows_OAuth_s_user@uumu',
          'okta.ProfileMapping.instance.Salto_Okta_Adapter_OAuth_s_user@uuumu',
          'okta.ProfileMapping.instance.Salto_Staging_s_user@umu',
          'okta.ProfileMapping.instance.Zendesk_user',
          'okta.ProfileMapping.instance.test_test_s_user@umu',
          'okta.ProfileMapping.instance.user_Auth0',
          'okta.ProfileMapping.instance.user_Microsoft_Office_365_s@uuum',
          'okta.ProfileMapping.instance.user_Okta_Access_Requests_s@uuum',
          'okta.ProfileMapping.instance.user_Okta_Workflows_OAuth_s@uuum',
          'okta.ProfileMapping.instance.user_Okta_Workflows_s@uum',
          'okta.ProfileMapping.instance.user_Salto_Okta_Adapter_OAuth_s@uuuum',
          'okta.ProfileMapping.instance.user_Salto_Staging_s@uum',
          'okta.ProfileMapping.instance.user_Zendesk',
          'okta.ProfileMapping.instance.user_test_test_s@uum',
          'okta.RateLimitAdminNotifications.instance',
          'okta.Reauthentication.instance',
          'okta.ResourceSet.instance.Access_Certifications_Resource_Set@s',
          'okta.ResourceSet.instance.Access_Requests_Resource_Set@s',
          'okta.Role.instance.API_Access_Management_Administrator@s',
          'okta.Role.instance.Access_Certifications_Administrator@s',
          'okta.Role.instance.Access_Requests_Administrator@s',
          'okta.Role.instance.Application_Administrator@s',
          'okta.Role.instance.Group_Administrator@s',
          'okta.Role.instance.Group_Membership_Administrator@s',
          'okta.Role.instance.Help_Desk_Administrator@s',
          'okta.Role.instance.Mobile_Administrator@s',
          'okta.Role.instance.Organizational_Administrator@s',
          'okta.Role.instance.Read_Only_Administrator@bs',
          'okta.Role.instance.Report_Administrator@s',
          'okta.Role.instance.Super_Administrator@s',
          'okta.SmsTemplate.instance.Custom',
          'okta.SmsTemplate.instance.Default',
          'okta.ThirdPartyAdmin.instance',
          'okta.UserSchema.instance.user',
          'okta.UserType.instance.user',
        ])
      })
      it('should convert userIds to usernames when convertUserIds flag is enabled', async () => {
        const instanceWithUser = elements
          .filter(isInstanceElement)
          .find(inst => inst.elemID.typeName === 'EndUserSupport')
        expect(instanceWithUser?.value).toEqual({
          technicalContactEmail: 'myMail@salto.nacl',
          technicalContactId: 'myMail@salto.nacl',
          usermailEnabled: false,
        })
      })
    })
    describe('with different config options', () => {
      it('should not convertUserIds when convertUserIds flag is disabled', async () => {
        const config = new InstanceElement('config', adapter.configType as ObjectType, {
          ...DEFAULT_CONFIG,
          fetch: {
            convertUserIds: false,
            include: [
              { type: 'EndUserSupport' }, // limiting to one type to avoid getting a timeout
            ],
          },
        })
        const { elements } = await adapter
          .operations({
            credentials: new InstanceElement('config', accessTokenCredentialsType, {
              baseUrl: 'https://test.okta.com',
              token: 't',
            }),
            config,
            elementsSource: buildElementsSourceFromElements([]),
          })
          .fetch({ progressReporter: nullProgressReporter })
        const instanceWithUser = elements
          .filter(isInstanceElement)
          .find(inst => inst.elemID.typeName === 'EndUserSupport')
        expect(instanceWithUser?.value).toEqual({
          technicalContactEmail: 'myMail@salto.nacl',
          technicalContactId: 'myMail@salto.nacl',
          usermailEnabled: false,
        })
      })
      it('should fetch GroupMembership type when includeGroupMemberships flag is enabled', async () => {
        const config = new InstanceElement('config', adapter.configType as ObjectType, {
          ...DEFAULT_CONFIG,
          fetch: {
            includeGroupMemberships: true,
            include: [
              { type: 'Group' }, // limiting to one type to avoid getting a timeout
              { type: 'GroupMembership' },
            ],
          },
        })
        const { elements } = await adapter
          .operations({
            credentials: new InstanceElement('config', accessTokenCredentialsType, {
              baseUrl: 'https://test.okta.com',
              token: 't',
            }),
            config,
            elementsSource: buildElementsSourceFromElements([]),
          })
          .fetch({ progressReporter: nullProgressReporter })
        const groupMembersType = elements
          .filter(isObjectType)
          .find(e => e.elemID.typeName === GROUP_MEMBERSHIP_TYPE_NAME)
        expect(groupMembersType).toBeDefined()
        const groupMembersInstances = elements
          .filter(isInstanceElement)
          .filter(inst => inst.elemID.typeName === GROUP_MEMBERSHIP_TYPE_NAME)
        expect(groupMembersInstances).toHaveLength(1)
        expect(groupMembersInstances[0]?.value).toEqual({
          members: ['myMail@salto.nacl'],
        })
      })
    })
    describe('when connecting with oauth', () => {
      let fetchRes: FetchResult
      beforeEach(async () => {
        fetchRes = await adapter
          .operations({
            credentials: new InstanceElement('config', accessTokenCredentialsType, {
              authType: 'oauth',
              baseUrl: 'https://test.okta.com',
              clientId: '123',
              clientSecret: 'secret',
              refreshToken: 'refresh',
            }),
            config: new InstanceElement('config', adapter.configType as ObjectType, DEFAULT_CONFIG),
            elementsSource: buildElementsSourceFromElements([]),
          })
          .fetch({ progressReporter: nullProgressReporter })
      })
      it('should not fetch any privateApi types', () => {
        const instances = fetchRes.elements.filter(isInstanceElement)
        const groupPush = instances.filter(inst => inst.elemID.typeName === 'GroupPush')
        expect(groupPush).toHaveLength(0)
        const endUserSupport = instances.filter(inst => inst.elemID.typeName === 'EndUserSupport')
        expect(endUserSupport).toHaveLength(0)
      })
      it('should includes config suggestion and fetch warning to indicate usage of private api is disabled', () => {
        expect(fetchRes.errors).toHaveLength(1)
        expect(fetchRes.errors).toEqual([
          {
            message:
              'Salto could not access private API when connecting with OAuth. Group Push and Settings types could not be fetched',
            severity: 'Warning',
          },
        ])
        expect(fetchRes.updatedConfig?.message).toEqual('    * Private APIs can not be accessed when using OAuth login')
        expect(fetchRes.updatedConfig?.config[0]?.value?.client).toEqual({
          usePrivateAPI: false,
        })
      })
    })
    describe('when connecting a classic engine org', () => {
      let fetchRes: FetchResult
      beforeEach(async () => {
        // override the call to /.well-known/okta-organization to return a classic org
        // mockAxiosAdapter.restore('/.well-known/okta-organization')
        mockAxiosAdapter
          .onGet('/.well-known/okta-organization')
          .replyOnce(200, { id: '00o1lvvlyBZMbsvu6696', pipeline: 'v1' })
        fetchRes = await adapter
          .operations({
            credentials: new InstanceElement('config', accessTokenCredentialsType, {
              baseUrl: 'https://test.okta.com',
              token: 't',
            }),
            config: new InstanceElement('config', adapter.configType as ObjectType, DEFAULT_CONFIG),
            elementsSource: buildElementsSourceFromElements([]),
          })
          .fetch({ progressReporter: nullProgressReporter })
      })
      it('should create config suggestion to set isClassicOrg to true', () => {
        expect(fetchRes.updatedConfig?.config[0].value.fetch).toEqual({
          ...DEFAULT_CONFIG.fetch,
          isClassicOrg: true,
        })
        expect(fetchRes.updatedConfig?.message).toEqual(
          '    * We detected that your Okta organization is using the Classic Engine, therefore, certain types of data that are only compatible with newer versions were not fetched.',
        )
      })
    })
  })
  describe('deploy', () => {
    let operations: AdapterOperations

    let brandType: ObjectType
    let brand1: InstanceElement
    let appType: ObjectType
    let groupType: ObjectType
    let orgSettingType: ObjectType
    let userTypeType: ObjectType
    let userSchemaType: ObjectType

    beforeEach(() => {
      nock('https://test.okta.com:443').persist().get('/api/v1/org').reply(200, { id: 'accountId' })

      orgSettingType = new ObjectType({
        elemID: new ElemID(OKTA, ORG_SETTING_TYPE_NAME),
      })
      const orgSetting = new InstanceElement('_config', orgSettingType, { subdomain: 'subdomain' })

      operations = adapter.operations({
        credentials: new InstanceElement('config', accessTokenCredentialsType, {
          baseUrl: 'https://test.okta.com',
          token: 't',
        }),
        config: new InstanceElement('config', adapter.configType as ObjectType, DEFAULT_CONFIG),
        elementsSource: buildElementsSourceFromElements([orgSetting]),
      })

      brandType = new ObjectType({
        elemID: new ElemID(OKTA, BRAND_TYPE_NAME),
        fields: {
          id: {
            refType: BuiltinTypes.SERVICE_ID,
          },
        },
      })
      brand1 = new InstanceElement('brand1', brandType, {
        id: 'brand-fakeid1',
        name: 'subdomain.example.com',
        removePoweredByOkta: false,
      })
      appType = new ObjectType({
        elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME),
        fields: {
          id: {
            refType: BuiltinTypes.SERVICE_ID,
          },
        },
      })
      userTypeType = new ObjectType({
        elemID: new ElemID(OKTA, USERTYPE_TYPE_NAME),
        fields: {
          id: {
            refType: BuiltinTypes.SERVICE_ID,
          },
        },
      })
      userSchemaType = new ObjectType({
        elemID: new ElemID(OKTA, USER_SCHEMA_TYPE_NAME),
        fields: {
          id: {
            refType: BuiltinTypes.SERVICE_ID,
          },
        },
      })
    })

    describe('deploy authorization server policy', () => {
      let authorizationServerType: ObjectType
      let authorizationServerPolicyType: ObjectType
      let authorizationServer: InstanceElement

      beforeEach(() => {
        authorizationServerType = new ObjectType({
          elemID: new ElemID(OKTA, AUTHORIZATION_SERVER),
          fields: {
            id: {
              refType: BuiltinTypes.SERVICE_ID,
            },
          },
        })
        authorizationServer = new InstanceElement('authorizationServer', authorizationServerType, {
          id: 'authorizationserver-fakeid1',
        })
        authorizationServerPolicyType = new ObjectType({
          elemID: new ElemID(OKTA, AUTHORIZATION_POLICY),
          fields: {
            id: {
              refType: BuiltinTypes.SERVICE_ID,
            },
          },
        })
      })

      describe('deploy org setting', () => {
        it('should successfully modify org setting', async () => {
          loadMockReplies('org_setting_modify.json')
          const orgSetting = new InstanceElement(
            'orgSetting',
            orgSettingType,
            {
              id: 'orgsetting-fakeid1',
              subdomain: 'subdomain',
              phoneNumber: '00000',
            },
            undefined,
            {
              [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(brand1.elemID, brand1)],
            },
          )
          const updatedOrgSetting = orgSetting.clone()
          updatedOrgSetting.value.phoneNumber = '12345'
          const result = await operations.deploy({
            changeGroup: {
              groupID: 'orgSetting',
              changes: [toChange({ before: orgSetting, after: updatedOrgSetting })],
            },
            progressReporter: nullProgressReporter,
          })
          expect(result.errors).toHaveLength(0)
          expect(result.appliedChanges).toHaveLength(1)
          expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.phoneNumber).toEqual('12345')
          expect(nock.pendingMocks()).toHaveLength(0)
        })
      })

      it('should successfully add an active authorization server policy', async () => {
        loadMockReplies('authorization_server_policy_add_active.json')
        const authorizationServerPolicy = new InstanceElement(
          'authorizationServerPolicy',
          authorizationServerPolicyType,
          {
            name: 'my policy',
            status: ACTIVE_STATUS,
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(authorizationServer.elemID, authorizationServer)],
          },
        )
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'authorizationServerPolicy',
            changes: [toChange({ after: authorizationServerPolicy })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.id).toEqual(
          'authorizationserverpolicy-fakeid1',
        )
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully add an inactive authorization server policy', async () => {
        loadMockReplies('authorization_server_policy_add_inactive.json')
        const authorizationServerPolicy = new InstanceElement(
          'authorizationServerPolicy',
          authorizationServerPolicyType,
          {
            name: 'my policy',
            status: INACTIVE_STATUS,
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(authorizationServer.elemID, authorizationServer)],
          },
        )
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'authorizationServerPolicy',
            changes: [toChange({ after: authorizationServerPolicy })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.id).toEqual(
          'authorizationserverpolicy-fakeid1',
        )
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully activate an authorization server policy', async () => {
        loadMockReplies('authorization_server_policy_activate.json')
        const authorizationServerPolicy = new InstanceElement(
          'authorizationServerPolicy',
          authorizationServerPolicyType,
          {
            id: 'authorizationserverpolicy-fakeid1',
            name: 'my policy',
            status: INACTIVE_STATUS,
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(authorizationServer.elemID, authorizationServer)],
          },
        )
        const activatedAuthorizationServerPolicy = authorizationServerPolicy.clone()
        activatedAuthorizationServerPolicy.value.status = ACTIVE_STATUS
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'authorizationServerPolicy',
            changes: [toChange({ before: authorizationServerPolicy, after: activatedAuthorizationServerPolicy })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.id).toEqual(
          'authorizationserverpolicy-fakeid1',
        )
        expect(nock.pendingMocks()).toHaveLength(0)
      })
      it('should successfully deactivate an authorization server policy', async () => {
        loadMockReplies('authorization_server_policy_deactivate.json')
        const authorizationServerPolicy = new InstanceElement(
          'authorizationServerPolicy',
          authorizationServerPolicyType,
          {
            id: 'authorizationserverpolicy-fakeid1',
            name: 'my policy',
            status: ACTIVE_STATUS,
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(authorizationServer.elemID, authorizationServer)],
          },
        )
        const activatedAuthorizationServerPolicy = authorizationServerPolicy.clone()
        activatedAuthorizationServerPolicy.value.status = INACTIVE_STATUS
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'authorizationServerPolicy',
            changes: [toChange({ before: authorizationServerPolicy, after: activatedAuthorizationServerPolicy })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.id).toEqual(
          'authorizationserverpolicy-fakeid1',
        )
        expect(nock.pendingMocks()).toHaveLength(0)
      })
      it('should successfully modify an authorization server policy without status change', async () => {
        loadMockReplies('authorization_server_policy_modify.json')
        const authorizationServerPolicy = new InstanceElement(
          'authorizationServerPolicy',
          authorizationServerPolicyType,
          {
            id: 'authorizationserverpolicy-fakeid1',
            name: 'my policy',
            status: ACTIVE_STATUS,
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(authorizationServer.elemID, authorizationServer)],
          },
        )
        const activatedAuthorizationServerPolicy = authorizationServerPolicy.clone()
        activatedAuthorizationServerPolicy.value.name = 'your policy'
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'authorizationServerPolicy',
            changes: [toChange({ before: authorizationServerPolicy, after: activatedAuthorizationServerPolicy })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.name).toEqual('your policy')
        expect(nock.pendingMocks()).toHaveLength(0)
      })
      it('should successfully modify and activate an authorization server policy', async () => {
        loadMockReplies('authorization_server_policy_modify_and_activate.json')
        const authorizationServerPolicy = new InstanceElement(
          'authorizationServerPolicy',
          authorizationServerPolicyType,
          {
            id: 'authorizationserverpolicy-fakeid1',
            name: 'my policy',
            status: INACTIVE_STATUS,
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(authorizationServer.elemID, authorizationServer)],
          },
        )
        const activatedAuthorizationServerPolicy = authorizationServerPolicy.clone()
        activatedAuthorizationServerPolicy.value.name = 'your policy'
        activatedAuthorizationServerPolicy.value.status = ACTIVE_STATUS
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'authorizationServerPolicy',
            changes: [toChange({ before: authorizationServerPolicy, after: activatedAuthorizationServerPolicy })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.name).toEqual('your policy')
        expect(nock.pendingMocks()).toHaveLength(0)
      })
      it('should successfully modify and deactivate an authorization server policy', async () => {
        loadMockReplies('authorization_server_policy_modify_and_deactivate.json')
        const authorizationServerPolicy = new InstanceElement(
          'authorizationServerPolicy',
          authorizationServerPolicyType,
          {
            id: 'authorizationserverpolicy-fakeid1',
            name: 'my policy',
            status: ACTIVE_STATUS,
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(authorizationServer.elemID, authorizationServer)],
          },
        )
        const activatedAuthorizationServerPolicy = authorizationServerPolicy.clone()
        activatedAuthorizationServerPolicy.value.name = 'your policy'
        activatedAuthorizationServerPolicy.value.status = INACTIVE_STATUS
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'authorizationServerPolicy',
            changes: [toChange({ before: authorizationServerPolicy, after: activatedAuthorizationServerPolicy })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.name).toEqual('your policy')
        expect(nock.pendingMocks()).toHaveLength(0)
      })
      it('should successfully remove an authorization server policy', async () => {
        loadMockReplies('authorization_server_policy_remove.json')
        const authorizationServerPolicy = new InstanceElement(
          'authorizationServerPolicy',
          authorizationServerPolicyType,
          {
            id: 'authorizationserverpolicy-fakeid1',
            name: 'my policy',
            status: ACTIVE_STATUS,
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(authorizationServer.elemID, authorizationServer)],
          },
        )
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'authorizationServerPolicy',
            changes: [toChange({ before: authorizationServerPolicy })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(nock.pendingMocks()).toHaveLength(0)
      })
      groupType = new ObjectType({
        elemID: new ElemID(OKTA, GROUP_TYPE_NAME),
        fields: {
          id: {
            refType: BuiltinTypes.SERVICE_ID,
          },
        },
      })
    })

    describe('deploy network zone', () => {
      let networkZoneType: ObjectType

      beforeEach(() => {
        networkZoneType = new ObjectType({
          elemID: new ElemID(OKTA, NETWORK_ZONE_TYPE_NAME),
          fields: {
            id: {
              refType: BuiltinTypes.SERVICE_ID,
            },
          },
        })
      })

      it('should successfully add an active network zone', async () => {
        loadMockReplies('network_zone_add_active.json')
        const networkZone = new InstanceElement('networkZone', networkZoneType, {
          name: 'my_zone',
          status: ACTIVE_STATUS,
        })
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'networkZone',
            changes: [toChange({ after: networkZone })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.id).toEqual(
          'networkzone-fakeid1',
        )
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully add an inactive network zone', async () => {
        loadMockReplies('network_zone_add_inactive.json')
        const networkZone = new InstanceElement('networkZone', networkZoneType, {
          name: 'my_zone',
          status: INACTIVE_STATUS,
        })
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'networkZone',
            changes: [toChange({ after: networkZone })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.id).toEqual(
          'networkzone-fakeid1',
        )
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully activate a network zone', async () => {
        loadMockReplies('network_zone_activate.json')
        const networkZone = new InstanceElement('networkZone', networkZoneType, {
          id: 'networkzone-fakeid1',
          name: 'my_zone',
          status: INACTIVE_STATUS,
        })
        const activatedNetworkZone = networkZone.clone()
        activatedNetworkZone.value.status = ACTIVE_STATUS
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'networkZone',
            changes: [toChange({ before: networkZone, after: activatedNetworkZone })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.status).toEqual(ACTIVE_STATUS)
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully deactivate a network zone', async () => {
        loadMockReplies('network_zone_deactivate.json')
        const networkZone = new InstanceElement('networkZone', networkZoneType, {
          id: 'networkzone-fakeid1',
          name: 'my_zone',
          status: ACTIVE_STATUS,
        })
        const deactivatedNetworkZone = networkZone.clone()
        deactivatedNetworkZone.value.status = INACTIVE_STATUS
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'networkZone',
            changes: [toChange({ before: networkZone, after: deactivatedNetworkZone })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.status).toEqual(INACTIVE_STATUS)
        expect(nock.pendingMocks()).toHaveLength(0)
      })
      it('should successfully modify a network zone without status change', async () => {
        loadMockReplies('network_zone_modify.json')
        const networkZone = new InstanceElement('networkZone', networkZoneType, {
          id: 'networkzone-fakeid1',
          name: 'my_zone',
          status: ACTIVE_STATUS,
        })
        const updatedNetworkZone = networkZone.clone()
        updatedNetworkZone.value.name = 'your_zone'
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'networkZone',
            changes: [toChange({ before: networkZone, after: updatedNetworkZone })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.name).toEqual('your_zone')
        expect(nock.pendingMocks()).toHaveLength(0)
      })
      it('should successfully modify and activate a network zone', async () => {
        loadMockReplies('network_zone_modify_and_activate.json')
        const networkZone = new InstanceElement('networkZone', networkZoneType, {
          id: 'networkzone-fakeid1',
          name: 'my_zone',
          status: INACTIVE_STATUS,
        })
        const activatedNetworkZone = networkZone.clone()
        activatedNetworkZone.value.name = 'your_zone'
        activatedNetworkZone.value.status = ACTIVE_STATUS
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'networkZone',
            changes: [toChange({ before: networkZone, after: activatedNetworkZone })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.name).toEqual('your_zone')
        expect(nock.pendingMocks()).toHaveLength(0)
      })
      it('should successfully modify and deactivate a network zone', async () => {
        loadMockReplies('network_zone_modify_and_deactivate.json')
        const networkZone = new InstanceElement('networkZone', networkZoneType, {
          id: 'networkzone-fakeid1',
          name: 'my_zone',
          status: ACTIVE_STATUS,
        })
        const deactivatedNetworkZone = networkZone.clone()
        deactivatedNetworkZone.value.name = 'your_zone'
        deactivatedNetworkZone.value.status = INACTIVE_STATUS
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'networkZone',
            changes: [toChange({ before: networkZone, after: deactivatedNetworkZone })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.name).toEqual('your_zone')
        expect(nock.pendingMocks()).toHaveLength(0)
      })
      it('should successfully remove a network zone', async () => {
        loadMockReplies('network_zone_remove.json')
        const networkZone = new InstanceElement('networkZone', networkZoneType, {
          id: 'networkzone-fakeid1',
          name: 'my_zone',
          status: ACTIVE_STATUS,
        })
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'networkZone',
            changes: [toChange({ before: networkZone })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(nock.pendingMocks()).toHaveLength(0)
      })
    })

    describe('deploy group rule', () => {
      let groupRuleType: ObjectType
      let group: InstanceElement
      let userSchema: InstanceElement
      let groupRule: InstanceElement

      beforeEach(() => {
        const groupRuleGroupAssignmentType = new ObjectType({
          elemID: new ElemID(OKTA, 'GroupRuleGroupAssignment'),
        })
        const groupRuleActionsType = new ObjectType({
          elemID: new ElemID(OKTA, 'GroupRuleActions'),
          fields: {
            assignUserToGroups: {
              refType: groupRuleGroupAssignmentType,
            },
          },
        })
        groupRuleType = new ObjectType({
          elemID: new ElemID(OKTA, GROUP_RULE_TYPE_NAME),
          fields: {
            id: {
              refType: BuiltinTypes.SERVICE_ID,
            },
            actions: {
              refType: groupRuleActionsType,
            },
          },
        })
        group = new InstanceElement('group', groupType, {
          id: 'group-fakeid1',
          objectClass: ['okta:user_group'],
          type: 'OKTA_GROUP',
          profile: {
            name: 'Engineers',
            description: 'all the engineers',
          },
        })
        userSchema = new InstanceElement('userSchema', userSchemaType, {
          id: 'userschema-fakeid1',
          definitions: {
            base: {
              email: {
                type: 'string',
                title: 'email',
              },
            },
          },
        })
        groupRule = new InstanceElement('groupRule', groupRuleType, {
          name: 'my group rule',
          type: 'group_rule',
          conditions: {
            expression: {
              value: new TemplateExpression({
                parts: [
                  'substringAfter(',
                  new ReferenceExpression(
                    userSchema.elemID.createNestedID('definitions', 'base', 'properties', 'email'),
                  ),
                  ', \'@\')=="example.com"',
                ],
              }),
              type: 'urn:okta:expression:1.0',
            },
          },
          actions: {
            assignUserToGroups: { groupIds: [new ReferenceExpression(group.elemID, group)] },
          },
        })
      })

      it('should successfully add an active group rule', async () => {
        loadMockReplies('group_rule_add_active.json')
        groupRule.value.status = ACTIVE_STATUS
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'groupRule',
            changes: [toChange({ after: groupRule })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.id).toEqual('grouprule-fakeid1')
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully add an inactive group rule', async () => {
        loadMockReplies('group_rule_add_inactive.json')
        groupRule.value.status = INACTIVE_STATUS
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'groupRule',
            changes: [toChange({ after: groupRule })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.id).toEqual('grouprule-fakeid1')
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully activate a group rule', async () => {
        loadMockReplies('group_rule_activate.json')
        groupRule.value.status = INACTIVE_STATUS
        groupRule.value.id = 'grouprule-fakeid1'
        const activatedGroupRule = groupRule.clone()
        activatedGroupRule.value.status = ACTIVE_STATUS
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'groupRule',
            changes: [toChange({ before: groupRule, after: activatedGroupRule })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.status).toEqual(ACTIVE_STATUS)
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully deactivate a group rule', async () => {
        loadMockReplies('group_rule_deactivate.json')
        groupRule.value.status = ACTIVE_STATUS
        groupRule.value.id = 'grouprule-fakeid1'
        const deactivatedGroupRule = groupRule.clone()
        deactivatedGroupRule.value.status = INACTIVE_STATUS
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'groupRule',
            changes: [toChange({ before: groupRule, after: deactivatedGroupRule })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.status).toEqual(INACTIVE_STATUS)
        expect(nock.pendingMocks()).toHaveLength(0)
      })
      // TODO(SALTO-6485): Allow to modify an active group rule
      it('should successfully modify an inactive group rule without status change', async () => {
        loadMockReplies('group_rule_modify_inactive.json')
        groupRule.value.id = 'grouprule-fakeid1'
        groupRule.value.status = INACTIVE_STATUS
        const updatedGroupRule = groupRule.clone()
        updatedGroupRule.value.name = 'your group rule'
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'groupRule',
            changes: [toChange({ before: groupRule, after: updatedGroupRule })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.name).toEqual('your group rule')
        expect(nock.pendingMocks()).toHaveLength(0)
      })
      it('should successfully modify and activate a group rule', async () => {
        loadMockReplies('group_rule_modify_and_activate.json')
        groupRule.value.id = 'grouprule-fakeid1'
        groupRule.value.status = INACTIVE_STATUS
        const activatedGroupRule = groupRule.clone()
        activatedGroupRule.value.name = 'your group rule'
        activatedGroupRule.value.status = ACTIVE_STATUS
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'groupRule',
            changes: [toChange({ before: groupRule, after: activatedGroupRule })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.name).toEqual('your group rule')
        expect(nock.pendingMocks()).toHaveLength(0)
      })
      it('should successfully modify and deactivate a group rule', async () => {
        loadMockReplies('group_rule_modify_and_deactivate.json')
        groupRule.value.id = 'grouprule-fakeid1'
        groupRule.value.status = ACTIVE_STATUS
        const deactivatedGroupRule = groupRule.clone()
        deactivatedGroupRule.value.name = 'your group rule'
        deactivatedGroupRule.value.status = INACTIVE_STATUS
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'groupRule',
            changes: [toChange({ before: groupRule, after: deactivatedGroupRule })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.name).toEqual('your group rule')
        expect(nock.pendingMocks()).toHaveLength(0)
      })
      // TODO(SALTO-6485): Allow to remove an active group rule
      it('should successfully remove an inactive group rule', async () => {
        loadMockReplies('group_rule_remove_inactive.json')
        groupRule.value.id = 'grouprule-fakeid1'
        groupRule.value.status = INACTIVE_STATUS
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'groupRule',
            changes: [toChange({ before: groupRule })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(nock.pendingMocks()).toHaveLength(0)
      })
    })

    afterEach(() => {
      nock.cleanAll()
    })

    describe('deploy group', () => {
      let group1: InstanceElement
      beforeEach(() => {
        group1 = new InstanceElement('group1', groupType, {
          id: 'group-fakeid1',
          objectClass: ['okta:user_group'],
          type: 'OKTA_GROUP',
          profile: {
            name: 'Engineers',
            description: 'all the engineers',
          },
        })
      })

      it('should successfully add a group', async () => {
        loadMockReplies('group_add.json')
        const groupWithoutId = group1.clone()
        delete groupWithoutId.value.id
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'group',
            changes: [toChange({ after: groupWithoutId })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.id).toEqual('group-fakeid1')
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully modify a group', async () => {
        loadMockReplies('group_modify.json')
        const updatedGroup1 = group1.clone()
        updatedGroup1.value.profile.name = 'Programmers'
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'group',
            changes: [
              toChange({
                before: group1,
                after: updatedGroup1,
              }),
            ],
          },
          progressReporter: nullProgressReporter,
        })

        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully remove a group', async () => {
        loadMockReplies('group_remove.json')
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'group',
            changes: [toChange({ before: group1 })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(nock.pendingMocks()).toHaveLength(0)
      })
    })

    describe('deploy brand', () => {
      it('should successfully add a brand', async () => {
        loadMockReplies('brand_add.json')
        const brandWithoutId = new InstanceElement('brand1', brandType, {
          name: 'subdomain.example.com',
          removePoweredByOkta: false,
        })
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'brand',
            changes: [toChange({ after: brandWithoutId })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.id).toEqual('brand-fakeid1')
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully modify a brand', async () => {
        loadMockReplies('brand_modify.json')
        const updatedBrand1 = brand1.clone()
        updatedBrand1.value.removePoweredByOkta = true
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'brand',
            changes: [
              toChange({
                before: brand1,
                after: updatedBrand1,
              }),
            ],
          },
          progressReporter: nullProgressReporter,
        })

        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.removePoweredByOkta).toEqual(
          true,
        )
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully remove a brand', async () => {
        loadMockReplies('brand_remove.json')
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'brand',
            changes: [toChange({ before: brand1 })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(nock.pendingMocks()).toHaveLength(0)
      })
    })

    describe('deploy users', () => {
      let userType: ObjectType
      beforeEach(() => {
        userType = new ObjectType({
          elemID: new ElemID(OKTA, USER_TYPE_NAME),
          fields: {
            id: {
              refType: BuiltinTypes.SERVICE_ID,
            },
          },
        })
      })

      it('should successfully add a user', async () => {
        loadMockReplies('user_add.json')
        const user1 = new InstanceElement('user1', userType, {
          status: 'STAGED',
          profile: {
            login: 'a@a',
            email: 'a@a',
            firstName: 'a',
            lastName: 'a',
          },
        })
        const result = await operations.deploy({
          changeGroup: {
            groupID: user1.elemID.getFullName(),
            changes: [toChange({ after: user1 })],
          },
          progressReporter: nullProgressReporter,
        })

        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0]).elemID.getFullName()).toEqual('okta.User.instance.user1')
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.id).toEqual('fakeid123')
        expect(nock.pendingMocks()).toHaveLength(0)
      })
      it('should successfully modify a user', async () => {
        loadMockReplies('user_modify.json')
        const user1 = new InstanceElement('user1', userType, {
          id: 'fakeid123',
          status: 'STAGED',
          profile: {
            login: 'a@a',
            email: 'a@a',
            firstName: 'a',
            lastName: 'a',
          },
        })
        const updatedUser1 = user1.clone()
        updatedUser1.value.profile.firstName = 'b'
        const result = await operations.deploy({
          changeGroup: {
            groupID: user1.elemID.getFullName(),
            changes: [
              toChange({
                before: user1,
                after: updatedUser1,
              }),
            ],
          },
          progressReporter: nullProgressReporter,
        })

        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0]).elemID.getFullName()).toEqual('okta.User.instance.user1')
        expect(nock.pendingMocks()).toHaveLength(0)
      })
      it('should successfully remove a user', async () => {
        loadMockReplies('user_remove.json')
        const user1 = new InstanceElement('user1', userType, {
          id: 'fakeid123',
          status: 'PROVISIONED',
          profile: {
            login: 'a@a',
            email: 'a@a',
            firstName: 'a',
            lastName: 'a',
          },
        })
        const result = await operations.deploy({
          changeGroup: {
            groupID: user1.elemID.getFullName(),
            changes: [toChange({ before: user1 })],
          },
          progressReporter: nullProgressReporter,
        })

        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0]).elemID.getFullName()).toEqual('okta.User.instance.user1')
        expect(nock.pendingMocks()).toHaveLength(0)
      })
    })
    describe('deploy domain', () => {
      let domainType: ObjectType
      let domain: InstanceElement
      beforeEach(() => {
        domainType = new ObjectType({
          elemID: new ElemID(OKTA, DOMAIN_TYPE_NAME),
          fields: {
            id: {
              refType: BuiltinTypes.SERVICE_ID,
            },
          },
        })
        domain = new InstanceElement('domain', domainType, {
          id: 'domain-fakeid1',
          domain: 'subdomain.example.com',
          validationStatus: 'NOT_STARTED',
          brandId: new ReferenceExpression(brand1.elemID, brand1),
        })
      })

      it('should successfully add a domain', async () => {
        loadMockReplies('domain_add.json')
        const domainWithoutId = domain.clone()
        delete domainWithoutId.value.id
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'domain',
            changes: [toChange({ after: domainWithoutId })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.id).toEqual('domain-fakeid1')
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully modify a domain', async () => {
        loadMockReplies('domain_modify.json')
        // Domains may only modify their brand, so we'll test that.
        const brand2 = new InstanceElement('brand2', brandType, {
          id: 'brand-fakeid2',
          name: 'subdomain2.example.com',
        })
        const updatedDomain = domain.clone()
        updatedDomain.value.brandId = new ReferenceExpression(brand2.elemID, brand2)
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'domain',
            changes: [
              toChange({
                before: domain,
                after: updatedDomain,
              }),
            ],
          },
          progressReporter: nullProgressReporter,
        })

        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.brandId.value.value.id).toEqual(
          'brand-fakeid2',
        )
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully remove a domain', async () => {
        loadMockReplies('domain_remove.json')
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'domain',
            changes: [toChange({ before: domain })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(nock.pendingMocks()).toHaveLength(0)
      })
    })
    describe('deploy user type', () => {
      let userType: InstanceElement
      beforeEach(() => {
        userType = new InstanceElement('userType', userTypeType, {
          id: 'usertype-fakeid1',
          name: 'superuser',
          [LINKS_FIELD]: {
            schema: {
              rel: 'schema',
              href: 'https://<sanitized>/api/v1/meta/schemas/user/oscg64q0mq1aYdKLt697',
              method: 'GET',
            },
          },
        })
      })

      it('should successfully add a user type', async () => {
        loadMockReplies('user_type_add.json')
        const userTypeWithoutId = userType.clone()
        delete userTypeWithoutId.value.id
        delete userTypeWithoutId.value[LINKS_FIELD]
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'userType',
            changes: [toChange({ after: userTypeWithoutId })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.id).toEqual('usertype-fakeid1')
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value[LINKS_FIELD]).toEqual({
          schema: {
            rel: 'schema',
            href: 'https://<sanitized>/api/v1/meta/schemas/user/oscg64q0mq1aYdKLt697',
            method: 'GET',
          },
          self: {
            rel: 'self',
            href: 'https://<sanitized>/api/v1/meta/types/user/usertype-fakeid1',
            method: 'GET',
          },
        })
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully modify a user type', async () => {
        loadMockReplies('user_type_modify.json')
        const updatedUserType = userType.clone()
        updatedUserType.value.name = 'poweruser'
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'userType',
            changes: [
              toChange({
                before: userType,
                after: updatedUserType,
              }),
            ],
          },
          progressReporter: nullProgressReporter,
        })

        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.name).toEqual('poweruser')
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully remove a user type', async () => {
        loadMockReplies('user_type_remove.json')
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'domain',
            changes: [toChange({ before: userType })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(nock.pendingMocks()).toHaveLength(0)
      })
    })
    describe('deploy sms template', () => {
      let smsTemplateType: ObjectType
      let smsTemplate: InstanceElement
      beforeEach(() => {
        smsTemplateType = new ObjectType({
          elemID: new ElemID(OKTA, SMS_TEMPLATE_TYPE_NAME),
          fields: {
            id: {
              refType: BuiltinTypes.SERVICE_ID,
            },
          },
        })
        smsTemplate = new InstanceElement('smsTemplate', smsTemplateType, {
          id: 'smstemplate-fakeid1',
          name: 'Custom',
          // eslint-disable-next-line no-template-curly-in-string
          template: 'Your verification code is ${code}.',
        })
      })

      it('should successfully add an sms template', async () => {
        loadMockReplies('sms_template_add.json')
        const smsTemplateWithoutId = smsTemplate.clone()
        delete smsTemplateWithoutId.value.id
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'smsTemplate',
            changes: [toChange({ after: smsTemplateWithoutId })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.id).toEqual(
          'smstemplate-fakeid1',
        )
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully modify an sms template', async () => {
        loadMockReplies('sms_template_modify.json')
        const updatedSmsTemplate = smsTemplate.clone()
        // eslint-disable-next-line no-template-curly-in-string
        updatedSmsTemplate.value.template = 'Verify this: ${code}.'
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'smsTemplate',
            changes: [
              toChange({
                before: smsTemplate,
                after: updatedSmsTemplate,
              }),
            ],
          },
          progressReporter: nullProgressReporter,
        })

        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.template).toEqual(
          // eslint-disable-next-line no-template-curly-in-string
          'Verify this: ${code}.',
        )
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully remove an sms template', async () => {
        loadMockReplies('sms_template_remove.json')
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'smsTemplate',
            changes: [toChange({ before: smsTemplate })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(nock.pendingMocks()).toHaveLength(0)
      })
    })
    describe('deploy device assurance', () => {
      let deviceAssuranceType: ObjectType
      let deviceAssurance: InstanceElement
      beforeEach(() => {
        deviceAssuranceType = new ObjectType({
          elemID: new ElemID(OKTA, DEVICE_ASSURANCE_TYPE_NAME),
          fields: {
            id: {
              refType: BuiltinTypes.SERVICE_ID,
            },
          },
        })
        deviceAssurance = new InstanceElement('deviceAssurance', deviceAssuranceType, {
          id: 'deviceassurance-fakeid1',
          name: 'deviceassurance1',
        })
      })

      it('should successfully add a device assurance', async () => {
        loadMockReplies('device_assurance_add.json')
        const deviceAssuranceWithoutId = deviceAssurance.clone()
        delete deviceAssuranceWithoutId.value.id
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'deviceAssurance',
            changes: [toChange({ after: deviceAssuranceWithoutId })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.id).toEqual(
          'deviceassurance-fakeid1',
        )
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully modify a device assurance', async () => {
        loadMockReplies('device_assurance_modify.json')
        const updatedDeviceAssurance = deviceAssurance.clone()
        updatedDeviceAssurance.value.name = 'deviceassurance2'
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'deviceAssurance',
            changes: [
              toChange({
                before: deviceAssurance,
                after: updatedDeviceAssurance,
              }),
            ],
          },
          progressReporter: nullProgressReporter,
        })

        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.name).toEqual(
          'deviceassurance2',
        )
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully remove a device assurance', async () => {
        loadMockReplies('device_assurance_remove.json')
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'deviceAssurance',
            changes: [toChange({ before: deviceAssurance })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(nock.pendingMocks()).toHaveLength(0)
      })
    })
    describe('deploy application group assignment', () => {
      let appGroupAssignmentType: ObjectType
      let app: InstanceElement
      let group: InstanceElement

      beforeEach(() => {
        appGroupAssignmentType = new ObjectType({
          elemID: new ElemID(OKTA, APP_GROUP_ASSIGNMENT_TYPE_NAME),
        })

        app = new InstanceElement('app', appType, {
          id: 'app-fakeid1',
          name: 'app1',
          label: 'app1',
          signOnMode: 'AUTO_LOGIN',
          settings: {
            app: {
              url: 'https://app1.com',
            },
          },
        })
        group = new InstanceElement('group', groupType, {
          id: 'group-fakeid1',
        })
      })

      it('should successfully add an app group assignment', async () => {
        loadMockReplies('app_group_assignment_add.json')
        const appGroupAssignment = new InstanceElement(
          'appGroupAssignment',
          appGroupAssignmentType,
          {
            id: group.value.id,
            priority: 2,
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(app.elemID, app)],
          },
        )

        const result = await operations.deploy({
          changeGroup: {
            groupID: 'appGroupAssignment',
            changes: [toChange({ after: appGroupAssignment })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.id).toEqual('group-fakeid1')
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully modify an app group assignment', async () => {
        loadMockReplies('app_group_assignment_modify.json')
        const appGroupAssignment = new InstanceElement(
          'appGroupAssignment',
          appGroupAssignmentType,
          {
            id: group.value.id,
            priority: 2,
            // These are synthetic fields that we copy IDs to, since reference expressions can't be configured as
            // service IDs. We add them here to verify that they are not included in external requests.
            appId: 'app-fakeid1',
            groupId: 'group-fakeid1',
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(app.elemID, app)],
          },
        )
        const updatedAppGroupAssignment = appGroupAssignment.clone()
        updatedAppGroupAssignment.value.priority = 3
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'appGroupAssignment',
            changes: [toChange({ before: appGroupAssignment, after: updatedAppGroupAssignment })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.priority).toEqual(3)
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully remove an app group assignment', async () => {
        loadMockReplies('app_group_assignment_remove.json')
        const appGroupAssignment = new InstanceElement(
          'appGroupAssignment',
          appGroupAssignmentType,
          {
            id: group.value.id,
            priority: 2,
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(app.elemID, app)],
          },
        )
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'appGroupAssignment',
            changes: [toChange({ before: appGroupAssignment })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(nock.pendingMocks()).toHaveLength(0)
      })
    })
    describe('deploy application', () => {
      let profileEnrollmentPolicyType: ObjectType
      let profileEnrollmentPolicy1: InstanceElement
      let profileEnrollmentPolicy2: InstanceElement
      let accessPolicyType: ObjectType
      let accessPolicy: InstanceElement

      beforeEach(() => {
        profileEnrollmentPolicyType = new ObjectType({
          elemID: new ElemID(OKTA, PROFILE_ENROLLMENT_POLICY_TYPE_NAME),
        })
        profileEnrollmentPolicy1 = new InstanceElement('profileEnrollmentPolicy1', profileEnrollmentPolicyType, {
          id: 'enrollmentpolicy-fakeid1',
          name: 'enrollmentPolicy1',
        })
        profileEnrollmentPolicy2 = new InstanceElement('profileEnrollmentPolicy2', profileEnrollmentPolicyType, {
          id: 'enrollmentpolicy-fakeid2',
          name: 'enrollmentPolicy2',
        })
        accessPolicyType = new ObjectType({
          elemID: new ElemID(OKTA, ACCESS_POLICY_TYPE_NAME),
        })
        accessPolicy = new InstanceElement('accessPolicy', accessPolicyType, {
          id: 'accesspolicy-fakeid1',
          name: 'accessPolicy1',
        })
      })

      it('should successfully add an inactive regular application without policies', async () => {
        loadMockReplies('application_add_regular_inactive.json')
        const inactiveCustomApp = new InstanceElement('app', appType, {
          id: 'app-fakeid1',
          label: 'app1',
          status: INACTIVE_STATUS,
        })
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'app',
            changes: [toChange({ after: inactiveCustomApp })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.id).toEqual('app-fakeid1')
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully add an active regular application with policies', async () => {
        loadMockReplies('application_add_regular_active.json')
        const activeCustomApp = new InstanceElement('app', appType, {
          id: 'app-fakeid1',
          label: 'app1',
          status: ACTIVE_STATUS,
          profileEnrollment: new ReferenceExpression(profileEnrollmentPolicy1.elemID, profileEnrollmentPolicy1),
          accessPolicy: new ReferenceExpression(accessPolicy.elemID, accessPolicy),
        })
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'app',
            changes: [toChange({ after: activeCustomApp })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.id).toEqual('app-fakeid1')
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully add an inactive custom application', async () => {
        loadMockReplies('application_add_custom_inactive.json')
        const inactiveCustomApp = new InstanceElement('app', appType, {
          id: 'app-fakeid1',
          label: 'app1',
          status: INACTIVE_STATUS,
          signOnMode: SAML_2_0_APP,
        })
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'app',
            changes: [toChange({ after: inactiveCustomApp })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const instance = getChangeData(result.appliedChanges[0] as Change<InstanceElement>)
        expect(instance.value.id).toEqual('app-fakeid1')
        // This is based on the orgSettings subdomain and the service returned "name" field value
        expect(_.get(instance.value, CUSTOM_NAME_FIELD)).toEqual('subdomain_app1_1')
        expect(instance.value.name).toBeUndefined()
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully add an active custom application', async () => {
        loadMockReplies('application_add_custom_active.json')
        const activeCustomApp = new InstanceElement('app', appType, {
          id: 'app-fakeid1',
          label: 'app1',
          status: ACTIVE_STATUS,
          signOnMode: SAML_2_0_APP,
        })
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'app',
            changes: [toChange({ after: activeCustomApp })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        const instance = getChangeData(result.appliedChanges[0] as Change<InstanceElement>)
        expect(instance.value.id).toEqual('app-fakeid1')
        expect(_.get(instance.value, CUSTOM_NAME_FIELD)).toEqual('subdomain_app1_1')
        // This is based on the orgSettings subdomain and the service returned "name" field value
        expect(_.get(instance.value, CUSTOM_NAME_FIELD)).toEqual('subdomain_app1_1')
        expect(instance.value.name).toBeUndefined()
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully modify an inactive custom application with changed policies', async () => {
        loadMockReplies('application_modify_custom_inactive_with_changed_policies.json')
        const inactiveCustomApp = new InstanceElement('app', appType, {
          id: 'app-fakeid1',
          label: 'app1',
          status: INACTIVE_STATUS,
          [CUSTOM_NAME_FIELD]: 'subdomain_app1_1',
          profileEnrollment: new ReferenceExpression(profileEnrollmentPolicy1.elemID, profileEnrollmentPolicy1),
          accessPolicy: new ReferenceExpression(accessPolicy.elemID, accessPolicy),
        })
        const updatedApp = inactiveCustomApp.clone()
        updatedApp.value.label = 'app2'
        updatedApp.value.profileEnrollment = new ReferenceExpression(
          profileEnrollmentPolicy2.elemID,
          profileEnrollmentPolicy2,
        )
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'app',
            changes: [
              toChange({
                before: inactiveCustomApp,
                after: updatedApp,
              }),
            ],
          },
          progressReporter: nullProgressReporter,
        })

        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.label).toEqual('app2')
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully modify an active custom application with unchanged policies', async () => {
        loadMockReplies('application_modify_custom_active_unchanged_policies.json')
        const activeCustomApp = new InstanceElement('app', appType, {
          id: 'app-fakeid1',
          label: 'app1',
          status: ACTIVE_STATUS,
          [CUSTOM_NAME_FIELD]: 'subdomain_app1_1',
          profileEnrollment: new ReferenceExpression(profileEnrollmentPolicy1.elemID, profileEnrollmentPolicy1),
          accessPolicy: new ReferenceExpression(accessPolicy.elemID, accessPolicy),
        })
        const updatedApp = activeCustomApp.clone()
        updatedApp.value.label = 'app2'
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'app',
            changes: [
              toChange({
                before: activeCustomApp,
                after: updatedApp,
              }),
            ],
          },
          progressReporter: nullProgressReporter,
        })

        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.label).toEqual('app2')
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully modify an active custom application with only changed policies', async () => {
        loadMockReplies('application_modify_custom_active_only_changed_policies.json')
        const activeCustomApp = new InstanceElement('app', appType, {
          id: 'app-fakeid1',
          label: 'app1',
          status: ACTIVE_STATUS,
          [CUSTOM_NAME_FIELD]: 'subdomain_app1_1',
          profileEnrollment: new ReferenceExpression(profileEnrollmentPolicy1.elemID, profileEnrollmentPolicy1),
          accessPolicy: new ReferenceExpression(accessPolicy.elemID, accessPolicy),
        })
        const updatedApp = activeCustomApp.clone()
        updatedApp.value.profileEnrollment = new ReferenceExpression(
          profileEnrollmentPolicy2.elemID,
          profileEnrollmentPolicy2,
        )
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'app',
            changes: [
              toChange({
                before: activeCustomApp,
                after: updatedApp,
              }),
            ],
          },
          progressReporter: nullProgressReporter,
        })

        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.label).toEqual('app1')
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully remove an inactive custom application', async () => {
        loadMockReplies('application_remove_custom_inactive.json')
        const inactiveCustomApp = new InstanceElement('app', appType, {
          id: 'app-fakeid1',
          label: 'app1',
          status: INACTIVE_STATUS,
          [CUSTOM_NAME_FIELD]: 'subdomain_app1_1',
        })
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'app',
            changes: [toChange({ before: inactiveCustomApp })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully remove an active custom application', async () => {
        loadMockReplies('application_remove_custom_active.json')
        const inactiveCustomApp = new InstanceElement('app', appType, {
          id: 'app-fakeid1',
          label: 'app1',
          status: ACTIVE_STATUS,
          [CUSTOM_NAME_FIELD]: 'subdomain_app1_1',
        })
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'app',
            changes: [toChange({ before: inactiveCustomApp })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(nock.pendingMocks()).toHaveLength(0)
      })
    })
    describe('deploy group schema', () => {
      let groupSchemaType: ObjectType

      beforeEach(() => {
        groupSchemaType = new ObjectType({
          elemID: new ElemID(OKTA, GROUP_SCHEMA_TYPE_NAME),
          fields: {
            id: {
              refType: BuiltinTypes.SERVICE_ID,
            },
          },
        })
      })

      it('should successfully modify a group schema', async () => {
        loadMockReplies('group_schema_modify.json')
        const groupSchema = new InstanceElement(
          'groupSchema',
          groupSchemaType,
          {
            id: 'groupschema-fakeid1',
            description: 'my schema',
            definitions: {
              custom: {
                properties: {
                  MyProperty: {
                    title: 'My Property Title',
                    type: 'string',
                  },
                },
              },
            },
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(brand1.elemID, brand1)],
          },
        )
        const updatedGroupSchema = groupSchema.clone()
        updatedGroupSchema.value.description = 'your schema'
        // Schemas need to explicitly set deleted properties to `null`, so we check that here.
        delete updatedGroupSchema.value.definitions.custom.properties.MyProperty
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'groupSchema',
            changes: [toChange({ before: groupSchema, after: updatedGroupSchema })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.description).toEqual(
          'your schema',
        )
        expect(nock.pendingMocks()).toHaveLength(0)
      })
    })

    describe('deploy profile mapping', () => {
      let profileMappingType: ObjectType
      let app: InstanceElement
      let userType: InstanceElement

      beforeEach(() => {
        const profileMappingSourceType = new ObjectType({
          elemID: new ElemID(OKTA, 'ProfileMappingSource'),
          fields: {
            id: { refType: BuiltinTypes.STRING },
            type: { refType: BuiltinTypes.STRING },
            name: { refType: BuiltinTypes.STRING },
          },
        })
        profileMappingType = new ObjectType({
          elemID: new ElemID(OKTA, PROFILE_MAPPING_TYPE_NAME),
          fields: {
            id: { refType: BuiltinTypes.SERVICE_ID },
            source: { refType: profileMappingSourceType },
            target: { refType: profileMappingSourceType },
          },
        })
        app = new InstanceElement('app', appType, {
          id: 'app-fakeid1',
          name: 'app1',
        })
        userType = new InstanceElement('userType', userTypeType, {
          id: 'usertype-fakeid1',
          name: 'superuser',
        })
      })

      it('should successfully add a profile mapping', async () => {
        loadMockReplies('profile_mapping_add.json')
        const profileMapping = new InstanceElement('profileMapping', profileMappingType, {
          source: { id: new ReferenceExpression(userType.elemID, userType), type: 'user', name: userType.value.name },
          target: { id: new ReferenceExpression(app.elemID, app), type: 'appuser', name: app.value.name },
        })
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'profileMapping',
            changes: [toChange({ after: profileMapping })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.id).toEqual(
          'profilemapping-fakeid1',
        )
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully modify a profile mapping', async () => {
        loadMockReplies('profile_mapping_modify.json')
        const profileMapping = new InstanceElement('profileMapping', profileMappingType, {
          id: 'profilemapping-fakeid1',
          source: { id: new ReferenceExpression(userType.elemID, userType), type: 'user', name: userType.value.name },
          target: { id: new ReferenceExpression(app.elemID, app), type: 'appuser', name: app.value.name },
          properties: {
            name: {
              expression: 'user.displayName',
              pushStatus: 'PUSH',
            },
          },
        })
        const updatedProfileMapping = profileMapping.clone()
        updatedProfileMapping.value.properties.name.expression = 'user.name'
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'profileMapping',
            changes: [toChange({ before: profileMapping, after: updatedProfileMapping })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(
          getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.properties.name.expression,
        ).toEqual('user.name')
        expect(nock.pendingMocks()).toHaveLength(0)
      })
      // In production, a ProfileMapping can only be removed alongside one of its mapping sides (this is enforced by a
      // change validator). CVs don't run in this test though, so we only run the change group for the ProfileMapping
      // removal and the mock HTTP response will behave as if one of its sides was removed as well.
      it('should successfully remove a profile mapping', async () => {
        loadMockReplies('profile_mapping_remove.json')
        const profileMapping = new InstanceElement('profileMapping', profileMappingType, {
          id: 'profilemapping-fakeid1',
          source: { id: new ReferenceExpression(userType.elemID, userType), type: 'user', name: userType.value.name },
          target: { id: new ReferenceExpression(app.elemID, app), type: 'appuser', name: app.value.name },
        })
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'profileMapping',
            changes: [toChange({ before: profileMapping })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(nock.pendingMocks()).toHaveLength(0)
      })
    })

    describe('deploy brand theme', () => {
      let brandThemeType: ObjectType

      beforeEach(() => {
        brandThemeType = new ObjectType({
          elemID: new ElemID(OKTA, BRAND_THEME_TYPE_NAME),
          fields: {
            id: {
              refType: BuiltinTypes.SERVICE_ID,
            },
          },
        })
      })

      it('should successfully add a brand theme', async () => {
        loadMockReplies('brand_theme_add.json')
        const brandTheme = new InstanceElement(
          'brandTheme',
          brandThemeType,
          {
            primaryColorHex: '#1662ee',
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(brand1.elemID, brand1)],
          },
        )
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'brandTheme',
            changes: [toChange({ after: brandTheme })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.id).toEqual(
          'brandtheme-fakeid1',
        )
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully modify a brand theme', async () => {
        loadMockReplies('brand_theme_modify.json')
        const brandTheme = new InstanceElement(
          'brandTheme',
          brandThemeType,
          {
            id: 'brandtheme-fakeid1',
            primaryColorHex: '#1662ee',
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(brand1.elemID, brand1)],
          },
        )
        const updatedBrandTheme = brandTheme.clone()
        updatedBrandTheme.value.primaryColorHex = '#ff0000'
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'brandTheme',
            changes: [toChange({ before: brandTheme, after: updatedBrandTheme })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.primaryColorHex).toEqual(
          '#ff0000',
        )
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully remove a brand theme', async () => {
        loadMockReplies('brand_theme_remove.json')
        const brandTheme = new InstanceElement(
          'brandTheme',
          brandThemeType,
          {
            id: 'brandtheme-fakeid1',
            primaryColorHex: '#1662ee',
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(brand1.elemID, brand1)],
          },
        )
        // In production, a BrandTheme can only be removed alongside its parent Brand (this is enforced by a change
        // validator). CVs don't run in this test though, so we only run the change group for the BrandTheme removal
        // and the mock HTTP response will behave as if the Brand was removed as well.
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'brandTheme',
            changes: [toChange({ before: brandTheme })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should fail to remove a brand theme if it still exists', async () => {
        loadMockReplies('brand_theme_remove_failure.json')
        const brandTheme = new InstanceElement(
          'brandTheme',
          brandThemeType,
          {
            id: 'brandtheme-fakeid1',
            primaryColorHex: '#1662ee',
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(brand1.elemID, brand1)],
          },
        )
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'brandTheme',
            changes: [toChange({ before: brandTheme })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].message).toEqual('Expected BrandTheme to be deleted')
        expect(result.appliedChanges).toHaveLength(0)
        expect(nock.pendingMocks()).toHaveLength(0)
      })
    })
    describe('deploy brand theme files (logo and favicon)', () => {
      let brandThemeType: ObjectType
      let brandLogoType: ObjectType
      let brandFaviconType: ObjectType
      let brandTheme: InstanceElement
      let brandLogo: InstanceElement
      let brandFavicon: InstanceElement

      beforeEach(() => {
        brandThemeType = new ObjectType({
          elemID: new ElemID(OKTA, BRAND_THEME_TYPE_NAME),
          fields: {
            id: {
              refType: BuiltinTypes.SERVICE_ID,
            },
          },
        })
        brandLogoType = new ObjectType({
          elemID: new ElemID(OKTA, BRAND_LOGO_TYPE_NAME),
          fields: {},
        })
        brandFaviconType = new ObjectType({
          elemID: new ElemID(OKTA, FAV_ICON_TYPE_NAME),
          fields: {
            id: {
              refType: BuiltinTypes.SERVICE_ID,
            },
          },
        })
        brandTheme = new InstanceElement(
          'brandTheme',
          brandThemeType,
          {
            id: 'brandtheme-fakeid1',
            primaryColorHex: '#1662ee',
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(brand1.elemID, brand1)],
          },
        )
        brandLogo = new InstanceElement(
          'brandLogo',
          brandLogoType,
          {
            fileName: 'logo.png',
            content: new StaticFile({
              filepath: 'logo.png',
              encoding: 'binary',
              content: Buffer.from('logo-fake-binary-data'),
            }),
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [
              new ReferenceExpression(brandTheme.elemID, brandTheme),
              new ReferenceExpression(brand1.elemID, brand1),
            ],
          },
        )
        brandFavicon = new InstanceElement(
          'brandFavicon',
          brandFaviconType,
          {
            fileName: 'favicon.ico',
            content: new StaticFile({
              filepath: 'favicon.ico',
              encoding: 'binary',
              content: Buffer.from('favicon-fake-binary-data'),
            }),
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [
              new ReferenceExpression(brandTheme.elemID, brandTheme),
              new ReferenceExpression(brand1.elemID, brand1),
            ],
          },
        )
      })

      it('should successfully add brand theme files', async () => {
        // We need to use a regex for the POST body because the content is binary data and it's transmitted with a
        // random boundary string, etc., so we call nock programmatically instead of loading from a file.
        nock('https://test.okta.com/')
          .post('/api/v1/brands/brand-fakeid1/themes/brandtheme-fakeid1/logo', /logo-fake-binary-data/)
          .reply(201, { url: 'https://somepath.to/brandlogo-fakeid1' })
        nock('https://test.okta.com/')
          .post('/api/v1/brands/brand-fakeid1/themes/brandtheme-fakeid1/favicon', /favicon-fake-binary-data/)
          .reply(201)

        const result = await operations.deploy({
          changeGroup: {
            groupID: 'brandThemeFiles',
            changes: [toChange({ after: brandLogo }), toChange({ after: brandFavicon })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(2)
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully modify brand theme files', async () => {
        // We need to use a regex for the POST body because the content is binary data and it's transmitted with a
        // random boundary string, etc., so we call nock programmatically instead of loading from a file.
        nock('https://test.okta.com/')
          .post('/api/v1/brands/brand-fakeid1/themes/brandtheme-fakeid1/logo', /updated-logo-fake-binary-data/)
          .reply(201)
        nock('https://test.okta.com/')
          .post('/api/v1/brands/brand-fakeid1/themes/brandtheme-fakeid1/favicon', /updated-favicon-fake-binary-data/)
          .reply(201)

        const updatedBrandLogo = brandLogo.clone()
        updatedBrandLogo.value.content = new StaticFile({
          filepath: 'logo.png',
          encoding: 'binary',
          content: Buffer.from('updated-logo-fake-binary-data'),
        })
        const updatedBrandFavicon = brandFavicon.clone()
        updatedBrandFavicon.value.content = new StaticFile({
          filepath: 'favicon.ico',
          encoding: 'binary',
          content: Buffer.from('updated-favicon-fake-binary-data'),
        })
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'brandThemeFiles',
            changes: [
              toChange({ before: brandLogo, after: updatedBrandLogo }),
              toChange({ before: brandFavicon, after: updatedBrandFavicon }),
            ],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(2)
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully remove brand theme files', async () => {
        loadMockReplies('brand_theme_files_remove.json')
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'brandThemeFiles',
            changes: [toChange({ before: brandLogo }), toChange({ before: brandFavicon })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(2)
        expect(nock.pendingMocks()).toHaveLength(0)
      })
    })
    describe('deploy app logo', () => {
      let appLogoType: ObjectType
      let app: InstanceElement
      let appLogo: InstanceElement

      beforeEach(() => {
        appLogoType = new ObjectType({
          elemID: new ElemID(OKTA, APP_LOGO_TYPE_NAME),
          fields: {
            id: {
              refType: BuiltinTypes.SERVICE_ID,
            },
          },
        })
        app = new InstanceElement('app', appType, {
          id: 'app-fakeid1',
          name: 'app1',
          label: 'app1',
          signOnMode: 'AUTO_LOGIN',
          settings: {
            app: {
              url: 'https://app1.com',
            },
          },
        })
        appLogo = new InstanceElement(
          'appLogo',
          appLogoType,
          {
            fileName: 'logo.png',
            content: new StaticFile({
              filepath: 'applogo.png',
              encoding: 'binary',
              content: Buffer.from('logo-fake-binary-data'),
            }),
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(app.elemID, app)],
          },
        )
      })

      it('should successfully add an app logo', async () => {
        // We need to use a regex for the POST body because the content is binary data and it's transmitted with a
        // random boundary string, etc., so we call nock programmatically instead of loading from a file.
        nock('https://test.okta.com/')
          .post('/api/v1/apps/app-fakeid1/logo', /logo-fake-binary-data/)
          .reply(201, { url: 'https://somepath.to/applogo-fakeid1' })

        const result = await operations.deploy({
          changeGroup: {
            groupID: 'appLogo',
            changes: [toChange({ after: appLogo })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(nock.pendingMocks()).toHaveLength(0)
      })

      it('should successfully modify an app logo', async () => {
        // We need to use a regex for the POST body because the content is binary data and it's transmitted with a
        // random boundary string, etc., so we call nock programmatically instead of loading from a file.
        nock('https://test.okta.com/')
          .post('/api/v1/apps/app-fakeid1/logo', /logo-fake-binary-data/)
          .reply(201, { url: 'https://somepath.to/applogo-fakeid1' })

        const updatedAppLogo = appLogo.clone()
        updatedAppLogo.value.content = new StaticFile({
          filepath: 'applogo.png',
          encoding: 'binary',
          content: Buffer.from('updated-logo-fake-binary-data'),
        })
        const result = await operations.deploy({
          changeGroup: {
            groupID: 'appLogo',
            changes: [toChange({ before: appLogo, after: updatedAppLogo })],
          },
          progressReporter: nullProgressReporter,
        })
        expect(result.errors).toHaveLength(0)
        expect(result.appliedChanges).toHaveLength(1)
        expect(nock.pendingMocks()).toHaveLength(0)
      })
    })
  })
})
