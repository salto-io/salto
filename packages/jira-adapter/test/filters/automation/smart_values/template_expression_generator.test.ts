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
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  BuiltinTypes,
  TemplateExpression,
  MapType,
} from '@salto-io/adapter-api'
import { stringToTemplate } from '../../../../src/filters/automation/smart_values/template_expression_generator'

describe('stringToTemplate', () => {
  let idToField: Record<string, InstanceElement>
  let nameToField: Record<string, InstanceElement[]>
  let systemField: InstanceElement
  let customField: InstanceElement

  beforeEach(() => {
    const fieldType = new ObjectType({
      elemID: new ElemID('jira', 'Field'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        actions: { refType: new MapType(BuiltinTypes.STRING) },
      },
    })

    systemField = new InstanceElement('system', fieldType, {
      id: 'system',
      name: 'SystemName',
    })

    customField = new InstanceElement('custom', fieldType, {
      id: 'customfield_1234',
      name: 'Custom Field',
    })

    idToField = {}
    nameToField = {}
    ;[systemField, customField].forEach(field => {
      idToField[field.value.id] = field
      nameToField[field.value.name] = [field]
    })
  })

  it('should resolve system field by id', () => {
    expect(
      stringToTemplate({
        referenceStr:
          '1-{{system}} 2-{{issue.system}} 3-{{issue.system.something}} 4-{{issue.fields.system.something}} 5-{{fields.system}} 6-{{destinationIssue.system}} 7-{{triggerIssue.system}}system',
        fieldInstancesByName: nameToField,
        fieldInstancesById: idToField,
      }),
    ).toEqual({
      template: new TemplateExpression({
        parts: [
          '1-{{',
          new ReferenceExpression(systemField.elemID, systemField),
          '}} 2-{{issue.',
          new ReferenceExpression(systemField.elemID, systemField),
          '}} 3-{{issue.',
          new ReferenceExpression(systemField.elemID, systemField),
          '.something}} 4-{{issue.fields.',
          new ReferenceExpression(systemField.elemID, systemField),
          '.something}} 5-{{fields.',
          new ReferenceExpression(systemField.elemID, systemField),
          '}} 6-{{destinationIssue.',
          new ReferenceExpression(systemField.elemID, systemField),
          '}} 7-{{triggerIssue.',
          new ReferenceExpression(systemField.elemID, systemField),
          '}}system',
        ],
      }),
      ambiguousTokens: new Set(),
    })
  })

  it('should resolve system field by name', () => {
    expect(
      stringToTemplate({
        referenceStr:
          '1-{{SystemName}} 2-{{issue.SystemName}} 3-{{issue.SystemName.something}} 4-{{issue.fields.SystemName.something}} 5-{{fields.SystemName}} 6-{{destinationIssue.SystemName}} 7-{{triggerIssue.SystemName}}SystemName',
        fieldInstancesByName: nameToField,
        fieldInstancesById: idToField,
      }),
    ).toEqual({
      template: new TemplateExpression({
        parts: [
          '1-{{',
          new ReferenceExpression(systemField.elemID.createNestedID('name'), 'SystemName'),
          '}} 2-{{issue.',
          new ReferenceExpression(systemField.elemID.createNestedID('name'), 'SystemName'),
          '}} 3-{{issue.',
          new ReferenceExpression(systemField.elemID.createNestedID('name'), 'SystemName'),
          '.something}} 4-{{issue.fields.',
          new ReferenceExpression(systemField.elemID.createNestedID('name'), 'SystemName'),
          '.something}} 5-{{fields.',
          new ReferenceExpression(systemField.elemID.createNestedID('name'), 'SystemName'),
          '}} 6-{{destinationIssue.',
          new ReferenceExpression(systemField.elemID.createNestedID('name'), 'SystemName'),
          '}} 7-{{triggerIssue.',
          new ReferenceExpression(systemField.elemID.createNestedID('name'), 'SystemName'),
          '}}SystemName',
        ],
      }),
      ambiguousTokens: new Set(),
    })
  })

  it('should resolve custom field by id', () => {
    expect(
      stringToTemplate({
        referenceStr:
          '1-{{customfield_1234}} 2-{{issue.customfield_1234}} 3-{{issue.customfield_1234.something}} 4-{{issue.fields.customfield_1234.something}} 5-{{fields.customfield_1234}} 6-{{destinationIssue.customfield_1234}} 7-{{triggerIssue.customfield_1234}}customfield_1234',
        fieldInstancesByName: nameToField,
        fieldInstancesById: idToField,
      }),
    ).toEqual({
      template: new TemplateExpression({
        parts: [
          '1-{{',
          new ReferenceExpression(customField.elemID, customField),
          '}} 2-{{issue.',
          new ReferenceExpression(customField.elemID, customField),
          '}} 3-{{issue.',
          new ReferenceExpression(customField.elemID, customField),
          '.something}} 4-{{issue.fields.',
          new ReferenceExpression(customField.elemID, customField),
          '.something}} 5-{{fields.',
          new ReferenceExpression(customField.elemID, customField),
          '}} 6-{{destinationIssue.',
          new ReferenceExpression(customField.elemID, customField),
          '}} 7-{{triggerIssue.',
          new ReferenceExpression(customField.elemID, customField),
          '}}customfield_1234',
        ],
      }),
      ambiguousTokens: new Set(),
    })
  })

  it('should resolve custom field by name', () => {
    expect(
      stringToTemplate({
        referenceStr:
          '1-{{Custom Field}} 2-{{issue.Custom Field}} 3-{{issue.Custom Field.something}} 4-{{issue.fields.Custom Field.something}} 5-{{fields.Custom Field}} 6-{{destinationIssue.Custom Field}} 7-{{triggerIssue.Custom Field}}Custom Field',
        fieldInstancesByName: nameToField,
        fieldInstancesById: idToField,
      }),
    ).toEqual({
      template: new TemplateExpression({
        parts: [
          '1-{{',
          new ReferenceExpression(customField.elemID.createNestedID('name'), 'Custom Field'),
          '}} 2-{{issue.',
          new ReferenceExpression(customField.elemID.createNestedID('name'), 'Custom Field'),
          '}} 3-{{issue.',
          new ReferenceExpression(customField.elemID.createNestedID('name'), 'Custom Field'),
          '.something}} 4-{{issue.fields.',
          new ReferenceExpression(customField.elemID.createNestedID('name'), 'Custom Field'),
          '.something}} 5-{{fields.',
          new ReferenceExpression(customField.elemID.createNestedID('name'), 'Custom Field'),
          '}} 6-{{destinationIssue.',
          new ReferenceExpression(customField.elemID.createNestedID('name'), 'Custom Field'),
          '}} 7-{{triggerIssue.',
          new ReferenceExpression(customField.elemID.createNestedID('name'), 'Custom Field'),
          '}}Custom Field',
        ],
      }),
      ambiguousTokens: new Set(),
    })
  })

  it('should ignore unknown fields', () => {
    expect(
      stringToTemplate({
        referenceStr: '1-{{unknown}} 2-{{issue.unknown}} 3-{{toString}}',
        fieldInstancesByName: nameToField,
        fieldInstancesById: idToField,
      }),
    ).toEqual({
      template: '1-{{unknown}} 2-{{issue.unknown}} 3-{{toString}}',
      ambiguousTokens: new Set(),
    })
  })

  it('should ignore invalid fields', () => {
    expect(
      stringToTemplate({
        referenceStr: '1-{{.}} 2-{{}}',
        fieldInstancesByName: nameToField,
        fieldInstancesById: idToField,
      }),
    ).toEqual({
      template: '1-{{.}} 2-{{}}',
      ambiguousTokens: new Set(),
    })
  })

  it('should return ambiguous fields', () => {
    nameToField[customField.value.name] = [customField, customField]

    expect(
      stringToTemplate({
        referenceStr: '1-{{Custom Field}}',
        fieldInstancesByName: nameToField,
        fieldInstancesById: idToField,
      }),
    ).toEqual({
      template: '1-{{Custom Field}}',
      ambiguousTokens: new Set(['Custom Field']),
    })
  })
})
