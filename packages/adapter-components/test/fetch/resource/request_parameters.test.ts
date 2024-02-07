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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { InstanceElement, ObjectType, ElemID } from '@salto-io/adapter-api'
import { simpleGetArgs, computeGetArgs } from '../../../src/fetch/resource/request_parameters'

const logWarn = jest.fn()
jest.mock('@salto-io/logging', () => {
  const actual = jest.requireActual('@salto-io/logging')
  return {
    ...actual,
    logger: () => ({ ...actual.logger('test'), warn: (...args: unknown[]) => logWarn(args) }),
  }
})

describe('request_parameters', () => {
  describe('simpleGetArgs', () => {
    it('should pass standard args as provided', () => {
      expect(simpleGetArgs({ url: '/a/b/c' })).toEqual([{
        url: '/a/b/c',
        paginationField: undefined,
        queryParams: undefined,
        recursiveQueryParams: undefined,
      }])
      expect(simpleGetArgs({
        url: '/ep', paginationField: 'page', queryParams: { arg1: 'val1' },
      })).toEqual([{
        url: '/ep',
        paginationField: 'page',
        queryParams: { arg1: 'val1' },
        recursiveQueryParams: undefined,
      }])
    })

    it('should convert recursiveQueryParams to functions', () => {
      const res = simpleGetArgs({
        url: '/a/b/c',
        recursiveQueryByResponseField: {
          ref: 'referenced',
          parentId: 'id',
        },
      })
      expect(res).toEqual([{
        url: '/a/b/c',
        recursiveQueryParams: {
          ref: expect.anything(),
          parentId: expect.anything(),
        },
        paginationField: undefined,
        queryParams: undefined,
      }])
      expect(res[0].recursiveQueryParams?.ref({ a: 'a', b: 'b', referenced: 'val' })).toEqual('val')
      expect(res[0].recursiveQueryParams?.parentId({ a: 'a', b: 'b', referenced: 'val' })).toBeUndefined()
      expect(res[0].recursiveQueryParams?.parentId({ id: 'id' })).toEqual('id')
    })
  })

  describe('computeGetArgs', () => {
    it('should pass standard args as provided', () => {
      expect(computeGetArgs({ url: '/a/b/c' })).toEqual([{
        url: '/a/b/c',
        paginationField: undefined,
        queryParams: undefined,
        recursiveQueryParams: undefined,
      }])
      expect(computeGetArgs({
        url: '/ep', paginationField: 'page', queryParams: { arg1: 'val1' },
      })).toEqual([{
        url: '/ep',
        paginationField: 'page',
        queryParams: { arg1: 'val1' },
        recursiveQueryParams: undefined,
      }])
    })

    it('should convert recursiveQueryParams to functions', () => {
      const res = computeGetArgs({
        url: '/a/b/c',
        recursiveQueryByResponseField: {
          ref: 'referenced',
          parentId: 'id',
        },
      })
      expect(res).toEqual([{
        url: '/a/b/c',
        recursiveQueryParams: {
          ref: expect.anything(),
          parentId: expect.anything(),
        },
        paginationField: undefined,
        queryParams: undefined,
      }])
      expect(res[0].recursiveQueryParams?.ref({ a: 'a', b: 'b', referenced: 'val' })).toEqual('val')
      expect(res[0].recursiveQueryParams?.parentId({ a: 'a', b: 'b', referenced: 'val' })).toBeUndefined()
      expect(res[0].recursiveQueryParams?.parentId({ id: 'id' })).toEqual('id')
    })

    it('should resolve url params from the provided context', () => {
      const urls = computeGetArgs({ url: '/a/{p1}/{p2}' }, undefined, { p1: 'b', p2: 'c' })
      expect(urls).toEqual([{ url: '/a/b/c' }])
    })

    it('should fail if the provided context is not a primitive', () => {
      expect(
        () => computeGetArgs({ url: '/a/{p}' }, undefined, { p: { complex: true } })
      ).toThrow()
    })

    it('should compute dependsOn urls without duplicates', () => {
      const Pet = new ObjectType({ elemID: new ElemID('bla', 'Pet') })
      const Owner = new ObjectType({ elemID: new ElemID('bla', 'Owner') })
      expect(computeGetArgs(
        {
          url: '/a/b/{pet_id}',
          dependsOn: [
            { pathParam: 'pet_id', from: { type: 'Pet', field: 'id' } },
          ],
        },
        {
          Pet: [
            new InstanceElement('dog', Pet, { id: 'dogID' }),
            new InstanceElement('cat', Pet, { id: 'catID' }),
            new InstanceElement('cat', Pet, { id: 'catID' }),
            new InstanceElement('dog', Pet, { id: 'dogID' }),
          ],
          Owner: [
            new InstanceElement('o1', Owner, { id: 'ghi' }),
          ],
        },
      )).toEqual([
        {
          url: '/a/b/dogID',
          paginationField: undefined,
          queryParams: undefined,
          recursiveQueryParams: undefined,
        },
        {
          url: '/a/b/catID',
          paginationField: undefined,
          queryParams: undefined,
          recursiveQueryParams: undefined,
        },
      ])
    })
    it('should create all combinations if url contains more than one id', () => {
      const Pet = new ObjectType({ elemID: new ElemID('bla', 'Pet') })
      const Owner = new ObjectType({ elemID: new ElemID('bla', 'Owner') })
      const Food = new ObjectType({ elemID: new ElemID('bla', 'Food') })
      expect(computeGetArgs(
        {
          url: '/a/b/{owner_id}/{pet_id}/{food_id}',
          dependsOn: [
            { pathParam: 'pet_id', from: { type: 'Pet', field: 'id' } },
            { pathParam: 'food_id', from: { type: 'Food', field: 'id' } },
            { pathParam: 'owner_id', from: { type: 'Owner', field: 'id' } },
          ],
        },
        {
          Pet: [
            new InstanceElement('dog', Pet, { id: 'dogID' }),
            new InstanceElement('cat', Pet, { id: 'catID' }),
            new InstanceElement('cat', Pet, { id: 'catID' }),
            new InstanceElement('dog', Pet, { id: 'dogID' }),
          ],
          Owner: [
            new InstanceElement('o1', Owner, { id: 'o1' }),
            new InstanceElement('o2', Owner, { id: 'o2' }),
            new InstanceElement('o3', Owner, { id: 'o3' }),
          ],
          Food: [
            new InstanceElement('bamba', Food, { id: 'bamba' }),
            new InstanceElement('bissli', Food, { id: 'bissli' }),
          ],
        },
      )).toEqual([
        {
          url: '/a/b/o1/dogID/bamba',
          paginationField: undefined,
          queryParams: undefined,
          recursiveQueryParams: undefined,
        },
        {
          url: '/a/b/o1/dogID/bissli',
          paginationField: undefined,
          queryParams: undefined,
          recursiveQueryParams: undefined,
        },
        {
          url: '/a/b/o1/catID/bamba',
          paginationField: undefined,
          queryParams: undefined,
          recursiveQueryParams: undefined,
        },
        {
          url: '/a/b/o1/catID/bissli',
          paginationField: undefined,
          queryParams: undefined,
          recursiveQueryParams: undefined,
        },
        {
          url: '/a/b/o2/dogID/bamba',
          paginationField: undefined,
          queryParams: undefined,
          recursiveQueryParams: undefined,
        },
        {
          url: '/a/b/o2/dogID/bissli',
          paginationField: undefined,
          queryParams: undefined,
          recursiveQueryParams: undefined,
        },
        {
          url: '/a/b/o2/catID/bamba',
          paginationField: undefined,
          queryParams: undefined,
          recursiveQueryParams: undefined,
        },
        {
          url: '/a/b/o2/catID/bissli',
          paginationField: undefined,
          queryParams: undefined,
          recursiveQueryParams: undefined,
        },
        {
          url: '/a/b/o3/dogID/bamba',
          paginationField: undefined,
          queryParams: undefined,
          recursiveQueryParams: undefined,
        },
        {
          url: '/a/b/o3/dogID/bissli',
          paginationField: undefined,
          queryParams: undefined,
          recursiveQueryParams: undefined,
        },
        {
          url: '/a/b/o3/catID/bamba',
          paginationField: undefined,
          queryParams: undefined,
          recursiveQueryParams: undefined,
        },
        {
          url: '/a/b/o3/catID/bissli',
          paginationField: undefined,
          queryParams: undefined,
          recursiveQueryParams: undefined,
        },
      ])
    })
    it('should fail if no context is provided', () => {
      expect(() => computeGetArgs(
        {
          url: '/a/b/{pet_id}',
        },
        {},
      )).toThrow(new Error('cannot resolve endpoint /a/b/{pet_id} - missing context'))
      expect(() => computeGetArgs(
        {
          url: '/a/b/{pet_id}',
          dependsOn: [],
        },
        {},
      )).toThrow(new Error('cannot resolve endpoint /a/b/{pet_id} - missing context'))
      expect(() => computeGetArgs(
        {
          url: '/a/b/{pet_id}',
          dependsOn: [
            { pathParam: 'pet_id', from: { type: 'Pet', field: 'id' } },
          ],
        },
      )).toThrow(new Error('cannot resolve endpoint /a/b/{pet_id} - missing context'))
    })
    it('should fail if url is not valid', () => {
      expect(() => computeGetArgs(
        {
          url: '/a/b/{pet_id',
          dependsOn: [
            { pathParam: 'pet_id', from: { type: 'Pet', field: 'id' } },
          ],
        },
        {},
      )).toThrow(new Error('invalid endpoint definition /a/b/{pet_id'))
    })
    it('should fail if argument definition is not found in dependsOn', () => {
      expect(() => computeGetArgs(
        {
          url: '/a/b/{some_uncovered_id}',
          dependsOn: [
            { pathParam: 'pet_id', from: { type: 'Pet', field: 'id' } },
          ],
        },
        {},
      )).toThrow(new Error('could not resolve path param some_uncovered_id in url /a/b/{some_uncovered_id}'))
    })
    it('should not fail if referenced type has no instances', () => {
      computeGetArgs(
        {
          url: '/a/b/{pet_id}',
          dependsOn: [
            { pathParam: 'pet_id', from: { type: 'Pet', field: 'id' } },
          ],
        },
        { Pet: [] },
      )
      expect(logWarn).toHaveBeenCalledWith(['no instances found for Pet, cannot call endpoint /a/b/{pet_id}'])
    })
  })
})
