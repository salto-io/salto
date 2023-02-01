/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, TemplateExpression } from '@salto-io/adapter-api'
import { generateJqlContext, generateTemplateExpression } from '../../../src/filters/jql/template_expression_generator'
import { JIRA, STATUS_TYPE_NAME } from '../../../src/constants'
import { FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'

describe('generateTemplateExpression', () => {
  let fieldInstance: InstanceElement
  let doneInstance: InstanceElement
  let todoInstance: InstanceElement

  let instances: InstanceElement[]

  beforeEach(async () => {
    fieldInstance = new InstanceElement(
      'field',
      new ObjectType({ elemID: new ElemID(JIRA, FIELD_TYPE_NAME) }),
      {
        id: 'status',
        name: 'Status',
      }
    )

    doneInstance = new InstanceElement(
      'done',
      new ObjectType({ elemID: new ElemID(JIRA, STATUS_TYPE_NAME) }),
      {
        id: '1',
        name: 'Done',
      }
    )
    todoInstance = new InstanceElement(
      'todo',
      new ObjectType({ elemID: new ElemID(JIRA, STATUS_TYPE_NAME) }),
      {
        id: '2',
        name: 'To Do',
      }
    )

    instances = [fieldInstance, doneInstance, todoInstance]
  })

  it('should parse correctly jql with multiple values', async () => {
    const issueTypeField = new InstanceElement(
      'issuetype',
      new ObjectType({ elemID: new ElemID(JIRA, FIELD_TYPE_NAME) }),
      {
        id: 'issuetype',
        name: 'Issue Type',
      }
    )

    instances.push(issueTypeField)

    const jql = 'status IN (Done, "To Do", 1) AND otherfield = 2 AND issuetype = 3'
    const expression = generateTemplateExpression(jql, generateJqlContext(instances))
    expect(expression).toEqual({
      template: new TemplateExpression({ parts: [
        new ReferenceExpression(fieldInstance.elemID, fieldInstance),
        ' IN (',
        new ReferenceExpression(doneInstance.elemID.createNestedID('name'), doneInstance.value.name),
        ', "',
        new ReferenceExpression(todoInstance.elemID.createNestedID('name'), todoInstance.value.name),
        '", ',
        new ReferenceExpression(doneInstance.elemID, doneInstance),
        ') AND otherfield = 2 AND ',
        new ReferenceExpression(issueTypeField.elemID, issueTypeField),
        ' = 3',
      ] }),
      ambiguousTokens: new Set(),
    })
  })

  it('should parse correctly jql with orderBy', async () => {
    const jql = 'ORDER BY status ASC'
    const expression = generateTemplateExpression(jql, generateJqlContext(instances))
    expect(expression).toEqual({
      template: new TemplateExpression({ parts: [
        'ORDER BY ',
        new ReferenceExpression(fieldInstance.elemID, fieldInstance),
        ' ASC',
      ] }),
      ambiguousTokens: new Set(),
    })
  })

  it('should not parse field in jql if there are another field with the same name', async () => {
    fieldInstance.value.name = 'duplicate'


    const anotherInstance = new InstanceElement(
      'anotherField',
      new ObjectType({ elemID: new ElemID(JIRA, FIELD_TYPE_NAME) }),
      {
        id: 'id',
        name: 'duplicate',
      }
    )
    const jql = 'ORDER BY duplicate ASC'
    const expression = generateTemplateExpression(
      jql,
      generateJqlContext([anotherInstance, ...instances])
    )
    expect(expression).toEqual({
      template: undefined,
      ambiguousTokens: new Set(['duplicate']),
    })
  })

  it('should parse correctly jql with orderBy with unknown field', async () => {
    const jql = 'ORDER BY unknown ASC'
    const expression = generateTemplateExpression(jql, generateJqlContext(instances))
    expect(expression).toEqual({
      template: undefined,
      ambiguousTokens: new Set(),
    })
  })

  it('should parse correctly jql with orderBy with a JS built in name', async () => {
    const jql = 'ORDER BY __proto__ ASC'
    const expression = generateTemplateExpression(jql, generateJqlContext(instances))
    expect(expression).toEqual({
      template: undefined,
      ambiguousTokens: new Set(),
    })
  })

  it('should ignore functions', async () => {
    const jql = 'status = currentUser()'
    const expression = generateTemplateExpression(jql, generateJqlContext(instances))
    expect(expression).toEqual({
      template: new TemplateExpression({ parts: [
        new ReferenceExpression(fieldInstance.elemID, fieldInstance),
        ' = currentUser()',
      ] }),
      ambiguousTokens: new Set(),
    })
  })

  it('should parse correctly jql with customfields', async () => {
    const customField = new InstanceElement(
      'customField',
      new ObjectType({ elemID: new ElemID(JIRA, FIELD_TYPE_NAME) }),
      {
        id: 'customfield_12345',
        name: 'Custom Field',
      }
    )

    instances.push(customField)

    const jql = '"Custom Field" = 2 OR cf[12345] = 3'
    const expression = generateTemplateExpression(jql, generateJqlContext(instances))
    expect(expression).toEqual({
      template: new TemplateExpression({ parts: [
        '"',
        new ReferenceExpression(customField.elemID.createNestedID('name'), 'Custom Field'),
        '" = 2 OR cf[',
        new ReferenceExpression(customField.elemID, customField),
        '] = 3',
      ] }),
      ambiguousTokens: new Set(),
    })
  })

  it('should parse correctly jql with field with types', async () => {
    const customField = new InstanceElement(
      'customField',
      new ObjectType({ elemID: new ElemID(JIRA, FIELD_TYPE_NAME) }),
      {
        id: 'customfield_12345',
        name: 'Custom Field',
      }
    )

    instances.push(customField)

    const jql = '"Custom Field[number]" = 2'
    const expression = generateTemplateExpression(jql, generateJqlContext(instances))
    expect(expression).toEqual({
      template: new TemplateExpression({ parts: [
        '"',
        new ReferenceExpression(customField.elemID.createNestedID('name'), 'Custom Field'),
        '[number]" = 2',
      ] }),
      ambiguousTokens: new Set(),
    })
  })

  it('should not replace fields with escaping', async () => {
    const customField = new InstanceElement(
      'customField',
      new ObjectType({ elemID: new ElemID(JIRA, FIELD_TYPE_NAME) }),
      {
        id: 'customfield_12345',
        name: 'a"b',
      }
    )

    instances.push(customField)

    const jql = '"a\\"b" = 2'
    const expression = generateTemplateExpression(jql, generateJqlContext(instances))
    expect(expression).toEqual({
      template: undefined,
      ambiguousTokens: new Set(),
    })
  })
})
