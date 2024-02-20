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
import {
  ObjectType,
  ElemID,
  InstanceElement,
  isObjectType,
  isInstanceElement,
  ReferenceExpression,
  CORE_ANNOTATIONS,
  toChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { createTemplateExpression } from '@salto-io/adapter-utils'
import { elementSource } from '@salto-io/workspace'
import { ZENDESK, CUSTOM_FIELD_OPTIONS_FIELD_NAME } from '../../../src/constants'
import filterCreator from '../../../src/filters/custom_field_options/ticket_field'
import { DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME } from '../../../src/filters/custom_field_options/creator'
import { createFilterCreatorParams } from '../../utils'

const mockDeployChange = jest.fn()
jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn((...args) => mockDeployChange(...args)),
    },
  }
})

describe('ticket field filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'deploy' | 'preDeploy' | 'onDeploy'>
  let filter: FilterType
  const parentTypeName = 'ticket_field'
  const childTypeName = 'ticket_field__custom_field_options'
  const parentObjType = new ObjectType({ elemID: new ElemID(ZENDESK, parentTypeName) })
  const childObjType = new ObjectType({ elemID: new ElemID(ZENDESK, childTypeName) })
  const parent = new InstanceElement('parent', parentObjType, {
    id: 11,
    name: 'parent',
    [CUSTOM_FIELD_OPTIONS_FIELD_NAME]: [
      new ReferenceExpression(new ElemID(ZENDESK, childTypeName, 'instance', 'child1')),
      new ReferenceExpression(new ElemID(ZENDESK, childTypeName, 'instance', 'child2')),
    ],
  })
  const child1 = new InstanceElement(
    'child1',
    childObjType,
    { id: 22, name: 'child1', value: 'v1', default: false, raw_name: 'aaa' },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)] },
  )
  const child2 = new InstanceElement(
    'child2',
    childObjType,
    {
      id: 33,
      name: 'child2',
      value: 'v2',
      default: true,
      raw_name: createTemplateExpression({ parts: ['aaa ', new ReferenceExpression(parent.elemID, parent)] }),
    },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)] },
  )

  beforeEach(async () => {
    jest.clearAllMocks()
    filter = filterCreator(
      createFilterCreatorParams({
        elementsSource: elementSource.createInMemoryElementSource([parent.clone()]),
      }),
    ) as FilterType
  })

  describe('onFetch', () => {
    it('should add the default option field and remove default from children', async () => {
      const elements = [parentObjType, childObjType, parent, child1, child2].map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements).toHaveLength(5)
      expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual([
        'zendesk.ticket_field',
        'zendesk.ticket_field.instance.parent',
        'zendesk.ticket_field__custom_field_options',
        'zendesk.ticket_field__custom_field_options.instance.child1',
        'zendesk.ticket_field__custom_field_options.instance.child2',
      ])
      const ticketFieldType = elements.filter(isObjectType).find(e => e.elemID.typeName === parentTypeName)
      expect(ticketFieldType).toBeDefined()
      expect(ticketFieldType?.fields?.[DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME]).toBeDefined()
      const ticketFieldInstances = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === parentTypeName)
      expect(ticketFieldInstances).toHaveLength(1)
      const clonedTicketField = parent.clone()
      const child2AfterFilter = elements.find(e => e.elemID.isEqual(child2.elemID)) as InstanceElement
      expect(child2AfterFilter).toBeDefined()
      clonedTicketField.value[DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME] = new ReferenceExpression(
        child2AfterFilter.elemID,
        child2AfterFilter,
      )
      expect(ticketFieldInstances[0]).toEqual(clonedTicketField)
      const ticketFieldOptionType = elements.filter(isObjectType).find(e => e.elemID.typeName === childTypeName)
      expect(ticketFieldOptionType).toBeDefined()
      const ticketFieldOptionInstances = elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === childTypeName)
      expect(ticketFieldOptionInstances).toHaveLength(2)
      ticketFieldOptionInstances.forEach(option => {
        expect(option.value.default).not.toBeDefined()
      })
    })
    it('should not add default option field if there is no default', async () => {
      const elements = [parentObjType, childObjType, parent, child1].map(e => e.clone())
      await filter.onFetch(elements)
      const ticketFieldInstances = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === parentTypeName)
      expect(ticketFieldInstances).toHaveLength(1)
      expect(ticketFieldInstances[0].value[DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME]).not.toBeDefined()
      const ticketFieldOptionInstances = elements
        .filter(isInstanceElement)
        .filter(e => e.elemID.typeName === childTypeName)
      expect(ticketFieldOptionInstances).toHaveLength(1)
      expect(ticketFieldOptionInstances[0].value.default).not.toBeDefined()
    })
    it('should not do anything if there is no parent type', async () => {
      const elements = [childObjType, parent, child1, child2].map(e => e.clone())
      await filter.onFetch(elements)
      const ticketFieldInstances = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === parentTypeName)
      expect(ticketFieldInstances).toHaveLength(1)
      expect(ticketFieldInstances[0].value[DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME]).not.toBeDefined()
    })
  })
  describe('preDeploy', () => {
    const resolvedParent = new InstanceElement('parent', parentObjType, {
      id: 11,
      name: 'parent',
      [CUSTOM_FIELD_OPTIONS_FIELD_NAME]: [{ id: 22, value: 'v1', raw_name: 'aaa' }],
      [DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME]: 'v2',
    })
    const clonedResolvedParent = resolvedParent.clone()
    beforeEach(async () => {
      const change = toChange({ after: clonedResolvedParent })
      await filter?.preDeploy([change])
    })

    it('should add default to the options', async () => {
      expect(clonedResolvedParent.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME]).toEqual([
        { id: 22, name: 'aaa', value: 'v1', default: false, raw_name: 'aaa' },
      ])
    })
    it('should add default as false to all the options if there is no default', async () => {
      const clonedParentWithNoDefault = resolvedParent.clone()
      delete clonedParentWithNoDefault.value[DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME]
      await filter?.preDeploy([toChange({ after: clonedParentWithNoDefault })])
      expect(clonedParentWithNoDefault.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME]).toEqual([
        { id: 22, name: 'aaa', value: 'v1', default: false, raw_name: 'aaa' },
      ])
    })
  })
  describe('onDeploy', () => {
    const resolvedParent = new InstanceElement('parent', parentObjType, {
      id: 11,
      name: 'parent',
      [CUSTOM_FIELD_OPTIONS_FIELD_NAME]: [
        { id: 22, name: 'child1', value: 'v1', default: false, raw_name: 'aaa' },
        { id: 33, name: 'child2', value: 'v2', default: true, raw_name: 'aaa ticket.ticket_field_11' },
      ],
      [DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME]: 'v2',
    })
    const clonedResolvedParent = resolvedParent.clone()
    beforeEach(async () => {
      const change = toChange({ after: clonedResolvedParent })
      await filter?.onDeploy([change])
    })

    it('should replace objects with value field, so that restore will always convert the value back to a reference', async () => {
      expect(clonedResolvedParent.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME].map(isReferenceExpression)).toEqual([
        true,
        true,
      ])
      expect(
        clonedResolvedParent.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME].map((ref: ReferenceExpression) =>
          ref.elemID.getFullName(),
        ),
      ).toEqual([
        'zendesk.ticket_field__custom_field_options.instance.child1',
        'zendesk.ticket_field__custom_field_options.instance.child2',
      ])
    })
    it('should do nothing if there is no options field', async () => {
      const clonedParentWithNoDefault = resolvedParent.clone()
      delete clonedParentWithNoDefault.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME]
      const expectedInstance = clonedParentWithNoDefault.clone()
      await filter?.onDeploy([toChange({ after: clonedParentWithNoDefault })])
      expect(clonedParentWithNoDefault).toEqual(expectedInstance)
    })
    it('should remove name field from custom field options', async () => {
      const child = new InstanceElement('child1', childObjType, { name: 'name', raw_name: 'raw_name', value: 'v1' })
      await filter.onDeploy([toChange({ after: child })])
      expect(child.value).toEqual({ raw_name: 'raw_name', value: 'v1' })
    })
  })
  describe('deploy', () => {
    const option1 = new InstanceElement('option1', childObjType, { raw_name: 'option11', value: 'v3', default: false })
    const option2 = new InstanceElement('option2', childObjType, { raw_name: 'option22', value: 'v4', default: true })
    const ticketField = new InstanceElement('ticketField', parentObjType, {
      name: 'parent',
      [CUSTOM_FIELD_OPTIONS_FIELD_NAME]: [option1.value, option2.value],
    })
    describe('changes in both parent and child', () => {
      it('should pass the correct params to deployChange when we add both parent and children', async () => {
        const clonedElements = [ticketField, option1, option2].map(e => e.clone())
        mockDeployChange.mockImplementation(async () => ({
          ticket_field: {
            id: 1,
            custom_field_options: [
              { id: 2, value: 'v3' },
              { id: 3, value: 'v4' },
            ],
          },
        }))
        const res = await filter.deploy(clonedElements.map(e => ({ action: 'add', data: { after: e } })))
        expect(mockDeployChange).toHaveBeenCalledTimes(1)
        expect(mockDeployChange).toHaveBeenCalledWith({
          change: { action: 'add', data: { after: clonedElements[0] } },
          client: expect.anything(),
          endpointDetails: expect.anything(),
          fieldsToIgnore: [DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME],
        })
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        const expectedElements = [ticketField, option1, option2].map(e => e.clone())
        expectedElements[0].value.id = 1
        expectedElements[1].value.id = 2
        expectedElements[2].value.id = 3
        expect(res.deployResult.appliedChanges).toHaveLength(3)
        expect(res.deployResult.appliedChanges).toEqual(
          expectedElements.map(e => ({ action: 'add', data: { after: e } })),
        )
      })
      it('should pass the correct params to deployChange when we modify both parent and children', async () => {
        const clonedElements = [ticketField, option1, option2]
          .map(e => e.clone())
          .map((inst, index) => {
            inst.value.id = index
            return inst
          })
        const clonedElementsAfter = clonedElements
          .map(e => e.clone())
          .map(inst => {
            inst.value.name = `${inst.value.name} - edited`
            return inst
          })
        mockDeployChange.mockImplementation(async () => ({
          ticket_field: {
            id: 111,
            custom_field_options: [
              { id: 222, value: 'v3' },
              { id: 333, value: 'v4' },
            ],
          },
        }))
        const res = await filter.deploy(
          clonedElements.map((e, index) => ({
            action: 'modify',
            data: { before: e, after: clonedElementsAfter[index] },
          })),
        )
        expect(mockDeployChange).toHaveBeenCalledTimes(1)
        expect(mockDeployChange).toHaveBeenCalledWith({
          change: { action: 'modify', data: { before: clonedElements[0], after: clonedElementsAfter[0] } },
          client: expect.anything(),
          endpointDetails: expect.anything(),
          fieldsToIgnore: [DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME],
        })
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        expect(res.deployResult.appliedChanges).toHaveLength(3)
        expect(res.deployResult.appliedChanges).toEqual(
          clonedElements.map((e, index) => ({
            action: 'modify',
            data: { before: e, after: clonedElementsAfter[index] },
          })),
        )
      })
      it('should pass the correct params to deployChange when we remove both parent and children', async () => {
        const clonedElements = [ticketField, option1, option2]
          .map(e => e.clone())
          .map((inst, index) => {
            inst.value.id = index
            return inst
          })
        mockDeployChange.mockImplementation(async () => ({}))
        const res = await filter.deploy(clonedElements.map(e => ({ action: 'remove', data: { before: e } })))
        expect(mockDeployChange).toHaveBeenCalledTimes(1)
        expect(mockDeployChange).toHaveBeenCalledWith({
          change: { action: 'remove', data: { before: clonedElements[0] } },
          client: expect.anything(),
          endpointDetails: expect.anything(),
          fieldsToIgnore: [DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME],
        })
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        expect(res.deployResult.appliedChanges).toHaveLength(3)
        expect(res.deployResult.appliedChanges).toEqual(
          clonedElements.map(e => ({ action: 'remove', data: { before: e } })),
        )
      })
      it('should return error if deployChange failed', async () => {
        const clonedTicketField = ticketField.clone()
        mockDeployChange.mockImplementation(async () => {
          throw new Error('err')
        })
        const res = await filter.deploy([{ action: 'add', data: { after: clonedTicketField } }])
        expect(mockDeployChange).toHaveBeenCalledTimes(1)
        expect(mockDeployChange).toHaveBeenCalledWith({
          change: { action: 'add', data: { after: clonedTicketField } },
          client: expect.anything(),
          endpointDetails: expect.anything(),
          fieldsToIgnore: [DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME],
        })
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(1)
        expect(res.deployResult.appliedChanges).toHaveLength(0)
      })
      it('should not add id to children if response is invalid', async () => {
        const clonedElements = [ticketField, option1, option2].map(e => e.clone())
        mockDeployChange.mockImplementation(async () => ({
          ticket_field: { id: 1, custom_field_options: [{ id: 2, value: 'v3' }, { id: 3, value: 'v4' }, 'bla'] },
        }))
        const res = await filter.deploy(clonedElements.map(e => ({ action: 'add', data: { after: e } })))
        expect(mockDeployChange).toHaveBeenCalledTimes(1)
        expect(mockDeployChange).toHaveBeenCalledWith({
          change: { action: 'add', data: { after: clonedElements[0] } },
          client: expect.anything(),
          endpointDetails: expect.anything(),
          fieldsToIgnore: [DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME],
        })
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        const expectedElements = [ticketField, option1, option2].map(e => e.clone())
        expectedElements[0].value.id = 1
        expect(res.deployResult.appliedChanges).toHaveLength(3)
        expect(res.deployResult.appliedChanges).toEqual(
          expectedElements.map(e => ({ action: 'add', data: { after: e } })),
        )
      })
    })
    describe('changes just in parent', () => {
      it('should deploy regularly if there is no options in parent', async () => {
        const clonedTicketField = ticketField.clone()
        delete clonedTicketField.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME]
        mockDeployChange.mockImplementation(async () => ({ ticket_field: { id: 1 } }))
        const res = await filter.deploy([{ action: 'add', data: { after: clonedTicketField } }])
        expect(mockDeployChange).toHaveBeenCalledTimes(1)
        expect(mockDeployChange).toHaveBeenCalledWith({
          change: { action: 'add', data: { after: clonedTicketField } },
          client: expect.anything(),
          endpointDetails: expect.anything(),
          fieldsToIgnore: [DEFAULT_CUSTOM_FIELD_OPTION_FIELD_NAME],
        })
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        const expectedTicketField = ticketField.clone()
        expectedTicketField.value.id = 1
        delete expectedTicketField.value[CUSTOM_FIELD_OPTIONS_FIELD_NAME]
        expect(res.deployResult.appliedChanges).toHaveLength(1)
        expect(res.deployResult.appliedChanges).toEqual([{ action: 'add', data: { after: expectedTicketField } }])
      })
    })
    describe('changes just in child', () => {
      it('should pass the correct params to deployChange', async () => {
        const id = 1
        const clonedChildBefore = option1.clone()
        const clonedChildAfter = option1.clone()
        clonedChildBefore.value.id = id
        clonedChildAfter.value.id = id
        clonedChildAfter.value.value = 'v33'
        mockDeployChange.mockImplementation(async () => ({}))
        const res = await filter.deploy([
          { action: 'modify', data: { before: clonedChildBefore, after: clonedChildAfter } },
        ])
        expect(mockDeployChange).toHaveBeenCalledTimes(1)
        expect(mockDeployChange).toHaveBeenCalledWith({
          change: { action: 'modify', data: { before: clonedChildBefore, after: clonedChildAfter } },
          client: expect.anything(),
          endpointDetails: expect.anything(),
          fieldsToIgnore: undefined,
        })
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        expect(res.deployResult.appliedChanges).toHaveLength(1)
        expect(res.deployResult.appliedChanges).toEqual([
          { action: 'modify', data: { before: clonedChildBefore, after: clonedChildAfter } },
        ])
      })
    })
  })
})
