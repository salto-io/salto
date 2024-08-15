/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import {
  ElemID,
  InstanceElement,
  ObjectType,
  isInstanceElement,
  isObjectType,
  CORE_ANNOTATIONS,
  ListType,
  BuiltinTypes,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { createDefinitions, getFilterParams, mockClient } from '../utils'
import OktaClient from '../../src/client/client'
import appDeploymentFilter from '../../src/filters/app_fetch'
import { APPLICATION_TYPE_NAME, OKTA, ORG_SETTING_TYPE_NAME } from '../../src/constants'

describe('appFetchFilter', () => {
  let client: OktaClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  const appType = new ObjectType({
    elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME),
    fields: {
      id: { refType: BuiltinTypes.SERVICE_ID },
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

  beforeEach(() => {
    jest.clearAllMocks()
    const { client: cli } = mockClient()
    client = cli
    const definitions = createDefinitions({ client })
    filter = appDeploymentFilter(
      getFilterParams({ definitions, elementSource: buildElementsSourceFromElements([orgSettingInstance]) }),
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
    it('should remove "features" field if it is empty', async () => {
      const emptyFeaturesApp = new InstanceElement('empty features app', appType, { features: [] })
      const elements = [appType, orgSettingType, orgSettingInstance, emptyFeaturesApp]
      await filter.onFetch(elements)
      const app = elements.filter(isInstanceElement).find(e => e.elemID.name === 'empty features app')
      expect(app?.value.features).toBeUndefined()
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
})
