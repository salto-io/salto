/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { ObjectType, ElemID } from '@salto-io/adapter-api'
import createClient from './client/client'
import NetsuiteAdapter from '../src/adapter'
import { NETSUITE } from '../src/constants'
import { recordInList } from './utils'

describe('Adapter', () => {
  const { client } = createClient()
  const netsuiteAdapter = new NetsuiteAdapter({ client })

  describe('fetch', () => {
    it('should fetch all types and instances', async () => {
      client.listCustomizations = jest.fn().mockImplementation(type => {
        if (type === 'entityCustomField') {
          return Promise.resolve([recordInList])
        }
        return Promise.resolve([])
      })
      const elements = await netsuiteAdapter.fetch()
      expect(elements).toHaveLength(2)
    })
  })

  describe('add', () => { // todo: implement tests once implemented
    it('dummy test for coverage', async () => {
      await netsuiteAdapter.add(new ObjectType({ elemID: new ElemID(NETSUITE, 'test') }))
    })
  })

  describe('update', () => { // todo: implement tests once implemented
    it('dummy test for coverage', async () => {
      await netsuiteAdapter.update(new ObjectType({ elemID: new ElemID(NETSUITE, 'test') }),
        new ObjectType({ elemID: new ElemID(NETSUITE, 'test') }), [])
    })
  })

  describe('remove', () => { // todo: implement tests once implemented
    it('dummy test for coverage', async () => {
      await netsuiteAdapter.remove(new ObjectType({ elemID: new ElemID(NETSUITE, 'test') }))
    })
  })
})
