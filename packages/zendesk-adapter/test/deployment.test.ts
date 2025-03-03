/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { makeResolvablePromise, Resolvable } from '@salto-io/test-utils'

import { Change, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { promises } from '@salto-io/lowerdash'
import { definitions as definitionsUtils } from '@salto-io/adapter-components'
import { ZENDESK } from '../src/constants'
import { addId, deployChangesSequentially } from '../src/deployment'
import { Options } from '../src/definitions/types'

const { sleep } = promises.timeout
const mockDeployChangeFunc = jest.fn()

describe('deployment', () => {
  describe('deployChangesSequentially', () => {
    let p: Resolvable<number>
    const routingAttribute1 = new InstanceElement(
      'Test1',
      new ObjectType({ elemID: new ElemID(ZENDESK, 'routing_attribute') }),
      { name: 'Test', values: [] },
    )
    const routingAttribute2 = new InstanceElement(
      'Test2',
      new ObjectType({ elemID: new ElemID(ZENDESK, 'routing_attribute') }),
      { name: 'Test', values: [] },
    )

    beforeEach(async () => {
      p = makeResolvablePromise(0)
      jest.clearAllMocks()
      mockDeployChangeFunc.mockImplementation(async (_change: Change): Promise<void> => {
        await p.promise
      })
    })
    it('should work correctly', async () => {
      const change1: Change = { action: 'add', data: { after: routingAttribute1 } }
      const change2: Change = { action: 'add', data: { after: routingAttribute2 } }
      const res = deployChangesSequentially([change1, change2], mockDeployChangeFunc)
      await sleep(1)
      expect(mockDeployChangeFunc).toHaveBeenCalledTimes(1)
      expect(mockDeployChangeFunc).toHaveBeenCalledWith({ action: 'add', data: { after: routingAttribute1 } })
      p.resolve()
      await p.promise
      await sleep(1)
      expect(mockDeployChangeFunc).toHaveBeenCalledTimes(2)
      expect(mockDeployChangeFunc).toHaveBeenLastCalledWith({ action: 'add', data: { after: routingAttribute2 } })
      expect(await res).toEqual({
        appliedChanges: [
          { action: 'add', data: { after: routingAttribute1 } },
          { action: 'add', data: { after: routingAttribute2 } },
        ],
        errors: [],
      })
    })
  })

  describe('addId', () => {
    const mockedDefinitions = {
      fetch: {
        instances: {
          default: {
            resource: {
              serviceIDFields: ['id'],
            },
          },
          customizations: {
            type1: {
              resource: { serviceIDFields: ['id'] },
            },
            type2: {
              resource: { serviceIDFields: ['customId', 'secondaryId', 'name'] },
            },
          },
        },
      },
    } as unknown as definitionsUtils.RequiredDefinitions<Options>

    it('should add id from response for addition change', () => {
      const instance = new InstanceElement('test', new ObjectType({ elemID: new ElemID(ZENDESK, 'type1') }), {
        name: 'Test',
      })
      const change: Change<InstanceElement> = toChange({
        after: instance,
      })
      const response = { id: '123', name: 'Test' }

      addId({ change, definitions: mockedDefinitions, response })

      expect(instance.value).toEqual({ name: 'Test', id: '123' })
    })

    it('should add multiple service ids from response', () => {
      const instance = new InstanceElement('test', new ObjectType({ elemID: new ElemID(ZENDESK, 'type2') }), {
        name: 'Test',
      })
      const change: Change<InstanceElement> = toChange({
        after: instance,
      })
      const response = { customId: 'abc', secondaryId: 'xyz', name: 'Test2' }

      addId({ change, definitions: mockedDefinitions, response })

      expect(instance.value).toEqual({
        name: 'Test2',
        customId: 'abc',
        secondaryId: 'xyz',
      })
    })

    it('should use dataField to extract id from response', () => {
      const instance = new InstanceElement('test', new ObjectType({ elemID: new ElemID(ZENDESK, 'type1') }), {
        name: 'Test',
      })
      const change: Change<InstanceElement> = toChange({
        after: instance,
      })
      const response = { data: { id: '123', name: 'Test' } }

      addId({ change, definitions: mockedDefinitions, response, dataField: 'data' })

      expect(instance.value).toEqual({ name: 'Test', id: '123' })
    })

    it('should not add id for modification change by default', () => {
      const instance = new InstanceElement('test', new ObjectType({ elemID: new ElemID(ZENDESK, 'type1') }), {
        name: 'Test',
      })
      const change: Change<InstanceElement> = toChange({
        after: instance,
        before: instance,
      })
      const response = { id: '123', name: 'Test' }

      addId({ change, definitions: mockedDefinitions, response })

      expect(instance.value).toEqual({ name: 'Test' })
    })

    it('should add id for modification change when addAlsoOnModification is true', () => {
      const instance = new InstanceElement('test', new ObjectType({ elemID: new ElemID(ZENDESK, 'type1') }), {
        name: 'Test',
      })
      const change: Change<InstanceElement> = toChange({
        after: instance,
      })
      const response = { id: '123', name: 'Test' }

      addId({
        change,
        definitions: mockedDefinitions,
        response,
        addAlsoOnModification: true,
      })

      expect(instance.value).toEqual({ name: 'Test', id: '123' })
    })

    it('should not modify instance when response is an array', () => {
      const instance = new InstanceElement('test', new ObjectType({ elemID: new ElemID(ZENDESK, 'type1') }), {
        name: 'Test',
      })
      const change: Change<InstanceElement> = toChange({
        after: instance,
      })
      const response = [{ id: '123', name: 'Test' }]

      addId({ change, definitions: mockedDefinitions, response })

      expect(instance.value).toEqual({ name: 'Test' })
    })
  })
})
