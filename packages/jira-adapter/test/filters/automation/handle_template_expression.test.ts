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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression,
  BuiltinTypes, TemplateExpression, MapType, toChange, isInstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import filterCreator from '../../../src/filters/automation/handle_template_expressions'
import { getFilterParams } from '../../utils'

describe('handle templates filter', () => {
    type FilterType = filterUtils.FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
    let filter: FilterType

    beforeAll(() => {
      filter = filterCreator(getFilterParams()) as FilterType
    })

    const automationType = new ObjectType({
      elemID: new ElemID('jira', 'Automation'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        actions: { refType: new MapType(BuiltinTypes.STRING) },
      },
    })

    const fieldType = new ObjectType({
      elemID: new ElemID('jira', 'Field'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        actions: { refType: new MapType(BuiltinTypes.STRING) },
      },
    })

    const fieldOne = new InstanceElement('field_one', fieldType, { name: 'fieldOne' })
    const duedateField = new InstanceElement('duedate', fieldType, { name: 'Due Date' })
    const fieldWithSpaces = new InstanceElement('field_with_spaces', fieldType, { name: 'Field With Spaces' })

    const automationInstance = new InstanceElement('autom', automationType,
      { components: [
        { value: {
          inner: 'Issue first field is: {{issue.fieldOne}} ending',
        } },
        { value: {
          inner: 'Issue due date is: {{issue.duedate}} ending',
        } },
        { value: {
          inner: 'Issue space field is: {{issue.Field With Spaces}} ending',
        } },
        { value: {
          inner: 'Issue no field is: {{issue.notafield}} ending',
        } },
      ] })


    const generateElements = (): (InstanceElement | ObjectType)[] => ([fieldOne, duedateField,
      fieldWithSpaces, automationInstance, fieldType,
      automationType]).map(element => element.clone())

    describe('on fetch', () => {
      let elements: (InstanceElement | ObjectType)[]
      let automation: InstanceElement

      beforeAll(async () => {
        elements = generateElements()
        await filter.onFetch(elements)
        const automationResult = elements.filter(isInstanceElement).find(i => i.elemID.name === 'autom')
        expect(automationResult).toBeDefined()
        automation = automationResult as InstanceElement
      })

      it('should resolve simple template', () => {
        expect(automation.value.components[0].value.inner).toEqual(new TemplateExpression({
          parts: [
            'Issue first field is: ',
            '{{',
            new ReferenceExpression(fieldOne.elemID, fieldOne),
            '}}',
            ' ending',
          ],
        }))
      })

      it('should resolve system field with different name', () => {
        expect(automation.value.components[1].value.inner).toEqual(new TemplateExpression({
          parts: [
            'Issue due date is: ',
            '{{',
            new ReferenceExpression(duedateField.elemID, duedateField),
            '}}',
            ' ending',
          ],
        }))
      })

      it('should resolve field with space', () => {
        expect(automation.value.components[2].value.inner).toEqual(new TemplateExpression({
          parts: [
            'Issue space field is: ',
            '{{',
            new ReferenceExpression(fieldWithSpaces.elemID, fieldWithSpaces),
            '}}',
            ' ending',
          ],
        }))
      })

      it('should ignore template referencing unhandled field', () => {
        expect(automation.value.components[3].value.inner).toEqual(
          'Issue no field is: {{issue.notafield}} ending',
        )
      })
    })
    describe('preDeploy', () => {
      let elementsBeforeFetch: (InstanceElement | ObjectType)[]
      let elementsAfterPreDeploy: (InstanceElement | ObjectType)[]

      beforeAll(async () => {
        elementsBeforeFetch = generateElements()
        const elementsAfterFetch = elementsBeforeFetch.map(e => e.clone())
        await filter.onFetch(elementsAfterFetch)
        elementsAfterPreDeploy = elementsAfterFetch.map(e => e.clone())
        await filter.preDeploy(elementsAfterPreDeploy.map(e => toChange({ before: e, after: e })))
      })

      it('Returns elements to origin after predeploy', () => {
        expect(elementsAfterPreDeploy).toEqual(elementsBeforeFetch)
      })
    })

    describe('onDeploy', () => {
      let elementsAfterFetch: (InstanceElement | ObjectType)[]
      let elementsAfterOnDeploy: (InstanceElement | ObjectType)[]

      beforeAll(async () => {
        // we recreate fetch and onDeploy to have the templates in place to be restored by onDeploy
        const elementsBeforeFetch = generateElements()
        elementsAfterFetch = elementsBeforeFetch.map(e => e.clone())
        await filter.onFetch(elementsAfterFetch)
        const elementsAfterPreDeploy = elementsAfterFetch.map(e => e.clone())
        await filter.preDeploy(elementsAfterPreDeploy.map(e => toChange({ before: e, after: e })))
        elementsAfterOnDeploy = elementsAfterPreDeploy.map(e => e.clone())
        await filter.onDeploy(elementsAfterOnDeploy.map(e => toChange({ before: e, after: e })))
      })

      it('Returns elements to after fetch state (with templates) after onDeploy', () => {
        expect(elementsAfterOnDeploy).toEqual(elementsAfterFetch)
      })
    })
})
