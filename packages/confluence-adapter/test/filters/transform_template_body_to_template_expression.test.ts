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
  InstanceElement,
  ReferenceExpression,
  TemplateExpression,
  toChange,
  Change,
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { fetch, definitions as def, filterUtils } from '@salto-io/adapter-components'
import transformTemplateBodyToTemplateExpression from '../../src/filters/transform_template_body_to_template_expression'
import { UserConfig } from '../../src/config'
import { Options } from '../../src/definitions/types'
import {
  ADAPTER_NAME,
  GLOBAL_TEMPLATE_TYPE_NAME,
  PAGE_TYPE_NAME,
  SPACE_TYPE_NAME,
  TEMPLATE_TYPE_NAME,
  TEMPLATE_TYPE_NAMES,
} from '../../src/constants'

describe('transformTemplateBodyToTemplateExpression', () => {
  const spaceObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, SPACE_TYPE_NAME) })
  const pageObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, PAGE_TYPE_NAME) })
  const templateObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, TEMPLATE_TYPE_NAME) })
  const globalTemplateObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, GLOBAL_TEMPLATE_TYPE_NAME) })
  const spaceInst = new InstanceElement('space1', spaceObjectType, { key: 'mockKey_space1' })
  const pageUnderSpace1Inst = new InstanceElement('pageUnderSpace1', pageObjectType, {
    title: 'Page under space1',
    spaceId: new ReferenceExpression(spaceInst.elemID, spaceInst),
  })
  const templateInstanceNameToBodyInTwoVersions: Record<
    string,
    { stringBody: string; templateExpressionBody: string | TemplateExpression }
  > = {
    templateWithoutReferences: {
      stringBody: '<p> boring body </p>',
      templateExpressionBody: '<p> boring body </p>',
    },
    templateWithPageReference: {
      stringBody:
        '<p> some text <ri:page ri:space-key="mockKey_space1" ri:content-title="Page under space1" ri:version-at-save="1" /></p>',
      templateExpressionBody: new TemplateExpression({
        parts: [
          '<p> some text <ri:page ri:space-key="',
          new ReferenceExpression(spaceInst.elemID, spaceInst),
          '" ri:content-title="',
          new ReferenceExpression(pageUnderSpace1Inst.elemID, pageUnderSpace1Inst),
          '" ri:version-at-save="1" /></p>',
        ],
      }),
    },
    templateWithRefToPageWhichCannotBeFound: {
      stringBody:
        '<p> some text <ri:page ri:space-key="mockKey_space1" ri:content-title="yofi tofi" ri:version-at-save="1" /></p>',
      templateExpressionBody: new TemplateExpression({
        parts: [
          '<p> some text <ri:page ri:space-key="',
          new ReferenceExpression(spaceInst.elemID, spaceInst),
          '" ri:content-title="yofi tofi" ri:version-at-save="1" /></p>',
        ],
      }),
    },
    templateWithRefToSpace: {
      stringBody: '<p> some text <ri:space ri:space-key="mockKey_space1" /> more text </p>',
      templateExpressionBody: new TemplateExpression({
        parts: [
          '<p> some text <ri:space ri:space-key="',
          new ReferenceExpression(spaceInst.elemID, spaceInst),
          '" /> more text </p>',
        ],
      }),
    },
  }

  const getTemplateBody = (templateName: string, getStingBody?: boolean): string | TemplateExpression =>
    getStingBody
      ? templateInstanceNameToBodyInTwoVersions[templateName].stringBody
      : templateInstanceNameToBodyInTwoVersions[templateName].templateExpressionBody

  const generateElements = (forFetch?: boolean): InstanceElement[] => {
    const templateWithoutReferencesInst = new InstanceElement('templateWithoutReferences', templateObjectType, {
      title: 'templateWithoutReferences',
      body: {
        storage: {
          value: getTemplateBody('templateWithoutReferences', forFetch),
        },
      },
    })
    const templateWithPageReferenceInst = new InstanceElement('templateWithPageReference', globalTemplateObjectType, {
      title: 'templateWithPageReference',
      body: {
        storage: {
          value: getTemplateBody('templateWithPageReference', forFetch),
        },
      },
    })
    const templateWithRefToPageWhichCannotBeFoundInst = new InstanceElement(
      'templateWithRefToPageWhichCannotBeFound',
      templateObjectType,
      {
        title: 'templateWithRefToPageWhichCannotBeFound',
        body: {
          storage: {
            value: getTemplateBody('templateWithRefToPageWhichCannotBeFound', forFetch),
          },
        },
      },
    )
    const templateWithRefToSpaceInst = new InstanceElement('templateWithRefToSpace', templateObjectType, {
      title: 'templateWithRefToSpace',
      body: {
        storage: {
          value: getTemplateBody('templateWithRefToSpace', forFetch),
        },
      },
    })
    return [
      spaceInst.clone(),
      pageUnderSpace1Inst.clone(),
      templateWithoutReferencesInst.clone(),
      templateWithPageReferenceInst.clone(),
      templateWithRefToPageWhichCannotBeFoundInst.clone(),
      templateWithRefToSpaceInst.clone(),
    ]
  }
  let filter: filterUtils.Filter<filterUtils.FilterResult>
  beforeEach(() => {
    filter = transformTemplateBodyToTemplateExpression({
      elementSource: buildElementsSourceFromElements([]),
      fetchQuery: fetch.query.createMockQuery(),
      config: {} as UserConfig,
      definitions: {} as def.ApiDefinitions<Options>,
      sharedContext: {},
    })
  })

  describe('on fetch', () => {
    const checkInstanceAfterFilter = (instanceName: string, elements: InstanceElement[]): void => {
      const instance = elements.find(e => e.elemID.name === instanceName)
      const value = instance?.value.body.storage.value
      expect(value).toEqual(getTemplateBody(instanceName, false))
    }
    it('should create template expression when there are references on template body', async () => {
      const elements = generateElements(true)
      const expectedLength = elements.length
      await filter.onFetch?.(elements)
      expect(elements).toHaveLength(expectedLength)
      checkInstanceAfterFilter('templateWithPageReference', elements)
      checkInstanceAfterFilter('templateWithRefToSpace', elements)
    })
    it('should handle templates without references', async () => {
      const elements = generateElements(true)
      const expectedLength = elements.length
      await filter.onFetch?.(elements)
      expect(elements).toHaveLength(expectedLength)
      checkInstanceAfterFilter('templateWithoutReferences', elements)
      checkInstanceAfterFilter('templateWithRefToPageWhichCannotBeFound', elements)
    })
  })
  describe('deploy', () => {
    const checkChangeAfterFilter = (instanceName: string, changes: Change[], isPreDeploy: boolean): void => {
      const filteredChanges = changes.filter(isAdditionOrModificationChange).filter(isInstanceChange)
      const instance = filteredChanges.find(c => c.data.after.elemID.name === instanceName)?.data.after
      const value = instance?.value.body.storage.value
      expect(value).toEqual(getTemplateBody(instanceName, isPreDeploy))
    }
    let elements: InstanceElement[]
    beforeEach(() => {
      elements = generateElements(false)
    })
    it('should work correctly on addition', async () => {
      const templateAdditionChanges = elements
        .filter(e => TEMPLATE_TYPE_NAMES.includes(e.elemID.typeName))
        .map(template => toChange({ after: template }))
      await filter.preDeploy?.(templateAdditionChanges)
      checkChangeAfterFilter('templateWithoutReferences', templateAdditionChanges, true)
      checkChangeAfterFilter('templateWithPageReference', templateAdditionChanges, true)
      checkChangeAfterFilter('templateWithRefToPageWhichCannotBeFound', templateAdditionChanges, true)
      checkChangeAfterFilter('templateWithRefToSpace', templateAdditionChanges, true)
      await filter.onDeploy?.(templateAdditionChanges)
      checkChangeAfterFilter('templateWithoutReferences', templateAdditionChanges, false)
      checkChangeAfterFilter('templateWithPageReference', templateAdditionChanges, false)
      checkChangeAfterFilter('templateWithRefToPageWhichCannotBeFound', templateAdditionChanges, false)
      checkChangeAfterFilter('templateWithRefToSpace', templateAdditionChanges, false)
    })
    it('should work correctly on modification', async () => {
      const templateAdditionChanges = elements
        .filter(e => TEMPLATE_TYPE_NAMES.includes(e.elemID.typeName))
        .map(template => toChange({ before: template, after: template }))
      await filter.preDeploy?.(templateAdditionChanges)
      checkChangeAfterFilter('templateWithoutReferences', templateAdditionChanges, true)
      checkChangeAfterFilter('templateWithPageReference', templateAdditionChanges, true)
      checkChangeAfterFilter('templateWithRefToPageWhichCannotBeFound', templateAdditionChanges, true)
      checkChangeAfterFilter('templateWithRefToSpace', templateAdditionChanges, true)
      await filter.onDeploy?.(templateAdditionChanges)
      checkChangeAfterFilter('templateWithoutReferences', templateAdditionChanges, false)
      checkChangeAfterFilter('templateWithPageReference', templateAdditionChanges, false)
      checkChangeAfterFilter('templateWithRefToPageWhichCannotBeFound', templateAdditionChanges, false)
      checkChangeAfterFilter('templateWithRefToSpace', templateAdditionChanges, false)
    })
  })
})
