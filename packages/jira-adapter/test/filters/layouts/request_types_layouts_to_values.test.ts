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
import { filterUtils, elements as adapterElements } from '@salto-io/adapter-components'
import {
  InstanceElement,
  ReferenceExpression,
  Element,
  ObjectType,
  ElemID,
  CORE_ANNOTATIONS,
  Value,
  toChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { getDefaultConfig } from '../../../src/config/config'
import requestTypelayoutsToValuesFilter from '../../../src/filters/layouts/request_types_layouts_to_values'
import { createEmptyType, getFilterParams } from '../../utils'
import { ISSUE_VIEW_TYPE, JIRA, PROJECT_TYPE, REQUEST_FORM_TYPE, REQUEST_TYPE_NAME } from '../../../src/constants'

describe('requestTypelayoutsToValuesFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filter: FilterType
  let elements: Element[]
  let projectInstance: InstanceElement
  let requestTypeInstance: InstanceElement
  let fieldInstance1: InstanceElement
  let fieldInstance2: InstanceElement
  let requestFormInstance: InstanceElement
  let issueViewInstance: InstanceElement
  let requestFormValue: Value

  describe('on fetch', () => {
    let requestTypeType: ObjectType
    beforeEach(async () => {
      projectInstance = new InstanceElement(
        'project1',
        createEmptyType(PROJECT_TYPE),
        {
          id: 11111,
          name: 'project1',
          simplified: false,
          projectTypeKey: 'service_desk',
        },
        [JIRA, adapterElements.RECORDS_PATH, PROJECT_TYPE, 'project1'],
      )
      requestTypeType = new ObjectType({
        elemID: new ElemID(JIRA, REQUEST_TYPE_NAME),
        fields: {
          requestForm: { refType: createEmptyType(REQUEST_FORM_TYPE) },
          issueView: { refType: createEmptyType(ISSUE_VIEW_TYPE) },
        },
      })
      requestTypeInstance = new InstanceElement(
        'issueType1',
        requestTypeType,
        {
          id: '100',
          name: 'requestTypeTest',
          projectKey: new ReferenceExpression(projectInstance.elemID, projectInstance),
          icon: {
            id: '10000000',
          },
        },
        [JIRA, adapterElements.RECORDS_PATH, REQUEST_TYPE_NAME, 'requestTypeTest'],
      )
      fieldInstance1 = new InstanceElement('testField1', createEmptyType('Field'), {
        id: 'testField1',
        name: 'TestField1',
        type: 'testField1',
      })
      fieldInstance2 = new InstanceElement('testField2', createEmptyType('Field'), {
        id: 'testField2',
        name: 'TestField2',
        schema: {
          system: 'testField2',
        },
      })
      const requestFormType = createEmptyType(REQUEST_FORM_TYPE)
      requestFormInstance = new InstanceElement('requestForm1', requestFormType, {
        id: '1',
        extraDefinerId: new ReferenceExpression(requestTypeInstance.elemID, requestTypeInstance),
        requestType: new ReferenceExpression(requestTypeInstance.elemID, requestTypeInstance),
        issueLayoutConfig: {
          items: [
            {
              type: 'FIELD',
              sectionType: 'PRIMARY',
              key: new ReferenceExpression(fieldInstance1.elemID, fieldInstance1),
              data: {
                properties: {
                  'jsd.field.displayName': 'Quack',
                  'jsd.field.helpText': 'Quack Quack',
                },
              },
            },
            {
              type: 'FIELD',
              sectionType: 'SECONDARY',
              key: new ReferenceExpression(fieldInstance2.elemID, fieldInstance2),
            },
          ],
        },
      })
      const issueViewType = createEmptyType(ISSUE_VIEW_TYPE)
      issueViewInstance = new InstanceElement('issueView1', issueViewType, {
        id: '2',
        extraDefinerId: new ReferenceExpression(requestTypeInstance.elemID, requestTypeInstance),
        requestType: new ReferenceExpression(requestTypeInstance.elemID, requestTypeInstance),
        issueLayoutConfig: {
          items: [
            {
              type: 'FIELD',
              sectionType: 'PRIMARY',
              key: new ReferenceExpression(fieldInstance1.elemID, fieldInstance1),
            },
            {
              type: 'FIELD',
              sectionType: 'SECONDARY',
              key: new ReferenceExpression(fieldInstance2.elemID, fieldInstance2),
            },
          ],
        },
      })

      elements = [
        projectInstance,
        requestTypeInstance,
        fieldInstance1,
        fieldInstance2,
        requestFormInstance,
        issueViewInstance,
        requestFormType,
        requestTypeType,
        issueViewType,
      ]
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      filter = requestTypelayoutsToValuesFilter(getFilterParams({ config })) as typeof filter
    })
    it('should add request form as requestType field and remove requestFormInstance ', async () => {
      await filter.onFetch(elements)
      const requestType = elements.find(e => e.elemID.isEqual(requestTypeInstance.elemID)) as InstanceElement
      const requestForm = elements.find(e => e.elemID.isEqual(requestFormInstance.elemID)) as InstanceElement
      const issueView = elements.find(e => e.elemID.isEqual(issueViewInstance.elemID)) as InstanceElement
      expect(requestType.value.requestForm).toBeDefined()
      expect(requestType.value.issueView).toBeDefined()
      expect(requestForm).toBeUndefined()
      expect(issueView).toBeUndefined()
      expect(requestType.value.requestForm.issueLayoutConfig).toEqual(requestFormInstance.value.issueLayoutConfig)
      expect(requestType.value.issueView.issueLayoutConfig).toEqual(issueViewInstance.value.issueLayoutConfig)
    })
    it('should do nothing if requestType is not of type RequestType', async () => {
      requestFormInstance.value.extraDefinerId = new ReferenceExpression(projectInstance.elemID, projectInstance)
      await filter.onFetch(elements)
      const requestType = elements.find(e => e.elemID.isEqual(requestTypeInstance.elemID)) as InstanceElement
      expect(requestType.value.requestForm).toBeUndefined()
    })
    it('should add deploy annotation to requestForm and issueView', async () => {
      await filter.onFetch(elements)
      expect(requestTypeType.fields.requestForm.annotations).toEqual({
        [CORE_ANNOTATIONS.UPDATABLE]: true,
        [CORE_ANNOTATIONS.CREATABLE]: true,
      })
      expect(requestTypeType.fields.issueView.annotations).toEqual({
        [CORE_ANNOTATIONS.UPDATABLE]: true,
        [CORE_ANNOTATIONS.CREATABLE]: true,
      })
    })
    describe('requestForm properties', () => {
      it('should convert requestForm properties to a list', async () => {
        await filter.onFetch(elements)
        const requestType = elements.find(e => e.elemID.isEqual(requestTypeInstance.elemID)) as InstanceElement
        expect(requestType.value.requestForm.issueLayoutConfig.items[0].data.properties).toEqual([
          {
            key: 'jsd.field.displayName',
            value: 'Quack',
          },
          {
            key: 'jsd.field.helpText',
            value: 'Quack Quack',
          },
        ])
      })
      it('should do nothing when requestForm data or properties are undefined', async () => {
        requestFormInstance.value.issueLayoutConfig.items[0].data.properties = undefined
        await filter.onFetch(elements)
        const requestType = elements.find(e => e.elemID.isEqual(requestTypeInstance.elemID)) as InstanceElement
        expect(requestType.value.requestForm.issueLayoutConfig.items[1].data).toBeUndefined()
        expect(requestType.value.requestForm.issueLayoutConfig.items[0].data.properties).toBeUndefined()
      })
      it('should do nothing when issueLayoutConfig is undefined', async () => {
        requestFormInstance.value.issueLayoutConfig = undefined
        await filter.onFetch(elements)
        const requestType = elements.find(e => e.elemID.isEqual(requestTypeInstance.elemID)) as InstanceElement
        expect(requestType.value.requestForm.issueLayoutConfig).toBeUndefined()
      })
    })
  })

  describe('preDeploy', () => {
    beforeEach(async () => {
      requestFormValue = {
        issueLayoutConfig: {
          items: [
            {
              type: 'FIELD',
              data: {
                properties: [
                  {
                    key: 'jsd.field.displayName',
                    value: 'Quack',
                  },
                  {
                    key: 'jsd.field.helpText',
                    value: 'Quack Quack',
                  },
                ],
              },
            },
            {
              type: 'FIELD',
            },
          ],
        },
      }
      requestTypeInstance = new InstanceElement(
        'requestType',
        createEmptyType(REQUEST_TYPE_NAME),
        {
          requestForm: requestFormValue,
        },
        [JIRA, adapterElements.RECORDS_PATH, REQUEST_TYPE_NAME, 'requestTypeTest'],
      )
    })
    it('should convert requestForm properties to a map', async () => {
      await filter.preDeploy([toChange({ after: requestTypeInstance })])
      expect(requestTypeInstance.value.requestForm.issueLayoutConfig.items[0].data.properties).toEqual({
        'jsd.field.displayName': 'Quack',
        'jsd.field.helpText': 'Quack Quack',
      })
    })
    it('should do nothing when requestForm data or properties are undefined', async () => {
      requestFormValue.issueLayoutConfig.items[0].data.properties = undefined
      await filter.preDeploy([toChange({ after: requestTypeInstance })])
      expect(requestTypeInstance.value.requestForm.issueLayoutConfig.items[0].data.properties).toBeUndefined()
      expect(requestTypeInstance.value.requestForm.issueLayoutConfig.items[1].data).toBeUndefined()
    })
    it('should do nothing when issueLayoutConfig is undefined', async () => {
      requestFormValue.issueLayoutConfig = undefined
      await filter.preDeploy([toChange({ after: requestTypeInstance })])
      expect(requestTypeInstance.value.requestForm.issueLayoutConfig).toBeUndefined()
    })
  })
  describe('onDeploy', () => {
    beforeEach(async () => {
      requestFormValue = {
        issueLayoutConfig: {
          items: [
            {
              type: 'FIELD',
              data: {
                properties: {
                  'jsd.field.displayName': 'Quack',
                  'jsd.field.helpText': 'Quack Quack',
                },
              },
            },
            {
              type: 'FIELD',
            },
          ],
        },
      }
      requestTypeInstance = new InstanceElement(
        'requestType',
        createEmptyType(REQUEST_TYPE_NAME),
        {
          requestForm: requestFormValue,
        },
        [JIRA, adapterElements.RECORDS_PATH, REQUEST_TYPE_NAME, 'requestTypeTest'],
      )
    })
    it('should convert requestForm properties to a list', async () => {
      await filter.onDeploy([toChange({ after: requestTypeInstance })])
      expect(requestTypeInstance.value.requestForm.issueLayoutConfig.items[0].data.properties).toEqual([
        {
          key: 'jsd.field.displayName',
          value: 'Quack',
        },
        {
          key: 'jsd.field.helpText',
          value: 'Quack Quack',
        },
      ])
    })
    it('should do nothing when requestForm data or properties are undefined', async () => {
      requestFormValue.issueLayoutConfig.items[0].data.properties = undefined
      await filter.onDeploy([toChange({ after: requestTypeInstance })])
      expect(requestTypeInstance.value.requestForm.issueLayoutConfig.items[0].data.properties).toBeUndefined()
      expect(requestTypeInstance.value.requestForm.issueLayoutConfig.items[1].data).toBeUndefined()
    })
    it('should do nothing when issueLayoutConfig is undefined', async () => {
      requestFormValue.issueLayoutConfig = undefined
      await filter.onDeploy([toChange({ after: requestTypeInstance })])
      expect(requestTypeInstance.value.requestForm.issueLayoutConfig).toBeUndefined()
    })
  })
})
