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
  BuiltinTypes,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  TemplateExpression,
  toChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { createEmptyType, getFilterParams } from '../../utils'
import jqlReferencesFilter from '../../../src/filters/jql/jql_references'
import { Filter } from '../../../src/filter'
import { JIRA, STATUS_TYPE_NAME, AUTOMATION_TYPE } from '../../../src/constants'
import { FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'

describe('jqlReferencesFilter', () => {
  let filter: Filter
  let type: ObjectType
  let instance: InstanceElement
  let fieldInstance: InstanceElement
  let doneInstance: InstanceElement
  let todoInstance: InstanceElement
  let automationInstance: InstanceElement
  let slaInstance: InstanceElement
  let config: JiraConfig

  beforeEach(async () => {
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))

    filter = jqlReferencesFilter(getFilterParams({ config }))

    type = new ObjectType({
      elemID: new ElemID(JIRA, 'Filter'),
      fields: {
        jql: {
          refType: BuiltinTypes.STRING,
        },
      },
    })

    instance = new InstanceElement('instance', type, {
      jql: 'status = Done',
    })

    fieldInstance = new InstanceElement('field', new ObjectType({ elemID: new ElemID(JIRA, FIELD_TYPE_NAME) }), {
      id: 'status',
      name: 'Status',
    })

    doneInstance = new InstanceElement('done', new ObjectType({ elemID: new ElemID(JIRA, STATUS_TYPE_NAME) }), {
      id: '1',
      name: 'Done',
    })
    todoInstance = new InstanceElement('todo', new ObjectType({ elemID: new ElemID(JIRA, STATUS_TYPE_NAME) }), {
      id: '2',
      name: 'To Do',
    })

    automationInstance = new InstanceElement(
      'automation',
      new ObjectType({ elemID: new ElemID(JIRA, AUTOMATION_TYPE) }),
      {
        conditions: [
          {
            type: 'jira.jql.condition',
            rawValue: 'status = Done',
            children: [
              {
                type: 'jira.lookup.issues',
                value: {
                  name: {
                    type: 'FREE',
                    value: 'lookupIssues',
                  },
                  type: 'JQL',
                  query: {
                    type: 'SMART',
                    value: 'status IN (Done, "To Do")',
                  },
                },
              },
            ],
          },
        ],
      },
    )
    slaInstance = new InstanceElement('sla1', createEmptyType('SLA'), {
      config: {
        goals: [
          {
            jqlQuery: 'status = Done',
          },
        ],
      },
    })
  })

  describe('onFetch', () => {
    it('should add the jql dependencies', async () => {
      await filter.onFetch?.([instance, fieldInstance, doneInstance, todoInstance, automationInstance, slaInstance])

      expect(instance.value.jql).toBeInstanceOf(TemplateExpression)
      expect(instance.value.jql.parts).toEqual([
        new ReferenceExpression(fieldInstance.elemID, fieldInstance),
        ' = ',
        new ReferenceExpression(doneInstance.elemID.createNestedID('name'), 'Done'),
      ])

      expect(automationInstance.value.conditions[0].rawValue).toBeInstanceOf(TemplateExpression)
      expect(automationInstance.value.conditions[0].rawValue.parts).toEqual([
        new ReferenceExpression(fieldInstance.elemID, fieldInstance),
        ' = ',
        new ReferenceExpression(doneInstance.elemID.createNestedID('name'), 'Done'),
      ])

      expect(automationInstance.value.conditions[0].children[0].value.query.value).toBeInstanceOf(TemplateExpression)
      expect(automationInstance.value.conditions[0].children[0].value.query.value.parts).toEqual([
        new ReferenceExpression(fieldInstance.elemID, fieldInstance),
        ' IN (',
        new ReferenceExpression(doneInstance.elemID.createNestedID('name'), 'Done'),
        ', "',
        new ReferenceExpression(todoInstance.elemID.createNestedID('name'), 'To Do'),
        '")',
      ])
      expect(slaInstance.value.config.goals[0].jqlQuery.parts).toEqual([
        new ReferenceExpression(fieldInstance.elemID, fieldInstance),
        ' = ',
        new ReferenceExpression(doneInstance.elemID.createNestedID('name'), 'Done'),
      ])
    })

    it('should work with empty jql', async () => {
      instance.value.jql = ''

      await filter.onFetch?.([instance, fieldInstance, doneInstance, todoInstance])
      expect(instance.value.jql).toBe('')
    })

    it('should do nothing if failed to parse jql', async () => {
      instance.value.jql = 'asd { [ < ('
      await filter.onFetch?.([instance, fieldInstance, doneInstance, todoInstance])
      expect(instance.value.jql).toBe('asd { [ < (')
    })

    it('should do nothing if was disabled in the config', async () => {
      config.fetch.parseTemplateExpressions = false
      await filter.onFetch?.([instance, fieldInstance, doneInstance, todoInstance])
      expect(instance.value.jql).toBe('status = Done')
    })
  })

  describe('pre/onDeploy', () => {
    it('should resolve the template expression before deploy and restore it after', async () => {
      const templateExpression = new TemplateExpression({
        parts: [
          new ReferenceExpression(fieldInstance.elemID, fieldInstance),
          ' = ',
          new ReferenceExpression(doneInstance.elemID.createNestedID('name'), 'Done'),
        ],
      })
      instance.value.jql = templateExpression

      await filter.preDeploy?.([toChange({ after: instance })])
      expect(instance.value.jql).toBe('status = Done')

      await filter.onDeploy?.([toChange({ after: instance })])
      expect(instance.value.jql).toBe(templateExpression)
    })

    it('should resolve correctly string values', async () => {
      await filter.preDeploy?.([toChange({ after: instance })])
      expect(instance.value.jql).toBe('status = Done')

      await filter.onDeploy?.([toChange({ after: instance })])
      expect(instance.value.jql).toBe('status = Done')
    })
  })
})
