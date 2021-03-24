/*
*                      Copyright 2021 Salto Labs Ltd.
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
import * as path from 'path'
import { EditorWorkspace } from '../src/workspace'
import { getQueryLocations, getQueryLocationsFuzzy, completeSaltoLocation } from '../src/location'
import { mockWorkspace } from './workspace'

describe('workspace query locations', () => {
  let workspace: EditorWorkspace
  const baseDir = path.resolve(`${__dirname}/../../test/test-nacls/`)
  const naclFileName = path.join(baseDir, 'all.nacl')

  beforeAll(async () => {
    workspace = new EditorWorkspace(baseDir, await mockWorkspace([naclFileName]))
  })
  describe('sensitive', () => {
    it('should find prefixes', async () => {
      const res = await getQueryLocations(workspace, 'vs.per')
      expect(res).toHaveLength(10)
      expect(res[0].fullname).toBe('vs.person')
    })
    it('should find suffixes', async () => {
      const res = await getQueryLocations(workspace, 's.person')
      expect(res).toHaveLength(1)
      expect(res[0].fullname).toBe('vs.person')
    })
    it('should find fragments in last name part', async () => {
      const res = await getQueryLocations(workspace, 'erso')
      expect(res).toHaveLength(1)
      expect(res[0].fullname).toBe('vs.person')
    })
    it('should return empty results on not found', async () => {
      const res = await getQueryLocations(workspace, 'nope')
      expect(res).toHaveLength(0)
    })
    it('should find field elements', async () => {
      const res = await getQueryLocationsFuzzy(workspace, 'person')
      expect(res.find(e => e.item.fullname === 'vs.person.field.age')).toBeDefined()
    })
  })
  describe('insensitive', () => {
    it('should find prefixes', async () => {
      const res = await getQueryLocations(workspace, 'vs.peR', false)
      expect(res).toHaveLength(10)
      expect(res[0].fullname).toBe('vs.person')
    })
    it('should find suffixes', async () => {
      const res = await getQueryLocations(workspace, 's.PerSon', false)
      expect(res).toHaveLength(1)
      expect(res[0].fullname).toBe('vs.person')
    })
    it('should find fragments in last name part', async () => {
      const res = await getQueryLocations(workspace, 'eRSo', false)
      expect(res).toHaveLength(1)
      expect(res[0].fullname).toBe('vs.person')
    })
    it('should return empty results on not found', async () => {
      const res = await getQueryLocations(workspace, 'NOPe', false)
      expect(res).toHaveLength(0)
    })
    it('should find field elements', async () => {
      const res = await getQueryLocationsFuzzy(workspace, 'pErSon')
      expect(res.find(e => e.item.fullname === 'vs.person.field.age')).toBeDefined()
    })
  })
  describe('fuzzy', () => {
    it('should find elements', async () => {
      const res = await getQueryLocationsFuzzy(workspace, 'perbon')
      expect(res).toHaveLength(10)
      expect(res[0].item.fullname).toBe('vs.person')
      expect(res[0].matches?.[0].indices).toHaveLength(2)
      expect(res[0].matches?.[0].indices[0]).toEqual([3, 5])
      expect(res[0].matches?.[0].indices[1]).toEqual([7, 8])
    })
    it('should find field elements', async () => {
      const res = await getQueryLocationsFuzzy(workspace, 'perbon')
      expect(res.find(e => e.item.fullname === 'vs.person.field.age')).toBeDefined()
    })
    it('should return empty results on not found', async () => {
      const res = await getQueryLocations(workspace, 'blablablabla')
      expect(res).toHaveLength(0)
    })
  })

  describe('complete file location', () => {
    it('should return all of the fullname locations in the file', async () => {
      const fileLocation = {
        fullname: 'vs.person',
        filename: naclFileName,
      }
      const res = await completeSaltoLocation(workspace, fileLocation)
      expect(res).toHaveLength(2)
    })

    it('should return an empty array if the fullname is not in the file', async () => {
      const fileLocation = {
        fullname: 'vs.drManhaten',
        filename: naclFileName,
      }
      const res = await completeSaltoLocation(workspace, fileLocation)
      expect(res).toHaveLength(0)
    })
  })
})
