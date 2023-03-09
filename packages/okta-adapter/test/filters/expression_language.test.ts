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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, TemplateExpression, isInstanceElement, toChange, getChangeData } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { getFilterParams } from '../utils'
import oktaExpressionLanguageFilter from '../../src/filters/expression_language'
import { ACCESS_POLICY_RULE_TYPE_NAME, BEHAVIOR_RULE_TYPE_NAME, GROUP_RULE_TYPE_NAME, GROUP_TYPE_NAME, OKTA, USER_SCHEMA_TYPE_NAME } from '../../src/constants'

describe('expression language filter', () => {
      type FilterType = filterUtils.FilterWith<'onFetch' | 'onDeploy' | 'deploy' | 'preDeploy'>
      let filter: FilterType
      const userSchemaType = new ObjectType({ elemID: new ElemID(OKTA, USER_SCHEMA_TYPE_NAME) })
      const groupType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_TYPE_NAME) })
      const groupRuleType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_RULE_TYPE_NAME) })
      const policyRuleType = new ObjectType({ elemID: new ElemID(OKTA, ACCESS_POLICY_RULE_TYPE_NAME) })
      const behaviorType = new ObjectType({ elemID: new ElemID(OKTA, BEHAVIOR_RULE_TYPE_NAME) })
      const customPath = ['definitions', 'custom', 'properties', 'additionalProperties', 'saltoDepartment']
      const basePath = ['definitions', 'base', 'properties', 'department']
      const groupRuleWithExpression = new InstanceElement(
        'groupRuleTest',
        groupRuleType,
        {
          conditions: {
            expression: {
              value: '(String.stringContains(user.department, "salto") OR isMemberOfGroupNameRegex("/.*admin.*")) AND isMemberOfAnyGroup("123A") AND !isMemberOfAnyGroup("234B", "345C")',
            },
          },
        }
      )
      const groupInstances = [
        new InstanceElement('group1', groupType, { id: '123A' },),
        new InstanceElement('group2', groupType, { id: '234B' },),
        new InstanceElement('group3', groupType, { id: '345C' },),
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
      const behaviorInstance = new InstanceElement(
        'behaviorRule',
        behaviorType,
        {
          name: 'New IP',
          type: 'ANOMALOUS_LOCATION',
        }
      )
      const policyRuleWithExpression = new InstanceElement(
        'policyRuleTest',
        policyRuleType,
        {
          name: 'policy',
          conditions: {
            elCondition: {
              condition: 'user.profile.saltoDepartment == \'salto\' AND user.isMemberOf({\'group.id\':{"345C", \'123A\'}}) AND security.behaviors.contains("New IP")',
            },
          },
        }
      )
      const groupRuleTemplate = new TemplateExpression({
        parts: [
          '(String.stringContains(',
          new ReferenceExpression(
            userSchemaInstance.elemID.createNestedID(...basePath),
            _.get(userSchemaInstance.value, basePath)
          ),
          ', "salto") OR isMemberOfGroupNameRegex("/.*admin.*")) AND isMemberOfAnyGroup(',
          new ReferenceExpression(groupInstances[0].elemID, groupInstances[0]),
          ') AND !isMemberOfAnyGroup(',
          new ReferenceExpression(groupInstances[1].elemID, groupInstances[1]),
          ', ',
          new ReferenceExpression(groupInstances[2].elemID, groupInstances[2]),
          ')',
        ],
      })
      const policyRuleTemplate = new TemplateExpression({
        parts: [
          new ReferenceExpression(
            userSchemaInstance.elemID.createNestedID(...customPath),
            _.get(userSchemaInstance.value, customPath)
          ),
          ' == \'salto\' AND user.isMemberOf({\'group.id\':{',
          new ReferenceExpression(groupInstances[2].elemID, groupInstances[2]),
          ', ',
          new ReferenceExpression(groupInstances[0].elemID, groupInstances[0]),
          '}}) AND security.behaviors.contains(',
          new ReferenceExpression(behaviorInstance.elemID, behaviorInstance),
          ')',
        ],
      })

      beforeEach(() => {
        filter = oktaExpressionLanguageFilter(getFilterParams()) as typeof filter
      })

      describe('onFetch', () => {
        it('should resolve templates in instances', async () => {
          const elements = [userSchemaType, groupType, groupRuleType, policyRuleWithExpression, policyRuleType,
            groupRuleWithExpression, ...groupInstances, userSchemaInstance, behaviorInstance]
          await filter.onFetch(elements)
          const groupRule = elements.filter(isInstanceElement).find(i => i.elemID.name === 'groupRuleTest')
          expect(groupRule).toBeDefined()
          expect(groupRule?.value?.conditions?.expression?.value).toEqual(groupRuleTemplate)
          const policyRule = elements.filter(isInstanceElement).find(i => i.elemID.name === 'policyRuleTest')
          expect(policyRule).toBeDefined()
          expect(policyRule?.value?.conditions?.elCondition?.condition)
            .toEqual(policyRuleTemplate)
        })

        it('should not create references if there is no match', async () => {
          const groupRuleWithMissingId = new InstanceElement(
            'groupRuleWithMissingId',
            groupRuleType,
            {
              conditions: {
                expression: {
                  value: 'isMemberOfAnyGroup("123A", "555E")',
                },
              },
            }
          )
          const elements = [groupRuleType, groupType, groupRuleWithMissingId, ...groupInstances]
          await filter.onFetch(elements)
          const groupRule = elements.filter(isInstanceElement).find(i => i.elemID.name === 'groupRuleWithMissingId')
          expect(groupRule).toBeDefined()
          expect(groupRule?.value?.conditions?.expression?.value).toEqual(
            new TemplateExpression({
              parts: [
                'isMemberOfAnyGroup(',
                new ReferenceExpression(groupInstances[0].elemID, groupInstances[0]),
                ', "555E")',
              ],
            })
          )
        })

        it('should not create template expression if no references were found', async () => {
          const groupRuleNoReferences = new InstanceElement(
            'groupRuleNoReferences',
            groupRuleType,
            {
              conditions: {
                expression: {
                  value: 'isMemberOfGroupNameRegex("/.*admin.*")',
                },
              },
            }
          )
          const elements = [groupRuleType, groupType, groupRuleNoReferences]
          await filter.onFetch(elements)
          const groupRule = elements.filter(isInstanceElement).find(i => i.elemID.name === 'groupRuleNoReferences')
          expect(groupRule).toBeDefined()
          expect(groupRule?.value?.conditions?.expression?.value).toEqual('isMemberOfGroupNameRegex("/.*admin.*")')
        })

        it('should not create template expression if expression path does not exist', async () => {
          const groupRuleWithNoExpression = new InstanceElement(
            'groupRuleNoExpression',
            groupRuleType,
            {
              conditions: {
                people: { users: { exclude: ['123', '234'] } },
              },
            }
          )
          const elements = [groupRuleType, groupType, groupRuleWithNoExpression]
          await filter.onFetch(elements)
          const groupRule = elements.filter(isInstanceElement).find(i => i.elemID.name === 'groupRuleNoExpression')
          expect(groupRule).toBeDefined()
          expect(groupRule?.value).toEqual(
            {
              conditions: {
                people: { users: { exclude: ['123', '234'] } },
              },
            }
          )
        })
      })

      describe('preDeploy and onDeploy', () => {
        const groupRuleWithTemplate = new InstanceElement(
          'groupRuleTest',
          groupRuleType,
          { conditions: { expression: { value: groupRuleTemplate } } }
        )
        const policyRuleWithTemplate = new InstanceElement(
          'policyRuleTest',
          policyRuleType,
          {
            conditions: {
              elCondition: {
                condition: policyRuleTemplate,
              },
            },
          },
        )

        describe('preDeploy', () => {
          it('should replace template expressions with strings', async () => {
            const changes = [
              toChange({ after: groupRuleWithTemplate.clone() }), toChange({ after: policyRuleWithTemplate.clone() }),
            ]
            await filter.preDeploy(changes)
            const instances = changes.map(getChangeData).filter(isInstanceElement)
            const groupRuleInstance = instances.find(i => i.elemID.name === 'groupRuleTest')
            expect(groupRuleInstance).toBeDefined()
            expect(groupRuleInstance?.value?.conditions?.expression?.value)
              .toEqual('(String.stringContains(user.department, "salto") OR isMemberOfGroupNameRegex("/.*admin.*")) AND isMemberOfAnyGroup("123A") AND !isMemberOfAnyGroup("234B", "345C")')
            const policyRuleInstance = instances.find(i => i.elemID.name === 'policyRuleTest')
            expect(policyRuleInstance).toBeDefined()
            expect(policyRuleInstance?.value?.conditions?.elCondition?.condition)
              .toEqual('user.profile.saltoDepartment == \'salto\' AND user.isMemberOf({\'group.id\':{"345C", "123A"}}) AND security.behaviors.contains("New IP")')
          })
        })
        describe('onDeploy', () => {
          it('should restore template expressions using the mapping', async () => {
            const changes = [
              toChange({ after: groupRuleWithTemplate.clone() }), toChange({ after: policyRuleWithTemplate.clone() }),
            ]
            // call preDeploy to set the mapping
            await filter.preDeploy(changes)
            await filter.onDeploy(changes)
            const instances = changes.map(getChangeData).filter(isInstanceElement)
            const groupRuleInstance = instances.find(i => i.elemID.name === 'groupRuleTest')
            expect(groupRuleInstance).toBeDefined()
            expect(groupRuleInstance?.value?.conditions?.expression?.value)
              .toEqual(groupRuleTemplate)
            const policyRuleInstance = instances.find(i => i.elemID.name === 'policyRuleTest')
            expect(policyRuleInstance).toBeDefined()
            expect(policyRuleInstance?.value?.conditions?.elCondition?.condition)
              .toEqual(policyRuleTemplate)
          })
        })
      })

      describe('deploy', () => {
        const groupRuleWithTemplate = new InstanceElement(
          'groupRuleTest',
          groupRuleType,
          { conditions: { expression: { value: groupRuleTemplate } } }
        )
        const groupWithoutId = groupInstances[0].clone()
        delete groupWithoutId.value.id
        const groupRuleInvalidTemplate = new InstanceElement(
          'groupRuleTest2',
          groupRuleType,
          { conditions: { expression: {
            value: new TemplateExpression({
              parts: [
                new ReferenceExpression(groupWithoutId.elemID, groupWithoutId),
                ' == \'salto\'',
              ],
            }),
          } } }
        )
        it('should return error for changes with tmeplate expression we could not resolve', async () => {
          const changes = [
            toChange({ after: groupRuleWithTemplate.clone() }), toChange({ after: groupRuleInvalidTemplate.clone() }),
          ]
          // call preDeploy to set the mapping
          await filter.preDeploy(changes)
          const res = await filter.deploy(changes)
          expect(res.leftoverChanges.length).toEqual(1)
          expect(res.deployResult.errors.length).toEqual(1)
          expect(res.deployResult.errors[0]).toEqual(
            new Error('Error parsing Okta expression language expression for instance groupRuleTest2 of type GroupRule')
          )
        })
      })
})
