/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ElemID, TemplateExpression, Values, Element } from '@salto-io/adapter-api'
import { createReference } from '../../utils'
import { JIRA, PROJECT_TYPE } from '../../../src/constants'
import { FIELD_TYPE_NAME } from '../../../src/filters/fields/constants'

export const createFilterValues = (name: string, allElements: Element[]): Values => ({
  name,
  jql: new TemplateExpression({
    parts: [
      createReference(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Project__project'), allElements),
      ' = ',
      createReference(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'Test_Project@s'), allElements, ['key']),
      ' ORDER BY ',
      createReference(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Rank__gh_lexo_rank__c@uubbuu'), allElements, [
        'name',
      ]),
      ' ASC',
    ],
  }),
  // TODO: add this when deploying sharePermission in DC will be supported
  // sharePermissions: [
  //   { type: 'project',
  //     project: {
  //       id: createReference(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'Test_Project@s'), allElements),
  //     } },
  //   // project should be before group- that is the fetch order
  //   { type: 'group',
  //     group: {
  //       name: createReference(new ElemID(JIRA, GROUP_TYPE_NAME, 'instance', 'site_admins@b'), allElements, ['name']),
  //     } },
  // ],
})
