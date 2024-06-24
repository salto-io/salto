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
  CORE_ANNOTATIONS,
  ElemID,
  getChangeData,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { elements as elementsUtils, filterUtils } from '@salto-io/adapter-components'
import {
  CUSTOM_OBJECT_FIELD_ORDER_TYPE_NAME,
  CUSTOM_OBJECT_FIELD_TYPE_NAME,
  CUSTOM_OBJECT_TYPE_NAME,
  ORDER_FIELD,
  ZENDESK,
} from '../../../src/constants'
import filterCreator, {
  customObjectFieldsOrderType,
} from '../../../src/filters/custom_objects/custom_object_fields_order'
import { createFilterCreatorParams } from '../../utils'
import ZendeskClient from '../../../src/client/client'

const { RECORDS_PATH } = elementsUtils
type FilterType = filterUtils.FilterWith<'onFetch' | 'deploy'>

const createCustomObjectField = (id: number, parent: InstanceElement): InstanceElement =>
  new InstanceElement(
    `customObjectField${id}`,
    new ObjectType({ elemID: new ElemID(ZENDESK, CUSTOM_OBJECT_FIELD_TYPE_NAME) }),
    { id },
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)] },
  )

const createCustomObject = (id: number): InstanceElement =>
  new InstanceElement(`customObject${id}`, new ObjectType({ elemID: new ElemID(ZENDESK, CUSTOM_OBJECT_TYPE_NAME) }), {
    key: 'key',
  })

const createCustomObjectFieldsOrder = (
  name: string,
  fields: InstanceElement[],
  parent: InstanceElement,
): InstanceElement =>
  new InstanceElement(
    name,
    customObjectFieldsOrderType,
    { [ORDER_FIELD]: fields.map(field => new ReferenceExpression(field.elemID, field)) },
    [ZENDESK, RECORDS_PATH, CUSTOM_OBJECT_FIELD_ORDER_TYPE_NAME, name],
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parent.elemID, parent)] },
  )

describe('customObjectFieldsOrderFilter', () => {
  let customObjectFieldsOrderFilter: FilterType
  let putSpy: jest.SpyInstance
  let customObject1: InstanceElement
  let customObject2: InstanceElement
  let customObjectField1: InstanceElement
  let customObjectField2: InstanceElement
  let customObjectField3: InstanceElement
  beforeEach(() => {
    jest.clearAllMocks()
    const client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    putSpy = jest.spyOn(client, 'put')
    customObjectFieldsOrderFilter = filterCreator(createFilterCreatorParams({ client })) as FilterType
    customObject1 = createCustomObject(1)
    customObject2 = createCustomObject(2)
    customObjectField1 = createCustomObjectField(1, customObject1)
    customObjectField2 = createCustomObjectField(2, customObject1)
    customObjectField3 = createCustomObjectField(3, customObject2)
  })
  describe('onFetch', () => {
    it('should create order instance and order type', async () => {
      const elements = [customObject1, customObject2, customObjectField1, customObjectField2, customObjectField3]
      const initialLength = elements.length
      await customObjectFieldsOrderFilter.onFetch(elements)
      // 1 type and 2 instances
      expect(elements).toHaveLength(initialLength + 1 + 2)
      expect(elements[initialLength]).toEqual(customObjectFieldsOrderType)
      expect(elements[initialLength + 1]).toEqual(
        createCustomObjectFieldsOrder(
          `${customObject1.elemID.name}_fields_order`,
          [customObjectField1, customObjectField2],
          customObject1,
        ),
      )
      expect(elements[initialLength + 2]).toEqual(
        createCustomObjectFieldsOrder(`${customObject2.elemID.name}_fields_order`, [customObjectField3], customObject2),
      )
    })
    it('should not crash with field instance without a parent', async () => {
      const elements = [customObject1, customObjectField1, customObjectField2]
      customObjectField1.annotations[CORE_ANNOTATIONS.PARENT] = undefined
      await customObjectFieldsOrderFilter.onFetch(elements)
      expect(elements[elements.length - 1]).toEqual(
        createCustomObjectFieldsOrder(`${customObject1.elemID.name}_fields_order`, [customObjectField2], customObject1),
      )
    })
  })
  describe('deploy', () => {
    it('should send a request to reorder the fields', async () => {
      const customObjectField4 = createCustomObjectField(4, customObject1)
      const customObjectFieldsOrder = createCustomObjectFieldsOrder(
        `${customObject1.elemID.name}_fields_order`,
        [customObjectField1, customObjectField2, customObjectField3, customObjectField4],
        customObject1,
      )
      // Check support for both resolved and unresolved values
      customObjectFieldsOrder.value[ORDER_FIELD][0] = customObjectFieldsOrder.value[ORDER_FIELD][0].value.value
      // should be ignored
      customObjectFieldsOrder.value[ORDER_FIELD][3] = 'invalid'

      putSpy.mockResolvedValueOnce({ status: 200 })
      const changes = [toChange({ after: customObjectFieldsOrder })]
      const deployResults = await customObjectFieldsOrderFilter.deploy(changes)

      expect(putSpy).toHaveBeenCalledTimes(1)
      expect(putSpy).toHaveBeenCalledWith({
        url: `/api/v2/custom_objects/${customObject1.value.key}/fields/reorder`,
        data: {
          custom_object_field_ids: [
            customObjectField1.value.id.toString(),
            customObjectField2.value.id.toString(),
            customObjectField3.value.id.toString(),
          ],
        },
      })
      expect(deployResults.deployResult.errors).toHaveLength(0)
      expect(deployResults.deployResult.appliedChanges).toMatchObject(changes)
    })
    it('should return correct errors on failure', async () => {
      const customObjectFieldsOrder = createCustomObjectFieldsOrder(
        `${customObject1.elemID.name}_fields_order`,
        [customObjectField1, customObjectField2, customObjectField3],
        customObject1,
      )
      delete customObject2.value.key
      const orderWithoutParentKey = createCustomObjectFieldsOrder(
        `${customObject2.elemID.name}_fields_order`,
        [customObjectField1, customObjectField2, customObjectField3],
        customObject2,
      )
      const orderWithoutParent = orderWithoutParentKey.clone()
      orderWithoutParent.annotations[CORE_ANNOTATIONS.PARENT] = undefined

      putSpy.mockRejectedValueOnce({ response: { status: 400, data: { error: 'test' } } })
      const changes = [
        toChange({ after: customObjectFieldsOrder }),
        toChange({ before: orderWithoutParentKey, after: orderWithoutParentKey }),
        toChange({ before: orderWithoutParent, after: orderWithoutParent }),
      ]
      const deployResults = await customObjectFieldsOrderFilter.deploy(changes)
      expect(deployResults.deployResult.appliedChanges).toMatchObject([])
      expect(deployResults.deployResult.errors).toHaveLength(3)
      expect(deployResults.deployResult.errors[0]).toMatchObject({
        elemID: getChangeData(changes[0]).elemID,
        severity: 'Error',
        message: "fields reorder request failed, { status: 400, data: { error: 'test' } }",
      })
      expect(deployResults.deployResult.errors[1]).toMatchObject({
        elemID: getChangeData(changes[1]).elemID,
        severity: 'Error',
        message: 'parent custom_object key is undefined',
      })
      expect(deployResults.deployResult.errors[2]).toMatchObject({
        elemID: getChangeData(changes[2]).elemID,
        severity: 'Error',
        message: 'parent custom_object is undefined',
      })
    })
    it('should ignore fields without id', async () => {
      putSpy.mockResolvedValue({ status: 200 })
      customObjectField1.value.id = undefined
      const customObjectFieldsOrder = createCustomObjectFieldsOrder(
        `${customObject1.elemID.name}_fields_order`,
        [customObjectField1, customObjectField2, customObjectField3],
        customObject1,
      )

      const changes = [toChange({ after: customObjectFieldsOrder })]
      const deployResults = await customObjectFieldsOrderFilter.deploy(changes)
      expect(deployResults.deployResult.errors).toHaveLength(0)
      expect(deployResults.deployResult.appliedChanges).toMatchObject(changes)
      expect(putSpy).toHaveBeenCalledTimes(1)
      expect(putSpy).toHaveBeenCalledWith({
        url: `/api/v2/custom_objects/${customObject1.value.key}/fields/reorder`,
        data: {
          custom_object_field_ids: [customObjectField2.value.id.toString(), customObjectField3.value.id.toString()],
        },
      })
    })
  })
})
