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
import { DetailedChange, ElemID, Value, InstanceElement } from '@salto-io/adapter-api'
import { configSource, ConfigSource } from '../../src/workspace/config_source'
import { mockDirStore } from '../common/nacl_file_store'

describe('configSource', () => {
  let source: ConfigSource
  const createConfigOverride = (name: string, path: string[], value: Value): DetailedChange => ({
    id: new ElemID(name, ElemID.CONFIG_NAME, 'instance', ElemID.CONFIG_NAME, ...path),
    action: 'add',
    data: { after: value },
  })
  beforeEach(() => {
    const overrides: DetailedChange[] = [
      createConfigOverride('valid', ['val'], 2),
      createConfigOverride('valid', ['new'], { a: true }),
    ]
    const dirStore = mockDirStore(
      undefined,
      undefined,
      {
        'valid.nacl': `valid {
          val = 1
          other = 3
        }`,
        'empty.nacl': '',
        'noInst.nacl': `type bla {
        }`,
        'multipleInst.nacl': `first {
          val = 1
        }
        second {
          val = 2
        }`,
        'error.nacl': 'asd',
      },
    )
    source = configSource(dirStore, overrides)
  })
  describe('get', () => {
    describe('with valid config', () => {
      let inst: InstanceElement | undefined
      beforeEach(async () => {
        inst = await source.get('valid')
      })
      it('should return the config instance', () => {
        expect(inst).toBeInstanceOf(InstanceElement)
      })
      it('should have instance values when they are not overridden', () => {
        expect(inst?.value).toMatchObject({
          other: 3,
        })
      })
      it('should apply config overrides', () => {
        expect(inst?.value).toMatchObject({
          val: 2,
          new: { a: true },
        })
      })
    })
    it('should ignore overrides when requested', async () => {
      const conf = await source.get('valid', true)
      expect(conf?.value).toEqual({
        val: 1,
        other: 3,
      })
    })
    it('should return undefined when there is no file', async () => {
      expect(await source.get('noSuchFile')).toBeUndefined()
    })
    it('should return undefined for an empty file', async () => {
      expect(await source.get('empty')).toBeUndefined()
    })
    it('should return undefined for a file with no instance', async () => {
      expect(await source.get('noInst')).toBeUndefined()
    })
    it('should return the first instance if there is more than one', async () => {
      const inst = await source.get('multipleInst')
      expect(inst).toBeDefined()
      expect(inst?.elemID.adapter).toEqual('first')
    })
    it('should fail if the config file has parse errors', async () => {
      await expect(source.get('error')).rejects.toThrow()
    })
  })
})
