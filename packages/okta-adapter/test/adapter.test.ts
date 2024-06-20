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
} from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { adapter } from '../src/adapter_creator'
import { accessTokenCredentialsType } from '../src/auth'
import { DEFAULT_CONFIG } from '../src/user_config'
import fetchMockReplies from './fetch_mock_replies.json'
import deployMockReplies from './deploy_mock_replies.json'
import { GROUP_TYPE_NAME, OKTA } from '../src/constants'

const nullProgressReporter: ProgressReporter = {
  reportProgress: () => null,
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
  jest.setTimeout(10 * 5000)
  let mockAxiosAdapter: MockAdapter

  beforeEach(async () => {
    mockAxiosAdapter = new MockAdapter(axios, { delayResponse: 1, onNoMatch: 'throwException' })
    mockAxiosAdapter
      .onGet('/api/v1/org')
      .replyOnce(200, { id: 'accountId' })
      .onGet('/api/v1/org')
      .replyOnce(200, { id: 'accountId' })
    ;([...fetchMockReplies, ...deployMockReplies] as MockReply[]).forEach(({ url, method, params, response }) => {
      const mock = getMockFunction(method, mockAxiosAdapter).bind(mockAxiosAdapter)
      const handler = mock(url, !_.isEmpty(params) ? { params } : undefined)
      handler.replyOnce(200, response)
    })
  })

  afterEach(() => {
    mockAxiosAdapter.restore()
    jest.clearAllMocks()
  })

  describe('fetch', () => {
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
    let groupType: ObjectType
    let group1: InstanceElement

    beforeEach(() => {
      groupType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_TYPE_NAME) })
      group1 = new InstanceElement('group1', groupType, {
        id: 'fakeid123',
        objectClass: ['okta:user_group'],
        type: 'OKTA_GROUP',
        profile: {
          name: 'Engineers',
          description: 'all the engineers',
        },
      })

      operations = adapter.operations({
        credentials: new InstanceElement('config', accessTokenCredentialsType, {
          baseUrl: 'https://test.okta.com',
          token: 't',
        }),
        config: new InstanceElement('config', adapter.configType as ObjectType, DEFAULT_CONFIG),
        elementsSource: buildElementsSourceFromElements([]),
      })
    })

    it('should successfully add a group', async () => {
      const result = await operations.deploy({
        changeGroup: {
          groupID: 'group',
          changes: [toChange({ after: group1 })],
        },
        progressReporter: nullProgressReporter,
      })
      expect(result.errors).toHaveLength(0)
      expect(result.appliedChanges).toHaveLength(1)
      expect(getChangeData(result.appliedChanges[0] as Change<InstanceElement>).value.id).toEqual('fakeid123')
    })

    it('should successfully modify a group', async () => {
      const updatedGroup1 = group1.clone()
      updatedGroup1.value.name = 'Programmers'
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
    })

    it('should successfully remove a group', async () => {
      const result = await operations.deploy({
        changeGroup: {
          groupID: 'group',
          changes: [toChange({ before: group1 })],
        },
        progressReporter: nullProgressReporter,
      })
      expect(result.errors).toHaveLength(0)
      expect(result.appliedChanges).toHaveLength(1)
    })
  })
})
