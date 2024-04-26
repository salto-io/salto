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
  ReferenceExpression,
  CORE_ANNOTATIONS,
  toChange,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { createFilterCreatorParams } from '../utils'
import { DYNAMIC_CONTENT_ITEM_TYPE_NAME, ZENDESK } from '../../src/constants'
import filterCreator, {
  DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME,
  VARIANTS_FIELD_NAME,
} from '../../src/filters/dynamic_content'
import ZendeskClient from '../../src/client/client'

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

describe('dynamic content filter', () => {
  type FilterType = filterUtils.FilterWith<'deploy' | 'preDeploy' | 'onDeploy'>
  let filter: FilterType
  let client: ZendeskClient
  const parentTypeName = DYNAMIC_CONTENT_ITEM_TYPE_NAME
  const childTypeName = DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME
  const parentObjType = new ObjectType({
    elemID: new ElemID(ZENDESK, parentTypeName),
  })
  const childObjType = new ObjectType({
    elemID: new ElemID(ZENDESK, childTypeName),
  })
  const localeObjType = new ObjectType({ elemID: new ElemID(ZENDESK, 'locale') })
  const localeInstEnUs = new InstanceElement('English', localeObjType, {
    id: 1,
    locale: 'en-US',
    name: 'English',
    native_name: 'English (United States)',
    presentation_name: 'English (United States)',
    rtl: false,
    default: true,
  })
  const localeInstEs = new InstanceElement('English', localeObjType, {
    id: 2,
    locale: 'es',
    name: 'Español',
    native_name: 'español',
    presentation_name: 'Spanish - español',
    rtl: false,
    default: false,
  })
  const parent = new InstanceElement('parent', parentObjType, {
    id: 11,
    name: 'parent',
    default_locale_id: new ReferenceExpression(localeInstEnUs.elemID, localeInstEnUs),
    [VARIANTS_FIELD_NAME]: [
      new ReferenceExpression(new ElemID(ZENDESK, childTypeName, 'instance', 'child1')),
      new ReferenceExpression(new ElemID(ZENDESK, childTypeName, 'instance', 'child2')),
    ],
  })
  const child1 = new InstanceElement(
    'child1',
    childObjType,
    {
      id: 22,
      content: 'abc',
      locale_id: new ReferenceExpression(localeInstEnUs.elemID, localeInstEnUs),
      active: true,
      default: true,
    },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)] },
  )
  const child2 = new InstanceElement(
    'child2',
    childObjType,
    {
      id: 33,
      content: 'abc',
      locale_id: new ReferenceExpression(localeInstEs.elemID, localeInstEs),
      active: true,
      default: false,
    },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)] },
  )

  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })

    filter = filterCreator(createFilterCreatorParams({ client })) as FilterType
  })

  describe('preDeploy', () => {
    const resolvedParent = new InstanceElement('parent', parentObjType, {
      default_locale_id: 1,
      name: 'parent',
      [VARIANTS_FIELD_NAME]: [1, 2],
    })
    const child1Resolved = new InstanceElement('child1', childObjType, {
      content: 'abc',
      locale_id: 1,
      active: true,
      default: true,
    })
    const child2Resolved = new InstanceElement('child2', childObjType, {
      content: 'abc',
      locale_id: 2,
      active: true,
      default: false,
    })

    it('should add variants resolved value', async () => {
      const clonedResolvedParent = resolvedParent.clone()
      const changes = [clonedResolvedParent, child1Resolved, child2Resolved].map(after => toChange({ after }))
      await filter?.preDeploy(changes)
      expect(clonedResolvedParent.value[VARIANTS_FIELD_NAME]).toEqual([
        { content: 'abc', locale_id: 1, active: true, default: true },
        { content: 'abc', locale_id: 2, active: true, default: false },
      ])
    })
    it('should not change variants on parent if this was not addition', async () => {
      const clonedParentEdited = resolvedParent.clone()
      clonedParentEdited.value.name = 'parent - edited'
      await filter?.preDeploy([
        toChange({ before: resolvedParent.clone(), after: clonedParentEdited }),
        toChange({ after: child1 }),
        toChange({ after: child2 }),
      ])
      expect(clonedParentEdited.value[VARIANTS_FIELD_NAME]).toEqual([1, 2])
    })
  })
  describe('onDeploy', () => {
    const resolvedParent = new InstanceElement('parent', parentObjType, {
      id: 11,
      default_locale_id: 1,
      name: 'parent',
      [VARIANTS_FIELD_NAME]: [
        { id: 22, content: 'abc', locale_id: 1, active: true, default: true },
        { id: 33, content: 'abc', locale_id: 2, active: true, default: false },
      ],
    })
    const child1Resolved = new InstanceElement('child1', childObjType, {
      id: 22,
      content: 'abc',
      locale_id: 1,
      active: true,
      default: true,
    })
    const child2Resolved = new InstanceElement('child2', childObjType, {
      id: 33,
      content: 'abc',
      locale_id: 2,
      active: true,
      default: false,
    })

    it('should resolved variants value back', async () => {
      const clonedResolvedParent = resolvedParent.clone()
      const changes = [clonedResolvedParent, child1Resolved, child2Resolved].map(after => toChange({ after }))
      await filter?.onDeploy(changes)
      expect(clonedResolvedParent.value[VARIANTS_FIELD_NAME]).toEqual([1, 2])
    })
  })
  describe('deploy', () => {
    describe('dynamic content item types and variant changes', () => {
      const resolvedParent = new InstanceElement('parent', parentObjType, {
        default_locale_id: 1,
        name: 'parent',
        placeholder: '{{dc.parent}}',
        [VARIANTS_FIELD_NAME]: [
          { content: 'abc', locale_id: 1, active: true, default: true },
          { content: 'abc', locale_id: 2, active: true, default: false },
        ],
      })
      const child1Resolved = new InstanceElement('child1', childObjType, {
        content: 'abc',
        locale_id: 1,
        active: true,
        default: true,
      })
      const child2Resolved = new InstanceElement('child2', childObjType, {
        content: 'abc',
        locale_id: 2,
        active: true,
        default: false,
      })
      it('should pass the correct params to deployChange when we add both parent and children', async () => {
        const clonedElements = [resolvedParent, child1Resolved, child2Resolved].map(e => e.clone())
        mockDeployChange.mockImplementation(async () => ({
          item: {
            id: 11,
            variants: [
              { id: 22, locale_id: 1 },
              { id: 33, locale_id: 2 },
            ],
          },
        }))
        const res = await filter.deploy(clonedElements.map(e => ({ action: 'add', data: { after: e } })))
        expect(mockDeployChange).toHaveBeenCalledTimes(1)
        expect(mockDeployChange).toHaveBeenCalledWith({
          change: { action: 'add', data: { after: clonedElements[0] } },
          client: expect.anything(),
          endpointDetails: expect.anything(),
          undefined,
        })
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        const expectedElements = [resolvedParent, child1Resolved, child2Resolved].map(e => e.clone())
        expectedElements[0].value.id = 11
        expectedElements[1].value.id = 22
        expectedElements[2].value.id = 33
        expect(res.deployResult.appliedChanges).toHaveLength(3)
        expect(res.deployResult.appliedChanges).toEqual(
          expectedElements.map(e => ({ action: 'add', data: { after: e } })),
        )
      })
      it('should pass the correct params to deployChange when we remove both parent and children', async () => {
        const clonedElements = [resolvedParent, child1Resolved, child2Resolved].map(e => e.clone())
        clonedElements[0].value.id = 11
        clonedElements[1].value.id = 22
        clonedElements[2].value.id = 33
        mockDeployChange.mockImplementation(async () => ({}))
        const res = await filter.deploy(clonedElements.map(e => ({ action: 'remove', data: { before: e } })))
        expect(mockDeployChange).toHaveBeenCalledTimes(1)
        expect(mockDeployChange).toHaveBeenCalledWith({
          change: { action: 'remove', data: { before: clonedElements[0] } },
          client: expect.anything(),
          endpointDetails: expect.anything(),
          undefined,
        })
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        expect(res.deployResult.appliedChanges).toHaveLength(3)
        expect(res.deployResult.appliedChanges).toEqual(
          clonedElements.map(e => ({ action: 'remove', data: { before: e } })),
        )
      })
      it('should pass the correct params to deployChange when we modify both parent and children', async () => {
        const beforeElements = [resolvedParent, child1Resolved, child2Resolved].map(e => e.clone())
        beforeElements[0].value.id = 11
        beforeElements[1].value.id = 22
        beforeElements[2].value.id = 33
        const afterElements = beforeElements
          .map(e => e.clone())
          .map(e => {
            e.value.name = `${e.value.name}-edited`
            return e
          })
        mockDeployChange.mockImplementation(async () => ({}))
        const res = await filter.deploy(
          beforeElements.map((e, i) => ({
            action: 'modify',
            data: { before: e, after: afterElements[i] },
          })),
        )
        expect(mockDeployChange).toHaveBeenCalledTimes(3)
        beforeElements.forEach((e, i) => {
          expect(mockDeployChange).toHaveBeenNthCalledWith(i + 1, {
            change: { action: 'modify', data: { before: e, after: afterElements[i] } },
            client: expect.anything(),
            endpointDetails: expect.anything(),
            fieldsToOmit: undefined,
          })
        })
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        expect(res.deployResult.appliedChanges).toHaveLength(3)
        expect(res.deployResult.appliedChanges).toEqual(
          beforeElements.map((e, i) => ({ action: 'modify', data: { before: e, after: afterElements[i] } })),
        )
      })
      it('should return error if deployChange failed', async () => {
        const clonedResolvedParent = resolvedParent.clone()
        mockDeployChange.mockImplementation(async () => {
          throw new Error('err')
        })
        const res = await filter.deploy([{ action: 'add', data: { after: clonedResolvedParent } }])
        expect(mockDeployChange).toHaveBeenCalledTimes(1)
        expect(mockDeployChange).toHaveBeenCalledWith({
          change: { action: 'add', data: { after: clonedResolvedParent } },
          client: expect.anything(),
          endpointDetails: expect.anything(),
          undefined,
        })
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(1)
        expect(res.deployResult.appliedChanges).toHaveLength(0)
      })
    })
    describe('deploy of dynamic content item with a different placeholder than the name', () => {
      const differentNameAndPlaceholder = new InstanceElement('dynamicContentItem', parentObjType, {
        default_locale_id: 1,
        name: 'differentNameAndPlaceholder',
        placeholder: '{{dc.placeholder}}',
        [VARIANTS_FIELD_NAME]: [{ content: 'abc', locale_id: 1, active: true, default: true }],
      })
      const sameNameAndPlaceholder = new InstanceElement('dynamicContentItem', parentObjType, {
        default_locale_id: 1,
        name: 'placeholder',
        placeholder: '{{dc.placeholder}}',
        [VARIANTS_FIELD_NAME]: [{ content: 'abc', locale_id: 1, active: true, default: true }],
      })

      it('should create the correct changes when creating a new change where name is different from the placeholder', async () => {
        mockDeployChange.mockImplementation(async args => args.change)
        const res = await filter.deploy([{ action: 'add', data: { after: differentNameAndPlaceholder } }])
        expect(mockDeployChange).toHaveBeenCalledTimes(2)
        expect(mockDeployChange).toHaveBeenNthCalledWith(1, {
          change: { action: 'add', data: { after: sameNameAndPlaceholder } },
          client: expect.anything(),
          endpointDetails: expect.anything(),
          fieldsToOmit: undefined,
        })
        expect(mockDeployChange).toHaveBeenNthCalledWith(2, {
          change: {
            action: 'modify',
            data: {
              before: sameNameAndPlaceholder,
              after: differentNameAndPlaceholder,
            },
          },
          client: expect.anything(),
          endpointDetails: expect.anything(),
          fieldsToOmit: undefined,
        })
        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(0)
        expect(res.deployResult.appliedChanges).toHaveLength(1)
        expect(res.deployResult.appliedChanges[0]).toEqual({
          action: 'add',
          data: { after: differentNameAndPlaceholder },
        })
      })
      it('should return a failure when the addition fails', async () => {
        mockDeployChange.mockImplementation(async () => {
          throw new Error('Failed to create dynamic content item')
        })

        const res = await filter.deploy([{ action: 'add', data: { after: differentNameAndPlaceholder } }])
        expect(mockDeployChange).toHaveBeenCalledTimes(1)
        expect(mockDeployChange).toHaveBeenCalledWith({
          change: {
            action: 'add',
            data: {
              after: sameNameAndPlaceholder,
            },
          },
          client: expect.anything(),
          endpointDetails: expect.anything(),
          fieldsToOmit: undefined,
        })

        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.appliedChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(1)
        expect(res.deployResult.errors[0].severity).toEqual('Error')
        expect(res.deployResult.errors[0].message).toContain('Failed to create dynamic content item')
      })
      it('should return a warning when the addition succeeds, modification fails, and deletion fails', async () => {
        mockDeployChange.mockImplementation(async args => {
          if (args.change.action === 'add') {
            // return valid deploy response
            return args.change
          }
          if (args.change.action === 'modify') {
            throw new Error('Failed to modify dynamic content item')
          } else {
            // removal change
            throw new Error(
              'Unable to modify name of dynamic content item, please modify it in the Zendesk UI and fetch with regenerate salto ids.',
            )
          }
        })
        const res = await filter.deploy([{ action: 'add', data: { after: differentNameAndPlaceholder } }])
        expect(mockDeployChange).toHaveBeenCalledTimes(3)
        expect(mockDeployChange).toHaveBeenNthCalledWith(1, {
          change: { action: 'add', data: { after: sameNameAndPlaceholder } },
          client: expect.anything(),
          endpointDetails: expect.anything(),
          fieldsToOmit: undefined,
        })
        expect(mockDeployChange).toHaveBeenNthCalledWith(2, {
          change: {
            action: 'modify',
            data: {
              before: sameNameAndPlaceholder,
              after: differentNameAndPlaceholder,
            },
          },
          client: expect.anything(),
          endpointDetails: expect.anything(),
          fieldsToOmit: undefined,
        })
        expect(mockDeployChange).toHaveBeenNthCalledWith(3, {
          change: { action: 'remove', data: { before: sameNameAndPlaceholder } },
          client: expect.anything(),
          endpointDetails: expect.anything(),
          fieldsToOmit: undefined,
        })

        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(1)
        expect(res.deployResult.errors[0].severity).toEqual('Warning')
        expect(res.deployResult.errors[0].message).toEqual(
          'Unable to modify name of dynamic content item, please modify it in the Zendesk UI and fetch with regenerate salto ids.',
        )
        expect(res.deployResult.appliedChanges).toHaveLength(0)
      })
      it('should return a failure when addition succeeds, modification fails, and deletion succeeds', async () => {
        mockDeployChange.mockImplementation(async args => {
          if (args.change.action === 'add' || args.change.action === 'remove') {
            // return valid deploy response
            return args.change
          }
          // modify
          throw new Error('Failed to modify dynamic content item')
        })
        const res = await filter.deploy([{ action: 'add', data: { after: differentNameAndPlaceholder } }])
        expect(mockDeployChange).toHaveBeenCalledTimes(3)
        expect(mockDeployChange).toHaveBeenNthCalledWith(1, {
          change: { action: 'add', data: { after: sameNameAndPlaceholder } },
          client: expect.anything(),
          endpointDetails: expect.anything(),
          fieldsToOmit: undefined,
        })
        expect(mockDeployChange).toHaveBeenNthCalledWith(2, {
          change: {
            action: 'modify',
            data: {
              before: sameNameAndPlaceholder,
              after: differentNameAndPlaceholder,
            },
          },
          client: expect.anything(),
          endpointDetails: expect.anything(),
          fieldsToOmit: undefined,
        })
        expect(mockDeployChange).toHaveBeenNthCalledWith(3, {
          change: { action: 'remove', data: { before: sameNameAndPlaceholder } },
          client: expect.anything(),
          endpointDetails: expect.anything(),
          fieldsToOmit: undefined,
        })

        expect(res.leftoverChanges).toHaveLength(0)
        expect(res.deployResult.errors).toHaveLength(1)
        expect(res.deployResult.errors[0].severity).toEqual('Error')
        expect(res.deployResult.errors[0].message).toContain('Failed to create dynamic content item')
        expect(res.deployResult.appliedChanges).toHaveLength(0)
      })
    })
  })
})
