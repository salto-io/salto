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
import path from 'path'
import {
  Element,
  isInstanceElement,
  InstanceElement,
  ObjectType,
  isObjectType,
  StaticFile,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { loadElementsFromFolder } from '../../src/sfdx_parser/sfdx_parser'
import {
  LAYOUT_TYPE_ID_METADATA_TYPE,
  LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE,
} from '../../src/constants'
import { apiName } from '../../src/transformers/transformer'
import { mockTypes } from '../mock_elements'

describe('loadElementsFromFolder', () => {
  let elements: Element[]
  beforeAll(async () => {
    const elementsSource = buildElementsSourceFromElements(
      Object.values(mockTypes),
    )
    const loadElementsRes = await loadElementsFromFolder({
      baseDir: path.join(__dirname, 'test_sfdx_project'),
      elementsSource,
    })
    elements = loadElementsRes.elements
  })
  describe('layout elements', () => {
    let layout: InstanceElement
    beforeAll(() => {
      ;[layout] = elements
        .filter(isInstanceElement)
        .filter((inst) => inst.elemID.typeName === LAYOUT_TYPE_ID_METADATA_TYPE)
    })
    it('should load layout type elements', () => {
      expect(layout).toBeDefined()
    })
    it('should use file name as api name', async () => {
      expect(await apiName(layout)).toEqual('Test__c-Test Layout')
    })
  })
  describe('custom object', () => {
    let customObjectFragments: ObjectType[]
    beforeAll(() => {
      customObjectFragments = elements
        .filter(isObjectType)
        .filter((obj) => obj.elemID.typeName === 'Test__c')
    })
    it('should have fields', () => {
      const fields = customObjectFragments.flatMap((fragment) =>
        Object.keys(fragment.fields),
      )
      expect(fields).toContainEqual('Check__c')
      expect(fields).toContainEqual('One__c')
    })
  })
  describe('type with content - apex class', () => {
    let apexClass: InstanceElement
    beforeAll(() => {
      ;[apexClass] = elements
        .filter(isInstanceElement)
        .filter((inst) => inst.elemID.typeName === 'ApexClass')
    })
    it('should have content as static file', () => {
      expect(apexClass.value.content).toBeInstanceOf(StaticFile)
    })
  })
  describe('complex type - lightning component bundle', () => {
    let componentBundle: InstanceElement
    beforeAll(() => {
      ;[componentBundle] = elements
        .filter(isInstanceElement)
        .filter(
          (inst) =>
            inst.elemID.typeName === LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE,
        )
    })
    it('should have static files', () => {
      expect(componentBundle.value.lwcResources.lwcResource).toBeObject()
      Object.values<{ source: StaticFile }>(
        componentBundle.value.lwcResources.lwcResource,
      ).forEach((resource) => {
        expect(resource.source).toBeInstanceOf(StaticFile)
      })
    })
  })
})
