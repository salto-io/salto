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
import _ from 'lodash'
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, TemplateExpression, isInstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { getFilterParams } from '../utils'
import oktaExpressionLanguageFilter from '../../src/filters/expression_language'
import { GROUP_RULE_TYPE_NAME, GROUP_TYPE_NAME, OKTA, POLICY_RULE_TYPE_NAME, USER_SCHEMA_TYPE_NAME } from '../../src/constants'


describe('expression language filter', () => {
      type FilterType = filterUtils.FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
      let filter: FilterType
      const userSchemaType = new ObjectType({ elemID: new ElemID(OKTA, USER_SCHEMA_TYPE_NAME) })
      const groupType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_TYPE_NAME) })
      const groupRuleType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_RULE_TYPE_NAME) })
      const policyRuleType = new ObjectType({ elemID: new ElemID(OKTA, POLICY_RULE_TYPE_NAME) })
      const customPath = ['definitions', 'custom', 'properties', 'additionalProperties', 'saltoDepartment']
      const basePath = ['definitions', 'base', 'properties', 'department']
      const groupRuleWithTemplate = new InstanceElement(
        'groupRuleTest',
        groupRuleType,
        {
          conditions: {
            expression: {
              value: '(String.stringContains(user.department, "salto") OR isMemberOfGroupNameRegex("/.*admin.*")) AND isMemberOfAnyGroup("123") AND !isMemberOfAnyGroup("234", \'345\')',
            },
          },
        }
      )
      const groupInstances = [
        new InstanceElement('group1', groupType, { id: 123 },),
        new InstanceElement('group2', groupType, { id: 234 },),
        new InstanceElement('group3', groupType, { id: 345 },),
      ]
      const userSchemaInstance = new InstanceElement(
        'user',
        userSchemaType,
        {
          name: 'user',
          definitions: {
            custom: {
              properties: {
                additionalProperties: {
                  saltoDepartment: {
                    title: 'salto',
                    type: 'string',
                  },
                },
              },
            },
            base: {
              properties: {
                department: {
                  title: 'Department',
                  type: 'string',
                },
              },
            },
          },
        }
      )
      const policyRuleInstance = new InstanceElement(
        'policyRuleTest',
        policyRuleType,
        {
          name: 'policy',
          conditions: {
            additionalProperties: {
              elCondition: {
                condition: 'user.profile.saltoDepartment == \'salto\' AND user.isMemberOf({\'group.id\':{"345", \'123\'}})',
              },
            },
          },
        }
      )

      beforeEach(() => {
        filter = oktaExpressionLanguageFilter(getFilterParams()) as typeof filter
      })

      describe('onFetch', () => {
        let elements: (InstanceElement | ObjectType)[]

        it('should resolve templates in instances', async () => {
          elements = [userSchemaType, groupType, groupRuleType, policyRuleInstance, policyRuleType,
            groupRuleWithTemplate, ...groupInstances, userSchemaInstance]
          await filter.onFetch(elements)
          const groupRule = elements.filter(isInstanceElement).find(i => i.elemID.name === 'groupRuleTest')
          expect(groupRule).toBeDefined()
          expect(groupRule?.value?.conditions?.expression?.value).toEqual(new TemplateExpression({
            parts: [
              '(String.stringContains(',
              new ReferenceExpression(
                userSchemaInstance.elemID.createNestedID(...basePath),
                _.get(userSchemaInstance.value, customPath)
              ),
              ', "salto") OR isMemberOfGroupNameRegex("/.*admin.*")) AND isMemberOfAnyGroup(',
              ') AND !isMemberOfAnyGroup(',
              new ReferenceExpression(groupInstances[0].elemID, groupInstances[0]),
              new ReferenceExpression(groupInstances[1].elemID, groupInstances[1]),
              ')',
            ],
          }))
          const policyRule = elements.filter(isInstanceElement).find(i => i.elemID.name === 'policyRuleTest')
          expect(policyRule).toBeDefined()
          expect(policyRule?.value?.conditions?.additionalProperties?.elCondition?.condition)
            .toEqual(new TemplateExpression({
              parts: [
                new ReferenceExpression(
                  userSchemaInstance.elemID.createNestedID(...customPath),
                  _.get(userSchemaInstance.value, basePath)
                ),
                ' == "salto" AND user.isMemberOf({',
                '"group.id": {"',
                new ReferenceExpression(groupInstances[2].elemID, groupInstances[2]),
                new ReferenceExpression(groupInstances[0].elemID, groupInstances[0]),
                '})',
              ],
            }))
        })

        it('should not create references if there is no match', async () => {
          const groupRuleWithMissingId = new InstanceElement(
            'groupRuleWithMissingId',
            groupRuleType,
            {
              conditions: {
                expression: {
                  value: 'isMemberOfAnyGroup("123", "555")',
                },
              },
            }
          )
          elements = [groupRuleType, groupType, groupRuleWithMissingId, ...groupInstances]
          await filter.onFetch(elements)
          const groupRule = elements.filter(isInstanceElement).find(i => i.elemID.name === 'groupRuleWithMissingId')
          expect(groupRule).toBeDefined()
          expect(groupRule?.value?.conditions?.expression?.value).toEqual(
            new TemplateExpression({
              parts: [
                'isMemberOfAnyGroup',
                '("',
                new ReferenceExpression(groupInstances[0].elemID, groupInstances),
                ', "555")',
              ],
            })
          )
        })

        // it('should not create template expression if expression path does not exist', () => {

        // })
      })
})
