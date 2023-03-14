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

import { MockInterface } from '@salto-io/test-utils'
import { ElemID, InstanceElement, ObjectType, toChange, getChangeData, isInstanceElement } from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { getFilterParams, mockClient } from '../utils'
import OktaClient from '../../src/client/client'
import appDeploymentFilter from '../../src/filters/app_deployment'
import { APPLICATION_TYPE_NAME, OKTA, ORG_SETTING_TYPE_NAME } from '../../src/constants'


describe('appDeploymentFilter', () => {
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let client: OktaClient
  type FilterType = filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'deploy' | 'onDeploy'>
  let filter: FilterType
  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const orgSettingType = new ObjectType({ elemID: new ElemID(OKTA, ORG_SETTING_TYPE_NAME) })
  const orgSettingInstance = new InstanceElement(
    ElemID.CONFIG_NAME,
    orgSettingType,
    { subdomain: 'oktaSubdomain' },
  )
  const appInstance = new InstanceElement(
    'regular app',
    appType,
    { name: 'salesforce', signOnMode: 'SAML_2_0' },
  )
  const customSamlAppInstance = new InstanceElement(
    'custom saml app',
    appType,
    { name: 'oktaSubdomain-saml-link', signOnMode: 'SAML_2_0' },
  )
  const customSwaInstance = new InstanceElement(
    'custom swa app',
    appType,
    { name: 'oktaSubdomain-swa-link', signOnMode: 'AUTO_LOGIN' },
  )
  const customSamlAfterFetch = new InstanceElement(
    'custom saml app',
    appType,
    { customName: 'oktaSubdomain-saml-link', signOnMode: 'SAML_2_0' },
  )
  const customSwaAfterFetch = new InstanceElement(
    'custom swa app',
    appType,
    { customName: 'oktaSubdomain-swa-link', signOnMode: 'AUTO_LOGIN' },
  )

  beforeEach(() => {
    jest.clearAllMocks()
    const { client: cli, connection } = mockClient()
    mockConnection = connection
    client = cli
    filter = appDeploymentFilter(
      getFilterParams({ client, elementsSource: buildElementsSourceFromElements([orgSettingInstance]) })
    ) as typeof filter
  })

  describe('fetch', () => {
    it('should create customName field for custom applications', async () => {
      const elements = [appType, orgSettingType, orgSettingInstance, customSamlAppInstance, customSwaInstance]
      await filter.onFetch?.(elements)
      const saml = elements.filter(isInstanceElement).find(e => e.elemID.name === 'custom saml app')
      expect(saml?.value.name).toBeUndefined()
      expect(saml?.value.customName).toEqual('oktaSubdomain-saml-link')
      const swa = elements.filter(isInstanceElement).find(e => e.elemID.name === 'custom swa app')
      expect(swa?.value.name).toBeUndefined()
      expect(swa?.value.customName).toEqual('oktaSubdomain-swa-link')
    })
    it('should not create customName field for non custom applications and remain name field', async () => {
      const elements = [appType, orgSettingType, orgSettingInstance, appInstance]
      await filter.onFetch?.(elements)
      const app = elements.filter(isInstanceElement).find(e => e.elemID.name === 'regular app')
      expect(app?.value.name).toEqual('salesforce')
      expect(app?.value.customName).toBeUndefined()
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
      expect(samlApp?.value.name).toEqual('oktaSubdomain-saml-link')
      expect(swaApp?.value.name).toEqual('oktaSubdomain-swa-link')
    })
    it('should do nothing if customName field does not exist', async () => {
      const customAppAddition = new InstanceElement(
        'custom saml app',
        appType,
        { signOnMode: 'SAML_2_0' },
      )
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
    it('should assign customName field to custom app on addition change', async () => {
      mockConnection.post.mockResolvedValue({
        status: 200,
        data: {
          id: '1',
          name: 'oktaSubdomain-link',
          signOnMode: 'SAML_2_0',
        },
      })
      const changes = [toChange({ after: new InstanceElement('custom app', appType, { signOnMode: 'SAML_2_0' }) })]
      const res = await filter.deploy(changes)
      expect(mockConnection.post).toHaveBeenCalledWith(
        '/api/v1/apps',
        { signOnMode: 'SAML_2_0' },
        undefined,
      )
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      const customAppInstance = res.deployResult.appliedChanges
        .map(getChangeData).filter(isInstanceElement).find(i => i.elemID.name === 'custom app')
      expect(customAppInstance?.value.id).toEqual('1')
      expect(customAppInstance?.value.customName).toEqual('oktaSubdomain-link')
    })
  })

  describe('onDeploy', () => {
    it('should delete name field in custom applications after deployment', async () => {
      const customSamlAfterDeploy = new InstanceElement(
        'custom saml app',
        appType,
        { customName: 'oktaSubdomain-saml-link', name: 'oktaSubdomain-saml-link', signOnMode: 'SAML_2_0' },
      )
      const customSwaAfterDeploy = new InstanceElement(
        'custom swa app',
        appType,
        { customName: 'oktaSubdomain-swa-link', name: 'oktaSubdomain-swa-link', signOnMode: 'AUTO_LOGIN' },
      )
      const changes = [
        toChange({ before: customSamlAfterDeploy, after: customSamlAfterDeploy }),
        toChange({ after: customSwaAfterDeploy }),
      ]
      await filter.onDeploy(changes)
      const instances = changes.map(getChangeData).filter(isInstanceElement)
      const customApp = instances.find(i => i.elemID.name === 'custom saml app')
      const customSwa = instances.find(i => i.elemID.name === 'custom swa app')
      expect(customSwa?.value).toEqual({ customName: 'oktaSubdomain-swa-link', signOnMode: 'AUTO_LOGIN' })
      expect(customApp?.value).toEqual({ customName: 'oktaSubdomain-saml-link', signOnMode: 'SAML_2_0' })
    })
  })
})
