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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { FIELD_CONFIGURATION_ITEM_TYPE_NAME, FIELD_CONFIGURATION_TYPE_NAME, JIRA, PROJECT_TYPE } from '../../../src/constants'
import fieldConfigurationDependenciesFilter from '../../../src/filters/field_configuration/field_configuration_dependencies'
import { getFilterParams } from '../../utils'
import { FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'

describe('fieldConfigurationItemsFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let projectType: ObjectType
  let projectInstance: InstanceElement

  let fieldConfigurationType: ObjectType
  let fieldConfigurationInstance: InstanceElement


  let fieldConfigurationItemType: ObjectType
  let fieldConfigurationItems: InstanceElement[]

  let fieldType: ObjectType
  let fieldInstance: InstanceElement

  beforeEach(async () => {
    filter = fieldConfigurationDependenciesFilter(getFilterParams()) as typeof filter

    projectType = new ObjectType({
      elemID: new ElemID(JIRA, PROJECT_TYPE),
    })

    fieldType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_TYPE_NAME),
    })

    fieldInstance = new InstanceElement(
      'field1',
      fieldType,
    )


    fieldConfigurationType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONFIGURATION_TYPE_NAME),
    })

    fieldConfigurationInstance = new InstanceElement(
      'parent',
      fieldConfigurationType,
    )

    fieldConfigurationItemType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONFIGURATION_ITEM_TYPE_NAME),
    })

    fieldConfigurationItems = [
      new InstanceElement(
        'fieldConfigurationItem1',
        fieldConfigurationItemType,
        {
          id: new ReferenceExpression(
            fieldInstance.elemID,
            fieldInstance,
          ),
        },
        [],
        {
          [CORE_ANNOTATIONS.PARENT]: [
            new ReferenceExpression(fieldConfigurationInstance.elemID, fieldConfigurationInstance),
          ],
        }
      ),
      new InstanceElement(
        'fieldConfigurationItem2',
        fieldConfigurationItemType,
        {
          id: new ReferenceExpression(
            fieldInstance.elemID,
            fieldInstance,
          ),
        },
        [],
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(new ElemID(JIRA, FIELD_CONFIGURATION_TYPE_NAME, 'instance', 'parent2'))],
        }
      ),

      new InstanceElement(
        'fieldConfigurationItem3',
        fieldConfigurationItemType,
        {
          id: new ReferenceExpression(
            new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'otherField'),
          ),
        },
        [],
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(new ElemID(JIRA, FIELD_CONFIGURATION_TYPE_NAME, 'instance', 'parent'))],
        }
      ),
    ]

    projectInstance = new InstanceElement(
      'project',
      projectType,
      {
        fieldConfigurationScheme: new ReferenceExpression(
          new ElemID(JIRA, 'FieldConfigurationScheme', 'instance', 'fieldConfigurationScheme'),
          {
            value: {
              items: [{
                fieldConfigurationId: new ReferenceExpression(
                  fieldConfigurationInstance.elemID,
                  fieldConfigurationInstance
                ),
              }],
            },
          }
        ),

        issueTypeScreenScheme: new ReferenceExpression(
          new ElemID(JIRA, 'IssueTypeScreenScheme', 'instance', 'issueTypeScreenScheme'),
          {
            value: {
              issueTypeMappings: [{
                screenSchemeId: new ReferenceExpression(
                  new ElemID(JIRA, 'ScreenScheme', 'instance', 'screenScheme'),
                  {
                    value: {
                      screens: {
                        default: new ReferenceExpression(
                          new ElemID(JIRA, 'Screen', 'instance', 'default'),
                          {
                            value: {
                              tabs: {
                                tabName: {
                                  fields: [
                                    new ReferenceExpression(
                                      fieldInstance.elemID,
                                      fieldInstance
                                    ),
                                  ],
                                },
                              },
                            },
                          }
                        ),
                      },
                    },
                  }
                ),
              }],
            },
          }
        ),
      }
    )
  })

  describe('onFetch', () => {
    it('should add generated dependencies to project', async () => {
      await filter.onFetch([
        projectInstance,
        ...fieldConfigurationItems,
        fieldInstance,
        fieldConfigurationInstance,
      ])
      expect(projectInstance.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toHaveLength(1)

      expect(projectInstance.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES][0].reference
        .elemID).toEqual(fieldConfigurationItems[0].elemID)
    })

    it('should not add generated dependencies if there is no issueTypeScreenScheme', async () => {
      delete projectInstance.value.issueTypeScreenScheme
      await filter.onFetch([
        projectInstance,
        ...fieldConfigurationItems,
        fieldInstance,
        fieldConfigurationInstance,
      ])
      expect(projectInstance.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
    })

    it('should not add generated dependencies if there is no fieldConfigurationScheme', async () => {
      delete projectInstance.value.fieldConfigurationScheme
      await filter.onFetch([
        projectInstance,
        ...fieldConfigurationItems,
        fieldInstance,
        fieldConfigurationInstance,
      ])
      expect(projectInstance.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
    })

    it('should not add generated dependencies if there is no fieldConfigurationItems', async () => {
      await filter.onFetch([
        projectInstance,
        fieldInstance,
        fieldConfigurationInstance,
      ])
      expect(projectInstance.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
    })

    it('should not add generated dependencies if fieldConfigurationScheme is not a reference', async () => {
      projectInstance.value.fieldConfigurationScheme = '3'
      await filter.onFetch([
        projectInstance,
        fieldInstance,
        fieldConfigurationInstance,
      ])
      expect(projectInstance.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]).toBeUndefined()
    })
  })
})
