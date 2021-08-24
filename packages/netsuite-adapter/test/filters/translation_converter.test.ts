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
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import { ATTRIBUTE_PREFIX } from '../../src/client/constants'
import { translationcollection } from '../../src/autogen/types/custom_types/translationcollection'
import filterCreator from '../../src/filters/translation_converter'


describe('translation_converter filter', () => {
  describe('onFetch', () => {
    it('should add nameTranslate to type', async () => {
      await filterCreator().onFetch([])
      expect(translationcollection.fields.nameTranslate).toBeDefined()
    })

    it('should split name if it is an object', async () => {
      const instance = new InstanceElement('instance', translationcollection, {
        name: {
          '#text': 'name',
          translate: 'T',
        },
      })
      await filterCreator().onFetch([instance])
      expect(instance.value).toEqual({ name: 'name', nameTranslate: true })
    })

    it('should do nothing if name is a string', async () => {
      const instance = new InstanceElement('instance', translationcollection, {
        name: 'name',
      })
      await filterCreator().onFetch([instance])
      expect(instance.value).toEqual({ name: 'name' })
    })
  })

  describe('preDeploy', () => {
    it('should combine name and translate', async () => {
      const instance = new InstanceElement('instance', translationcollection, {
        name: 'name',
        nameTranslate: true,
      })
      await filterCreator().preDeploy([toChange({ after: instance })])
      expect(instance.value).toEqual({ name: {
        '#text': 'name',
        [`${ATTRIBUTE_PREFIX}translate`]: 'T',
      } })
    })

    it('should do nothing if nameTranslate is undefined', async () => {
      const instance = new InstanceElement('instance', translationcollection, {
        name: 'name',
      })
      await filterCreator().preDeploy([toChange({ after: instance })])
      expect(instance.value).toEqual({ name: 'name' })
    })
  })
})
