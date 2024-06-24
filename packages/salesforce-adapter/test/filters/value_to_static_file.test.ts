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
  Element,
  ElemID,
  ObjectType,
  InstanceElement,
  isInstanceElement,
  BuiltinTypes,
  StaticFile,
  FieldDefinition,
} from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/value_to_static_file'
import {
  SALESFORCE,
  WEBLINK_METADATA_TYPE,
  METADATA_TYPE,
} from '../../src/constants'
import { defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'

const LINK_TYPE_FIELD = 'linkType'
const JAVASCRIPT = 'javascript'
const URL = 'url'
const NOT_URL = 'notUrlField'

describe('value to static file filter', () => {
  let elements: Element[]
  let regularUrl: string
  let codeAsString: string
  let codeAsFile: StaticFile
  let anotherFieldContent: string
  let fields: Record<string, FieldDefinition>

  beforeAll(() => {
    anotherFieldContent = 'anotherFieldContent'
    regularUrl = 'www.myAwesomeWebsite.com'
    codeAsString = 'console.log()'

    const webLinkID = new ElemID(SALESFORCE, WEBLINK_METADATA_TYPE)
    const anotherID = new ElemID(SALESFORCE, 'another')
    fields = {
      [URL]: { refType: BuiltinTypes.STRING },
      [LINK_TYPE_FIELD]: { refType: BuiltinTypes.STRING },
      [NOT_URL]: { refType: BuiltinTypes.STRING },
    }

    const webLinkType = new ObjectType({
      annotations: { [METADATA_TYPE]: WEBLINK_METADATA_TYPE },
      elemID: webLinkID,
      fields,
      path: ['Objects', 'dir'],
    })

    const anotherType = new ObjectType({
      annotations: { [METADATA_TYPE]: 'another' },
      elemID: anotherID,
      fields,
      path: ['Objects', 'dir2'],
    })

    const webLinkInstanceNotCode = new InstanceElement(
      'webLinkInstanceNotCode',
      webLinkType,
      {
        [URL]: codeAsString,
        [LINK_TYPE_FIELD]: URL,
        [NOT_URL]: anotherFieldContent,
      },
      ['Objects', 'dir'],
    )

    const webLinkInstanceCode = new InstanceElement(
      'webLinkInstanceCode',
      webLinkType,
      {
        [URL]: codeAsString,
        [LINK_TYPE_FIELD]: JAVASCRIPT,
        [NOT_URL]: anotherFieldContent,
      },
      ['Objects', 'dir'],
    )

    const webLinkInstanceNoPath = new InstanceElement(
      'weblinkUndefinedPathInstance',
      webLinkType,
      {
        [URL]: codeAsString,
        [LINK_TYPE_FIELD]: JAVASCRIPT,
        [NOT_URL]: anotherFieldContent,
      },
    )
    const anotherInstance = new InstanceElement(
      'anotherInstance',
      anotherType,
      {
        [URL]: regularUrl,
        [NOT_URL]: anotherFieldContent,
      },
      ['Objects', 'dir2'],
    )

    elements = [
      webLinkInstanceNotCode,
      webLinkInstanceCode,
      anotherInstance,
      webLinkInstanceNoPath,
      webLinkType,
      anotherType,
    ]

    codeAsFile = new StaticFile({
      filepath: `${(webLinkInstanceCode.path ?? []).join('/')}.js`,
      content: Buffer.from(webLinkInstanceCode.value.url),
      encoding: 'utf-8',
    })
  })

  describe('onFetch', () => {
    type FilterType = FilterWith<'onFetch'>
    let filter: FilterType

    beforeAll(() => {
      filter = filterCreator({ config: defaultFilterContext }) as FilterType
    })

    describe('extract code to static file', () => {
      beforeAll(async () => {
        await filter.onFetch(elements)
      })
      it('should not extract from non-weblink instances', () => {
        const anotherInstanceAfterFilter = elements
          .filter(isInstanceElement)
          .find((e) => e.elemID.name === 'anotherInstance')
        expect(anotherInstanceAfterFilter?.value[URL]).toBe(regularUrl)
        expect(anotherInstanceAfterFilter?.value[NOT_URL]).toBe(
          anotherFieldContent,
        )
      })

      it('should only extract from weblink instances with linkType=javascript field', () => {
        const weblinkInstanceAfterFilterWithCode = elements
          .filter(isInstanceElement)
          .find((e) => e.elemID.name === 'webLinkInstanceCode')
        expect(weblinkInstanceAfterFilterWithCode?.value[URL]).not.toBe(
          codeAsString,
        )
        expect(weblinkInstanceAfterFilterWithCode?.value[URL]).toEqual(
          codeAsFile,
        )
        expect(weblinkInstanceAfterFilterWithCode?.value[NOT_URL]).toBe(
          anotherFieldContent,
        )

        const weblinkInstanceAfterFilterWithoutCode = elements
          .filter(isInstanceElement)
          .find((e) => e.elemID.name === 'webLinkInstanceNotCode')
        expect(weblinkInstanceAfterFilterWithoutCode?.value[URL]).toBe(
          codeAsString,
        )
        expect(weblinkInstanceAfterFilterWithoutCode?.value[NOT_URL]).toBe(
          anotherFieldContent,
        )
      })
    })
    describe('do not replace value for undefined path', () => {
      let instanceUndefinedPath: InstanceElement | undefined
      beforeAll(async () => {
        instanceUndefinedPath = elements
          ?.filter(isInstanceElement)
          .find((e) => e.path === undefined)
        if (instanceUndefinedPath !== undefined) {
          instanceUndefinedPath.path = undefined
        }
        await filter.onFetch(elements)
      })

      it('do not replace value for undefined path', () => {
        instanceUndefinedPath = elements
          ?.filter(isInstanceElement)
          .find((e) => e.path === undefined)
        expect(instanceUndefinedPath?.value[URL]).toBe(codeAsString)
        expect(instanceUndefinedPath?.value[NOT_URL]).toBe(anotherFieldContent)
      })
    })
  })
})
