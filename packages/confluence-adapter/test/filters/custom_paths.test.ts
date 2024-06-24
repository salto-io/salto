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
import {
  ObjectType,
  ElemID,
  Element,
  InstanceElement,
  ReferenceExpression,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { elements as elementUtils, filterUtils } from '@salto-io/adapter-components'
import filterCreator from '../../src/filters/custom_paths'
import { ADAPTER_NAME, SPACE_TYPE_NAME, PAGE_TYPE_NAME } from '../../src/constants'

describe('query filter', () => {
  let elements: Element[]
  let filter: filterUtils.FilterWith<'onFetch'>

  const generateElements = (): Element[] => {
    const spaceObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, SPACE_TYPE_NAME) })
    const pageObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, PAGE_TYPE_NAME) })
    const spaceInst = new InstanceElement('space1', spaceObjectType, { key: 'mockKey_space1' }, [
      ADAPTER_NAME,
      elementUtils.RECORDS_PATH,
      SPACE_TYPE_NAME,
      'space1',
      'space1',
    ])
    const page2UnderSpace1Inst = new InstanceElement(
      'page2UnderSpace1',
      pageObjectType,
      {
        title: 'Page2 under space1',
        spaceId: new ReferenceExpression(spaceInst.elemID, spaceInst),
      },
      [ADAPTER_NAME, elementUtils.RECORDS_PATH, PAGE_TYPE_NAME, 'page2'],
    )
    const page3UnderPage2 = new InstanceElement(
      'page3UnderPage2',
      pageObjectType,
      {
        title: 'Page3 under page2',
        spaceId: new ReferenceExpression(spaceInst.elemID, spaceInst),
        parentId: new ReferenceExpression(page2UnderSpace1Inst.elemID, page2UnderSpace1Inst),
      },
      [ADAPTER_NAME, elementUtils.RECORDS_PATH, PAGE_TYPE_NAME, 'page3'],
    )

    return [spaceObjectType, pageObjectType, spaceInst, page2UnderSpace1Inst, page3UnderPage2]
  }

  describe('onFetch', () => {
    beforeEach(() => {
      elements = generateElements()
      filter = filterCreator({}) as filterUtils.FilterWith<'onFetch'>
    })
    it('should update paths based on mappers', async () => {
      await filter.onFetch(elements)
      expect(
        Object.fromEntries(elements.filter(isInstanceElement).map(inst => [inst.elemID.getFullName(), inst.path])),
      ).toEqual({
        'confluence.space.instance.space1': [
          ADAPTER_NAME,
          elementUtils.RECORDS_PATH,
          SPACE_TYPE_NAME,
          'space1',
          'space1',
        ],
        'confluence.page.instance.page2UnderSpace1': [
          ADAPTER_NAME,
          elementUtils.RECORDS_PATH,
          SPACE_TYPE_NAME,
          'space1',
          'pages',
          'page2',
          'page2',
        ],
        'confluence.page.instance.page3UnderPage2': [
          ADAPTER_NAME,
          elementUtils.RECORDS_PATH,
          SPACE_TYPE_NAME,
          'space1',
          'pages',
          'page2',
          'page3',
          'page3',
        ],
      })
    })
    it('should not update page path if nested under space and there is no referenced space', async () => {
      const page2 = elements.filter(isInstanceElement).find(e => e.elemID.name === 'page2UnderSpace1')
      if (page2 !== undefined) {
        page2.value.spaceId = 'something else'
      }
      await filter.onFetch(elements)
      expect(elements.find(e => e.elemID.name === 'page2UnderSpace1')?.path).toEqual([
        ADAPTER_NAME,
        elementUtils.RECORDS_PATH,
        PAGE_TYPE_NAME,
        'page2',
      ])
    })
    it('should not update page path if there is no existing path', async () => {
      const page3 = elements.find(e => e.elemID.name === 'page3UnderPage2')
      if (page3 !== undefined) {
        page3.path = undefined
      }
      await filter.onFetch(elements)
      expect(elements.find(e => e.elemID.name === 'page3UnderPage2')?.path).not.toBeDefined()
    })
  })
})
