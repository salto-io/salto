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
import { MockInterface } from '@salto-io/test-utils'
import {
  ElemID,
  InstanceElement,
  ObjectType,
  toChange,
  getChangeData,
  isInstanceElement,
  ModificationChange,
  isObjectType,
  CORE_ANNOTATIONS,
  ListType,
  BuiltinTypes,
} from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { getFilterParams, mockClient } from '../utils'
import OktaClient from '../../src/client/client'
import appDeploymentFilter, { isInactiveCustomAppChange } from '../../src/filters/app_deployment'
import { APPLICATION_TYPE_NAME, INACTIVE_STATUS, OKTA, ORG_SETTING_TYPE_NAME } from '../../src/constants'

describe('appDeploymentFilter', () => {
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let client: OktaClient
  type FilterType = filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'deploy' | 'onDeploy'>
  let filter: FilterType
  const appType = new ObjectType({
    elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME),
    fields: {
      features: { refType: new ListType(BuiltinTypes.STRING) },
    },
  })
  const orgSettingType = new ObjectType({ elemID: new ElemID(OKTA, ORG_SETTING_TYPE_NAME) })
  const orgSettingInstance = new InstanceElement(ElemID.CONFIG_NAME, orgSettingType, { subdomain: 'oktaSubdomain' })
  const appInstance = new InstanceElement('regular app', appType, { name: 'salesforce', signOnMode: 'SAML_2_0' })
  const customSamlAppInstance = new InstanceElement('custom saml app', appType, {
    name: 'oktaSubdomain_saml_link',
    signOnMode: 'SAML_2_0',
  })
  const customSwaInstance = new InstanceElement('custom swa app', appType, {
    name: 'oktaSubdomain_swa_link',
    signOnMode: 'AUTO_LOGIN',
  })
  const customSamlAfterFetch = new InstanceElement('custom saml app', appType, {
    customName: 'oktaSubdomain_saml_link',
    signOnMode: 'SAML_2_0',
  })
  const customSwaAfterFetch = new InstanceElement('custom swa app', appType, {
    customName: 'oktaSubdomain_swa_link',
    signOnMode: 'AUTO_LOGIN',
  })

  beforeEach(() => {
    jest.clearAllMocks()
    const { client: cli, connection } = mockClient()
    mockConnection = connection
    client = cli
    filter = appDeploymentFilter(
      getFilterParams({ client, elementsSource: buildElementsSourceFromElements([orgSettingInstance]) }),
    ) as typeof filter
  })

  describe('fetch', () => {
    it('should create customName field for custom applications', async () => {
      const elements = [appType, orgSettingType, orgSettingInstance, customSamlAppInstance, customSwaInstance]
      await filter.onFetch(elements)
      const saml = elements.filter(isInstanceElement).find(e => e.elemID.name === 'custom saml app')
      expect(saml?.value.name).toBeUndefined()
      expect(saml?.value.customName).toEqual('oktaSubdomain_saml_link')
      const swa = elements.filter(isInstanceElement).find(e => e.elemID.name === 'custom swa app')
      expect(swa?.value.name).toBeUndefined()
      expect(swa?.value.customName).toEqual('oktaSubdomain_swa_link')
    })
    it('should not create customName field for non custom applications and remain name field', async () => {
      const elements = [appType, orgSettingType, orgSettingInstance, appInstance]
      await filter.onFetch(elements)
      const app = elements.filter(isInstanceElement).find(e => e.elemID.name === 'regular app')
      expect(app?.value.name).toEqual('salesforce')
      expect(app?.value.customName).toBeUndefined()
    })
    it('should add deployment annotations for "features" field', async () => {
      const elements = [appType, orgSettingType, orgSettingInstance, customSamlAppInstance, customSwaInstance]
      await filter.onFetch(elements)
      const type = elements.filter(isObjectType).find(e => e.elemID.name === APPLICATION_TYPE_NAME)
      expect(type?.fields.features.annotations[CORE_ANNOTATIONS.CREATABLE]).toEqual(false)
      expect(type?.fields.features.annotations[CORE_ANNOTATIONS.UPDATABLE]).toEqual(false)
      expect(type?.fields.features.annotations[CORE_ANNOTATIONS.DELETABLE]).toEqual(false)
    })
  })

  describe('preDeploy', () => {
    it('should assign customName field to name field before deployment', async () => {
      const changes = [
        toChange({ before: customSamlAfterFetch, after: customSamlAfterFetch }),
        toChange({ before: customSwaAfterFetch, after: customSwaAfterFetch }),
      ]
      await filter.preDeploy(changes)
      const instances = changes.map(getChangeData).filter(isInstanceElement)
      const samlApp = instances.find(i => i.elemID.name === 'custom saml app')
      const swaApp = instances.find(i => i.elemID.name === 'custom swa app')
      expect(samlApp?.value.name).toEqual('oktaSubdomain_saml_link')
      expect(swaApp?.value.name).toEqual('oktaSubdomain_swa_link')
    })
    it('should do nothing if customName field does not exist', async () => {
      const customAppAddition = new InstanceElement('custom saml app', appType, { signOnMode: 'SAML_2_0' })
      const changes = [toChange({ before: appInstance, after: appInstance }), toChange({ after: customAppAddition })]
      await filter.preDeploy(changes)
      const instances = changes.map(getChangeData).filter(isInstanceElement)
      const app = instances.find(i => i.elemID.name === 'regular app')
      const customApp = instances.find(i => i.elemID.name === 'custom saml app')
      expect(app?.value).toEqual({ name: 'salesforce', signOnMode: 'SAML_2_0' })
      expect(customApp?.value).toEqual({ signOnMode: 'SAML_2_0' })
    })
  })

  describe('deploy', () => {
    it('should successfully deploy application', async () => {
      const appToDeploy = new InstanceElement('deploy app', appType, {
        id: 'appId',
        signOnMode: 'SAML_2_0',
        label: 'app name',
        status: 'ACTIVE',
        settings: {
          app: {
            companySubDomain: 'subdomain',
          },
        },
        profileEnrollment: 'profileEnrollment1',
        accessPolicy: 'accessPolicyId',
        _links: {
          val: 'val',
        },
      })
      const appToDeployAfter = appToDeploy.clone()
      _.set(appToDeployAfter, ['value', 'label'], 'new label')
      _.set(appToDeployAfter, ['value', 'profileEnrollment'], 'profileEnrollment2')
      mockConnection.put.mockResolvedValue({ status: 200, data: {} })
      mockConnection.delete.mockResolvedValue({ status: 200, data: {} })
      const res = await filter.deploy([toChange({ before: appToDeploy, after: appToDeployAfter })])
      expect(mockConnection.put).toHaveBeenCalledTimes(2)
      expect(mockConnection.put).toHaveBeenNthCalledWith(
        1,
        '/api/v1/apps/appId',
        {
          signOnMode: 'SAML_2_0',
          label: 'new label',
          status: 'ACTIVE',
          settings: {
            app: {
              companySubDomain: 'subdomain',
            },
          },
        },
        undefined,
      )
      expect(mockConnection.put).toHaveBeenNthCalledWith(
        2,
        '/api/v1/apps/appId/policies/profileEnrollment2',
        {},
        undefined,
      )
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      const createdApp = res.deployResult.appliedChanges
        .map(getChangeData)
        .filter(isInstanceElement)
        .find(i => i.elemID.name === 'deploy app')
      expect(createdApp?.value).toEqual({
        id: 'appId',
        signOnMode: 'SAML_2_0',
        label: 'new label',
        status: 'ACTIVE',
        settings: {
          app: {
            companySubDomain: 'subdomain',
          },
        },
        profileEnrollment: 'profileEnrollment2',
        accessPolicy: 'accessPolicyId',
        _links: {
          val: 'val',
        },
      })
    })
    it('should successfuly create application in status INACTIVE', async () => {
      const appToDeploy = new InstanceElement('deploy App', appType, {
        signOnMode: 'SAML_2_0',
        status: 'INACTIVE',
        label: 'app name',
      })
      mockConnection.post.mockResolvedValue({ status: 200, data: {} })
      await filter.deploy([toChange({ after: appToDeploy })])
      expect(mockConnection.post).toHaveBeenCalledWith(
        '/api/v1/apps',
        { signOnMode: 'SAML_2_0', status: 'INACTIVE', label: 'app name' },
        { params: { activate: 'false' } },
      )
    })
    it('should change application status for modification changes', async () => {
      const activeApp = new InstanceElement('deploy app', appType, {
        id: 'appId',
        signOnMode: 'SAML_2_0',
        label: 'app name',
        customName: 'app',
        status: 'ACTIVE',
        settings: {
          app: {
            companySubDomain: 'subdomain',
          },
        },
      })
      const inactiveApp = activeApp.clone()
      inactiveApp.value.status = 'INACTIVE'
      const changes = [
        toChange({ before: activeApp, after: inactiveApp }),
        toChange({ before: inactiveApp, after: activeApp }),
      ]
      mockConnection.post.mockResolvedValue({ status: 200, data: {} })
      const res = await filter.deploy(changes)
      expect(mockConnection.post).toHaveBeenNthCalledWith(1, '/api/v1/apps/appId/lifecycle/activate', {}, undefined)
      expect(mockConnection.post).toHaveBeenNthCalledWith(2, '/api/v1/apps/appId/lifecycle/deactivate', {}, undefined)
      expect(res.deployResult.appliedChanges).toHaveLength(2)
    })
    it('should assign customName field to custom app on addition change', async () => {
      mockConnection.post.mockResolvedValue({
        status: 200,
        data: {
          id: '1',
          name: 'oktaSubdomain_link',
          signOnMode: 'SAML_2_0',
        },
      })
      const changes = [toChange({ after: new InstanceElement('custom app', appType, { signOnMode: 'SAML_2_0' }) })]
      const res = await filter.deploy(changes)
      expect(mockConnection.post).toHaveBeenCalledWith('/api/v1/apps', { signOnMode: 'SAML_2_0' }, undefined)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      const customAppInstance = res.deployResult.appliedChanges
        .map(getChangeData)
        .filter(isInstanceElement)
        .find(i => i.elemID.name === 'custom app')
      expect(customAppInstance?.value.id).toEqual('1')
      expect(customAppInstance?.value.customName).toEqual('oktaSubdomain_link')
    })
    it('Should activate custom application to apply changes and deactivate afterwards', async () => {
      mockConnection.put.mockResolvedValue({
        status: 200,
        data: { id: '1a', name: 'test', status: 'ACTIVE' },
      })
      mockConnection.post.mockResolvedValue({
        status: 200,
        data: {},
      })
      const customApp = new InstanceElement('customApp', appType, {
        id: '1a',
        customName: 'test',
        name: 'test',
        settings: { notes: { admin: 'note' } },
        status: INACTIVE_STATUS,
      })
      const customAppAfter = customApp.clone()
      customAppAfter.value.settings.notes.enduser = 'another note'
      const changes = [toChange({ before: customApp, after: customAppAfter })]
      const res = await filter.deploy(changes)
      expect(mockConnection.put).toHaveBeenCalledWith(
        '/api/v1/apps/1a',
        { name: 'test', settings: { notes: { admin: 'note', enduser: 'another note' } }, status: INACTIVE_STATUS },
        undefined,
      )
      expect(mockConnection.post).toHaveBeenCalledTimes(2)
      expect(mockConnection.post).toHaveBeenNthCalledWith(1, '/api/v1/apps/1a/lifecycle/activate', {}, undefined)
      expect(mockConnection.post).toHaveBeenNthCalledWith(2, '/api/v1/apps/1a/lifecycle/deactivate', {}, undefined)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      const customAppInstance = res.deployResult.appliedChanges
        .map(getChangeData)
        .filter(isInstanceElement)
        .find(i => i.elemID.name === 'customApp')
      expect(customAppInstance?.value.status).toEqual('INACTIVE')
    })
    it('Should convert removed values in apps settings to null', async () => {
      const app = new InstanceElement('app', appType, {
        id: 'appId',
        signOnMode: 'SAML_2_0',
        settings: {
          app: {
            customDomain: 'subdomain',
            loginUrl: 'http://example.com',
          },
          notes: { admin: 'admin note', endUser: 'notes' },
          signOn: {
            url: 'a',
            attributeStatements: [{ type: 'a' }, { type: 'b' }],
          },
        },
        credentials: {
          scheme: 'SCHEME',
          revealPassword: true,
        },
      })
      const appAfter = app.clone()
      delete appAfter.value.settings.notes
      delete appAfter.value.settings.app.loginUrl
      delete appAfter.value.credentials.revealPassword
      delete appAfter.value.settings.signOn.attributeStatements
      await filter.deploy([toChange({ before: app, after: appAfter })])
      expect(mockConnection.put).toHaveBeenCalledWith(
        '/api/v1/apps/appId',
        {
          signOnMode: 'SAML_2_0',
          settings: {
            app: {
              customDomain: 'subdomain',
              loginUrl: null,
            },
            notes: { admin: null, endUser: null },
            signOn: { url: 'a', attributeStatements: null },
          },
          credentials: {
            scheme: 'SCHEME',
          },
        },
        undefined,
      )
    })
  })

  describe('onDeploy', () => {
    it('should delete name field in custom applications after deployment', async () => {
      const customSamlAfterDeploy = new InstanceElement('custom saml app', appType, {
        customName: 'oktaSubdomain_saml_link',
        name: 'oktaSubdomain_saml_link',
        signOnMode: 'SAML_2_0',
      })
      const customSwaAfterDeploy = new InstanceElement('custom swa app', appType, {
        customName: 'oktaSubdomain_swa_link',
        name: 'oktaSubdomain_swa_link',
        signOnMode: 'AUTO_LOGIN',
      })
      const changes = [
        toChange({ before: customSamlAfterDeploy, after: customSamlAfterDeploy }),
        toChange({ after: customSwaAfterDeploy }),
      ]
      await filter.onDeploy(changes)
      const instances = changes.map(getChangeData).filter(isInstanceElement)
      const customApp = instances.find(i => i.elemID.name === 'custom saml app')
      const customSwa = instances.find(i => i.elemID.name === 'custom swa app')
      expect(customSwa?.value).toEqual({ customName: 'oktaSubdomain_swa_link', signOnMode: 'AUTO_LOGIN' })
      expect(customApp?.value).toEqual({ customName: 'oktaSubdomain_saml_link', signOnMode: 'SAML_2_0' })
    })
  })

  describe('isInactiveCustomAppChange', () => {
    const customApp = new InstanceElement('custom', appType, { customName: 'a', id: 'aa', status: 'INACTIVE' })
    it('should return true for custom app change in status INACTIVE', () => {
      const change = toChange({ before: customApp, after: customApp }) as ModificationChange<InstanceElement>
      expect(isInactiveCustomAppChange(change)).toEqual(true)
    })

    it('should return false for regular app change in status INACTIVE', () => {
      const app = customApp.clone()
      delete app.value.customName
      const change = toChange({ before: app, after: app }) as ModificationChange<InstanceElement>
      expect(isInactiveCustomAppChange(change)).toEqual(false)
    })

    it('should return false for custom app change with change in status', () => {
      const activeApp = customApp.clone()
      activeApp.value.status = 'ACTIVE'
      const change = toChange({ before: customApp, after: activeApp }) as ModificationChange<InstanceElement>
      expect(isInactiveCustomAppChange(change)).toEqual(false)
    })
  })
})
