/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, Values, Element, ReferenceExpression, InstanceElement } from '@salto-io/adapter-api'
import { createReference } from '../../utils'
import { JIRA } from '../../../src/constants'
import { FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'

export const createSecuritySchemeValues = (name: string, level: InstanceElement): Values => ({
  name,
  description: name,
  defaultLevel: new ReferenceExpression(level.elemID, level),
})

export const createSecurityLevelValues = (name: string, allElements: Element[]): Values => ({
  name,
  description: name,
  members: [
    {
      holder: {
        type: 'user',
        parameter: {
          id: '61d44bf59ee70a00685fa6b6',
          displayName: 'Testing salto',
        },
      },
    },
    {
      holder: {
        type: 'projectLead',
      },
    },
    {
      holder: {
        type: 'assignee',
      },
    },
    {
      holder: {
        type: 'projectRole',
        parameter: createReference(new ElemID(JIRA, 'ProjectRole', 'instance', 'Administrators'), allElements),
      },
    },
    {
      holder: {
        type: 'groupCustomField',
        parameter: createReference(
          new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Epic_Status__gh_epic_status__c@suubbuu'),
          allElements,
        ),
      },
    },
    {
      holder: {
        type: 'group',
        parameter: createReference(new ElemID(JIRA, 'Group', 'instance', 'system_administrators@b'), allElements, [
          'name',
        ]),
      },
    },
  ],
})
