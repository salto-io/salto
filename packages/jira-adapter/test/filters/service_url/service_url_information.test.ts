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
import { ObjectType, ElemID, InstanceElement, CORE_ANNOTATIONS, toChange } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import { getFilterParams, mockClient } from '../../utils'
import JiraClient from '../../../src/client/client'
import { JIRA } from '../../../src/constants'
import filterCreator from '../../../src/filters/service_url/service_url_information'

describe('service url information filter', () => {
  let client: JiraClient
  let paginator: clientUtils.Paginator
  type FilterType = filterUtils.FilterWith<'onFetch' | 'onDeploy'>
  let filter: FilterType
  const testParent = { resValue: { value: { key: 'test', id: 'customfield_test' } } }

  beforeEach(async () => {
    jest.clearAllMocks()
    const mockCli = mockClient()
    client = mockCli.client
    paginator = mockCli.paginator
    filter = filterCreator(
      getFilterParams({
        client,
        paginator,
      }),
    ) as typeof filter
  })

  describe('onFetch', () => {
    describe('Board type', () => {
      it('should add service url annotation', async () => {
        const objType = new ObjectType({ elemID: new ElemID(JIRA, 'Board') })
        const elements = [new InstanceElement('Board', objType, { id: 11, name: 'wow board' })]
        await filter.onFetch(elements)
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual(['jira.Board.instance.Board'])
        const [instance] = elements
        expect(instance.annotations).toEqual({
          [CORE_ANNOTATIONS.SERVICE_URL]: 'https://ori-salto-test.atlassian.net/jira/software/c/projects/wow/boards/11',
        })
      })
    })
    describe('ProjectComponent type', () => {
      it('should add service url annotation', async () => {
        const objType = new ObjectType({ elemID: new ElemID(JIRA, 'ProjectComponent') })
        const elements = [
          new InstanceElement('ProjectComponent', objType, { name: 'test' }, undefined, { _parent: testParent }),
        ]
        await filter.onFetch(elements)
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'jira.ProjectComponent.instance.ProjectComponent',
        ])
        const [instance] = elements
        expect(instance.annotations).toEqual(
          expect.objectContaining({
            [CORE_ANNOTATIONS.SERVICE_URL]:
              'https://ori-salto-test.atlassian.net/plugins/servlet/project-config/test/administer-components?filter=test&orderDirection=DESC&orderField=NAME&page=1',
          }),
        )
      })
      it('should not add service url annotation without parent', async () => {
        const objType = new ObjectType({ elemID: new ElemID(JIRA, 'ProjectComponent') })
        const elements = [new InstanceElement('ProjectComponent', objType, { id: '11' })]
        await filter.onFetch(elements)
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'jira.ProjectComponent.instance.ProjectComponent',
        ])
        const [instance] = elements
        expect(instance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).not.toBeDefined()
      })
    })
    describe('CustomFieldContext type', () => {
      it('should add service url annotation for context of custom field', async () => {
        const objType = new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContext') })
        const elements = [
          new InstanceElement('CustomFieldContext', objType, { id: 11 }, undefined, { _parent: testParent }),
        ]
        await filter.onFetch(elements)
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'jira.CustomFieldContext.instance.CustomFieldContext',
        ])
        const [instance] = elements
        expect(instance.annotations).toEqual(
          expect.objectContaining({
            [CORE_ANNOTATIONS.SERVICE_URL]:
              'https://ori-salto-test.atlassian.net/secure/admin/ManageConfigurationScheme!default.jspa?=&customFieldId=test&fieldConfigSchemeId=11',
          }),
        )
      })
      it('should not add service url annotation for non custom field context', async () => {
        const nonCustomParent = { resValue: { value: { key: 'test', id: 'test' } } }
        const objType = new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContext') })
        const elements = [
          new InstanceElement('CustomFieldContext', objType, { id: '11' }, undefined, { _parent: nonCustomParent }),
        ]
        await filter.onFetch(elements)
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'jira.CustomFieldContext.instance.CustomFieldContext',
        ])
        const [instance] = elements
        expect(instance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).not.toBeDefined()
      })
    })
    describe('Field type', () => {
      it('should add service url annotation for custom field', async () => {
        const objType = new ObjectType({ elemID: new ElemID(JIRA, 'Field') })
        const elements = [new InstanceElement('Field', objType, { id: 'customfield_11' })]
        await filter.onFetch(elements)
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual(['jira.Field.instance.Field'])
        const [instance] = elements
        expect(instance.annotations).toEqual({
          [CORE_ANNOTATIONS.SERVICE_URL]:
            'https://ori-salto-test.atlassian.net/secure/admin/EditCustomField!default.jspa?id=11',
        })
      })
      it('should not add service url annotation for non custom field', async () => {
        const objType = new ObjectType({ elemID: new ElemID(JIRA, 'Field') })
        const elements = [new InstanceElement('Field', objType, { id: '11' })]
        await filter.onFetch(elements)
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual(['jira.Field.instance.Field'])
        const [instance] = elements
        expect(instance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).not.toBeDefined()
      })
    })
    describe('DashboardGadget type', () => {
      it('should add service url annotation', async () => {
        const objType = new ObjectType({ elemID: new ElemID(JIRA, 'DashboardGadget') })
        const elements = [
          new InstanceElement('DashboardGadget', objType, { id: 11 }, undefined, { _parent: testParent }),
        ]
        await filter.onFetch(elements)
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'jira.DashboardGadget.instance.DashboardGadget',
        ])
        const [instance] = elements
        expect(instance.annotations).toEqual(
          expect.objectContaining({
            [CORE_ANNOTATIONS.SERVICE_URL]:
              'https://ori-salto-test.atlassian.net/jira/dashboards/customfield_test?maximized=11',
          }),
        )
      })
    })
    describe('SecurityLevel type', () => {
      it('should add service url annotation', async () => {
        const objType = new ObjectType({ elemID: new ElemID(JIRA, 'SecurityLevel') })
        const elements = [new InstanceElement('SecurityLevel', objType, { id: 11 }, undefined, { _parent: testParent })]
        await filter.onFetch(elements)
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual(['jira.SecurityLevel.instance.SecurityLevel'])
        const [instance] = elements
        expect(instance.annotations).toEqual(
          expect.objectContaining({
            [CORE_ANNOTATIONS.SERVICE_URL]:
              'https://ori-salto-test.atlassian.net/secure/admin/EditSecurityLevel!default.jspa?levelId=11&schemeId=customfield_test',
          }),
        )
      })
    })
    describe('Webhook type', () => {
      it('should add service url annotation', async () => {
        const objType = new ObjectType({ elemID: new ElemID(JIRA, 'Webhook') })
        const elements = [new InstanceElement('Webhook', objType, { id: 11 })]
        await filter.onFetch(elements)
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual(['jira.Webhook.instance.Webhook'])
        const [instance] = elements
        expect(instance.annotations).toEqual({
          [CORE_ANNOTATIONS.SERVICE_URL]: 'https://ori-salto-test.atlassian.net/plugins/servlet/webhooks#',
        })
      })
    })
  })
  describe('onDeploy', () => {
    describe('Board type', () => {
      it('should add service url annotation', async () => {
        const objType = new ObjectType({ elemID: new ElemID(JIRA, 'Board') })
        const elements = [new InstanceElement('Board', objType, { id: 11, name: 'wow board' })]
        await filter.onDeploy(elements.map(inst => toChange({ after: inst })))
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual(['jira.Board.instance.Board'])
        const [instance] = elements
        expect(instance.annotations).toEqual({
          [CORE_ANNOTATIONS.SERVICE_URL]: 'https://ori-salto-test.atlassian.net/jira/software/c/projects/wow/boards/11',
        })
      })
    })
    describe('ProjectComponent type', () => {
      it('should add service url annotation', async () => {
        const objType = new ObjectType({ elemID: new ElemID(JIRA, 'ProjectComponent') })
        const elements = [
          new InstanceElement('ProjectComponent', objType, { name: 'test' }, undefined, { _parent: testParent }),
        ]
        await filter.onDeploy(elements.map(inst => toChange({ after: inst })))
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'jira.ProjectComponent.instance.ProjectComponent',
        ])
        const [instance] = elements
        expect(instance.annotations).toEqual(
          expect.objectContaining({
            [CORE_ANNOTATIONS.SERVICE_URL]:
              'https://ori-salto-test.atlassian.net/plugins/servlet/project-config/test/administer-components?filter=test&orderDirection=DESC&orderField=NAME&page=1',
          }),
        )
      })
      it('should not add service url annotation without parent', async () => {
        const objType = new ObjectType({ elemID: new ElemID(JIRA, 'ProjectComponent') })
        const elements = [new InstanceElement('ProjectComponent', objType, { id: '11' })]
        await filter.onDeploy(elements.map(inst => toChange({ after: inst })))
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'jira.ProjectComponent.instance.ProjectComponent',
        ])
        const [instance] = elements
        expect(instance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).not.toBeDefined()
      })
    })
    describe('CustomFieldContext type', () => {
      it('should add service url annotation for context of custom field', async () => {
        const objType = new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContext') })
        const elements = [
          new InstanceElement('CustomFieldContext', objType, { id: 11 }, undefined, { _parent: testParent }),
        ]
        await filter.onDeploy(elements.map(inst => toChange({ after: inst })))
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'jira.CustomFieldContext.instance.CustomFieldContext',
        ])
        const [instance] = elements
        expect(instance.annotations).toEqual(
          expect.objectContaining({
            [CORE_ANNOTATIONS.SERVICE_URL]:
              'https://ori-salto-test.atlassian.net/secure/admin/ManageConfigurationScheme!default.jspa?=&customFieldId=test&fieldConfigSchemeId=11',
          }),
        )
      })
      it('should not add service url annotation for non custom field context', async () => {
        const nonCustomParent = { resValue: { value: { key: 'test', id: 'test' } } }
        const objType = new ObjectType({ elemID: new ElemID(JIRA, 'CustomFieldContext') })
        const elements = [
          new InstanceElement('CustomFieldContext', objType, { id: '11' }, undefined, { _parent: nonCustomParent }),
        ]
        await filter.onDeploy(elements.map(inst => toChange({ after: inst })))
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'jira.CustomFieldContext.instance.CustomFieldContext',
        ])
        const [instance] = elements
        expect(instance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).not.toBeDefined()
      })
    })
    describe('Field type', () => {
      it('should add service url annotation for custom field', async () => {
        const objType = new ObjectType({ elemID: new ElemID(JIRA, 'Field') })
        const elements = [new InstanceElement('Field', objType, { id: 'customfield_11' })]
        await filter.onDeploy(elements.map(inst => toChange({ after: inst })))
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual(['jira.Field.instance.Field'])
        const [instance] = elements
        expect(instance.annotations).toEqual({
          [CORE_ANNOTATIONS.SERVICE_URL]:
            'https://ori-salto-test.atlassian.net/secure/admin/EditCustomField!default.jspa?id=11',
        })
      })
      it('should not add service url annotation for non custom field', async () => {
        const objType = new ObjectType({ elemID: new ElemID(JIRA, 'Field') })
        const elements = [new InstanceElement('Field', objType, { id: '11' })]
        await filter.onDeploy(elements.map(inst => toChange({ after: inst })))
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual(['jira.Field.instance.Field'])
        const [instance] = elements
        expect(instance.annotations[CORE_ANNOTATIONS.SERVICE_URL]).not.toBeDefined()
      })
    })
    describe('DashboardGadget type', () => {
      it('should add service url annotation', async () => {
        const objType = new ObjectType({ elemID: new ElemID(JIRA, 'DashboardGadget') })
        const elements = [
          new InstanceElement('DashboardGadget', objType, { id: 11 }, undefined, { _parent: testParent }),
        ]
        await filter.onDeploy(elements.map(inst => toChange({ after: inst })))
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
          'jira.DashboardGadget.instance.DashboardGadget',
        ])
        const [instance] = elements
        expect(instance.annotations).toEqual(
          expect.objectContaining({
            [CORE_ANNOTATIONS.SERVICE_URL]:
              'https://ori-salto-test.atlassian.net/jira/dashboards/customfield_test?maximized=11',
          }),
        )
      })
    })
    describe('SecurityLevel type', () => {
      it('should add service url annotation', async () => {
        const objType = new ObjectType({ elemID: new ElemID(JIRA, 'SecurityLevel') })
        const elements = [new InstanceElement('SecurityLevel', objType, { id: 11 }, undefined, { _parent: testParent })]
        await filter.onDeploy(elements.map(inst => toChange({ after: inst })))
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual(['jira.SecurityLevel.instance.SecurityLevel'])
        const [instance] = elements
        expect(instance.annotations).toEqual(
          expect.objectContaining({
            [CORE_ANNOTATIONS.SERVICE_URL]:
              'https://ori-salto-test.atlassian.net/secure/admin/EditSecurityLevel!default.jspa?levelId=11&schemeId=customfield_test',
          }),
        )
      })
    })
    describe('Webhook type', () => {
      it('should add service url annotation', async () => {
        const objType = new ObjectType({ elemID: new ElemID(JIRA, 'Webhook') })
        const elements = [new InstanceElement('Webhook', objType, { id: 11 })]
        await filter.onDeploy(elements.map(inst => toChange({ after: inst })))
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual(['jira.Webhook.instance.Webhook'])
        const [instance] = elements
        expect(instance.annotations).toEqual({
          [CORE_ANNOTATIONS.SERVICE_URL]: 'https://ori-salto-test.atlassian.net/plugins/servlet/webhooks#',
        })
      })
    })
  })
})
