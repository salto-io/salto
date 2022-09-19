/*
*                      Copyright 2022 Salto Labs Ltd.
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
import path from 'path'
import { Element, isInstanceElement, InstanceElement } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { loadElementsFromFolder } from '../../src/sfdx_parser/sfdx_parser'
import { LAYOUT_TYPE_ID_METADATA_TYPE } from '../../src/constants'
import { apiName } from '../../src/transformers/transformer'
import { mockTypes } from '../mock_elements'

describe('loadElementsFromFolder', () => {
  let elements: Element[]
  beforeAll(async () => {
    const elementSource = buildElementsSourceFromElements(Object.values(mockTypes))
    elements = await loadElementsFromFolder(
      path.join(__dirname, 'test_sfdx_project'),
      elementSource,
    )
  })
  describe('layout elements', () => {
    let layout: InstanceElement
    beforeAll(() => {
      [layout] = elements
        .filter(isInstanceElement)
        .filter(inst => inst.elemID.typeName === LAYOUT_TYPE_ID_METADATA_TYPE)
    })
    it('should load layout type elements', () => {
      expect(layout).toBeDefined()
    })
    it('should use file name as api name', async () => {
      expect(await apiName(layout)).toEqual('Test__c-Test Layout')
    })
  })
})
