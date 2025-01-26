/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ObjectType, ElemID, CORE_ANNOTATIONS, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { FilterWith } from '../../src/filter_utils'
import { omitCollisionsFilterCreator } from '../../src/filters/omit_collisions'
import { createMockQuery } from '../../src/fetch/query'
import { ApiDefinitions } from '../../src/definitions'

const ADAPTER_NAME = 'myAdapter'

describe('omitCollisionsFilter', () => {
  const filter = omitCollisionsFilterCreator(ADAPTER_NAME)({
    elementSource: buildElementsSourceFromElements([]),
    definitions: {
      fetch: {
        instances: {
          default: {},
          customizations: {
            t1: {
              element: {
                topLevel: {
                  isTopLevel: true,
                  elemID: { parts: [{ fieldName: 'name' }, { fieldName: 'status' }] },
                },
              },
            },
          },
        },
      },
    } as unknown as ApiDefinitions,
    config: {},
    fetchQuery: createMockQuery(),
    sharedContext: {},
  }) as FilterWith<'onFetch'>

  const objTypeA = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 't1') })
  const childObjTypeB = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 't2') })
  const instanceA = new InstanceElement('A', objTypeA, {}, [ADAPTER_NAME, 't1', 'i1'])
  const instanceA2 = new InstanceElement('A', objTypeA, {}, [ADAPTER_NAME, 't1', 'i2'])

  it('should omit elements with the same elemID', async () => {
    const elements = [objTypeA, childObjTypeB, instanceA, instanceA2]
    const res = await filter.onFetch(elements)
    expect(elements).toHaveLength(2)
    expect(res).toMatchObject({
      errors: [
        {
          severity: 'Warning',
          message: 'Some elements were not fetched due to Salto ID collisions',
          detailedMessage: `2 myAdapter elements and their child elements were not fetched, as they were mapped to a single ID myAdapter.t1.instance.A:
A,
A .

Usually, this happens because of duplicate configuration names in the service. Make sure these element names are unique, and try fetching again.
Learn about additional ways to resolve this issue at https://help.salto.io/en/articles/6927157-salto-id-collisions .`,
        },
      ],
    })
  })
  it('should omit any child elements of the colliding elements', async () => {
    const childA = new InstanceElement('childA', childObjTypeB, {}, [ADAPTER_NAME, 't2', 'c1'], {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(instanceA.elemID, instanceA)],
    })
    const childA2 = new InstanceElement('childA2', childObjTypeB, {}, [ADAPTER_NAME, 't2', 'c2'], {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(instanceA2.elemID, instanceA2)],
    })
    const elements = [objTypeA, childObjTypeB, instanceA, instanceA2, childA, childA2]
    const res = await filter.onFetch(elements)
    expect(elements).toHaveLength(2)
    expect(res).toMatchObject({
      errors: [
        {
          severity: 'Warning',
          message: expect.stringContaining('Some elements were not fetched due to Salto ID collisions'),
          detailedMessage: `2 myAdapter elements and their child elements were not fetched, as they were mapped to a single ID myAdapter.t1.instance.A:
A,
A .

Usually, this happens because of duplicate configuration names in the service. Make sure these element names are unique, and try fetching again.
Learn about additional ways to resolve this issue at https://help.salto.io/en/articles/6927157-salto-id-collisions .`,
        },
      ],
    })
  })
  it('should not omit elements with different elemID', async () => {
    const instanceB = new InstanceElement('B', childObjTypeB, {}, [ADAPTER_NAME, 't2', 'i3'])
    const elements = [objTypeA, childObjTypeB, instanceA, instanceB]
    const res = await filter.onFetch(elements)
    expect(elements).toHaveLength(4)
    expect(res).toMatchObject({ errors: [] })
  })
})
