/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { createElementQuery, ElementQuery } from '../../../src/fetch/query'

describe('query', () => {
  describe('createElementQuery', () => {
    let query: ElementQuery
    let inst: InstanceElement

    beforeEach(() => {
      query = createElementQuery({
        include: [
          {
            type: 'type1.*',
          },
        ],
        exclude: [
          {
            type: 'type12.*',
          },
        ],
      })

      inst = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'type11') }), {})
    })

    it('isTypeMatch should return true if the type matches the include but not the exclude', () => {
      expect(query.isTypeMatch('type11')).toBeTruthy()
    })

    it('isTypeMatch should return false if the type matches the include and the exclude', () => {
      expect(query.isTypeMatch('type12')).toBeFalsy()
    })

    it('isTypeMatch should return false if the type does not match the include', () => {
      expect(query.isTypeMatch('a_type11')).toBeFalsy()
    })

    it('isTypeMatch should match if include contain filter', () => {
      query = createElementQuery(
        {
          include: [
            {
              type: 'type1.*',
              criteria: {
                name: 'name1',
              },
            },
          ],
          exclude: [
            {
              type: 'type12.*',
            },
          ],
        },
        {
          name: ({ instance, value }) => instance.value.name === value,
        },
      )
      expect(query.isTypeMatch('type11')).toBeTruthy()
    })

    it('isTypeMatch should match if exclude contain filter', () => {
      query = createElementQuery(
        {
          include: [
            {
              type: 'type1.*',
            },
          ],
          exclude: [
            {
              type: 'type12.*',
              criteria: {
                name: 'name1',
              },
            },
          ],
        },
        {
          name: ({ instance, value }) => instance.value.name === value,
        },
      )
      expect(query.isTypeMatch('type12')).toBeTruthy()
    })

    it('isInstanceMatch should match when there is no filter', () => {
      expect(query.isInstanceMatch(inst)).toBeTruthy()
    })

    it('isInstanceMatch should if include filter match', () => {
      query = createElementQuery(
        {
          include: [
            {
              type: 'type1.*',
              criteria: {
                name: 'name1',
              },
            },
          ],
          exclude: [],
        },
        {
          name: ({ instance, value }) => instance.value.name === value,
        },
      )
      expect(query.isInstanceMatch(inst)).toBeFalsy()
      inst.value.name = 'name1'
      expect(query.isInstanceMatch(inst)).toBeTruthy()
    })

    it('isInstanceMatch should if exclude filter does not match', () => {
      query = createElementQuery(
        {
          include: [
            {
              type: 'type1.*',
            },
          ],
          exclude: [
            {
              type: 'type1.*',
              criteria: {
                name: 'name1',
              },
            },
          ],
        },
        {
          name: ({ instance, value }) => instance.value.name === value,
        },
      )
      expect(query.isInstanceMatch(inst)).toBeTruthy()
      inst.value.name = 'name1'
      expect(query.isInstanceMatch(inst)).toBeFalsy()
    })
  })
})
