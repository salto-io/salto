/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { filterUtils } from '@salto-io/adapter-components'
import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  StaticFile,
  getChangeData,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { APPLICATION_TYPE_NAME, APP_LOGO_TYPE_NAME, LINKS_FIELD, OKTA } from '../../src/constants'
import OktaClient from '../../src/client/client'
import { createDefinitions, getFilterParams, mockClient } from '../utils'
import appLogoFilter from '../../src/filters/app_logo'
import { FilterResult } from '../../src/filter'

describe('app logo filter', () => {
  let mockGet: jest.SpyInstance
  let client: OktaClient
  type FilterType = filterUtils.FilterWith<'deploy' | 'onFetch', FilterResult>
  let filter: FilterType
  const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
  const appLogoType = new ObjectType({ elemID: new ElemID(OKTA, APP_LOGO_TYPE_NAME) })
  const fileName = 'app1_logo.png'
  const content = Buffer.from('test')
  const createAppInstance = (name: string): InstanceElement =>
    new InstanceElement(name, appType, {
      id: '11',
      label: name,
      [LINKS_FIELD]: {
        logo: [
          {
            name: 'file_Name',
            href: 'https://ok12static.oktacdn.com/fs/bco/4/111',
            type: 'image/png',
          },
        ],
      },
    })
  const appInstance = createAppInstance('app1')
  beforeEach(async () => {
    const mockCli = mockClient()
    client = mockCli.client
    const definitions = createDefinitions({ client })
    filter = appLogoFilter(getFilterParams({ definitions })) as typeof filter
  })
  describe('onFetch', () => {
    beforeEach(async () => {
      mockGet = jest.spyOn(client, 'getResource')
      mockGet.mockImplementation(params => {
        if (params.url === 'https://ok12static.oktacdn.com/fs/bco/4/111') {
          return {
            status: 200,
            data: content,
          }
        }
        throw new Error('Err')
      })
    })
    it('should create AppLogo type and AppLogo instance', async () => {
      const elements = [appType, appInstance].map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
        'okta.AppLogo',
        'okta.AppLogo.instance.app1',
        'okta.Application',
        'okta.Application.instance.app1',
      ])
    })
    it('check that AppLogo instance is created properly', async () => {
      const elements = [appType, appInstance].map(e => e.clone())
      await filter.onFetch(elements)
      const instances = elements.filter(isInstanceElement)
      const logo = instances.find(e => e.elemID.typeName === APP_LOGO_TYPE_NAME)
      expect(logo?.value).toEqual({
        id: '111',
        fileName: 'app1.png',
        contentType: 'png',
        content: new StaticFile({
          filepath: 'okta/AppLogo/app1.png',
          encoding: 'binary',
          content,
        }),
      })
    })
    it('should not create AppLogo instance if file type is forbidden and should create error', async () => {
      const clonedAppInstance = appInstance.clone()
      clonedAppInstance.value[LINKS_FIELD].logo[0].type = 'image/svg+xml'
      const elements = [appType, clonedAppInstance]
      const res = (await filter.onFetch(elements)) as FilterResult
      const instances = elements.filter(isInstanceElement)
      const logo = instances.find(e => e.elemID.typeName === APP_LOGO_TYPE_NAME)
      expect(logo).toBeUndefined()
      expect(res.errors).toHaveLength(1)
      expect(res.errors?.[0].message).toEqual('Failed to fetch App logo. Failed to find content type for app1')
    })
    // Reproduce an issue where the filter does not give unique file names to AppLogo instances if their names only
    // differed by underscores.
    it('should give AppLogo instances unique file names', async () => {
      // Same name, but with underscore.
      const anotherAppInstance = createAppInstance('app_1')
      const elements = [appType, appInstance, anotherAppInstance].map(e => e.clone())
      await filter.onFetch(elements)
      const instances = elements.filter(isInstanceElement)
      const fileNames = instances.filter(e => e.elemID.typeName === APP_LOGO_TYPE_NAME).map(e => e.value.fileName)
      expect(fileNames).toEqual(['app1.png', 'app_1.png'])
    })
  })
  describe('deploy', () => {
    let logoInstance: InstanceElement
    beforeEach(async () => {
      logoInstance = new InstanceElement('app1', appLogoType, {
        id: '11',
        fileName,
        contentType: 'image/png',
        content: new StaticFile({
          filepath: 'okta/AppLogo/app1.png',
          encoding: 'binary',
          content,
        }),
      })
      logoInstance.annotate({
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(appInstance.elemID, appInstance)],
      })
    })
    it('should add logo instance to the elements', async () => {
      const clonedApp = appInstance.clone()
      const clonedLogo = logoInstance.clone()
      const res = await filter.deploy([
        { action: 'add', data: { after: clonedApp } },
        { action: 'add', data: { after: clonedLogo } },
      ])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect((getChangeData(res.leftoverChanges[0]) as InstanceElement).value).toEqual(clonedApp.value)

      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges[0]).toEqual({ action: 'add', data: { after: clonedLogo } })
    })
    it('should modify logo instances', async () => {
      const beforeLogo = logoInstance.clone()
      const afterLogo = logoInstance.clone()
      afterLogo.value.content = new StaticFile({
        filepath: 'okta/AppLogo/changed.png',
        encoding: 'binary',
        content: Buffer.from('changes!'),
      })
      const res = await filter.deploy([{ action: 'modify', data: { before: beforeLogo, after: afterLogo } }])
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.leftoverChanges).toHaveLength(0)

      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges[0]).toEqual({
        action: 'modify',
        data: { before: beforeLogo, after: afterLogo },
      })
    })
    it('should return errors', async () => {
      const clonedLogo = logoInstance.clone()
      clonedLogo.annotations[CORE_ANNOTATIONS.PARENT] = []
      const res = await filter.deploy([{ action: 'add', data: { after: clonedLogo } }])
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
  })
})
