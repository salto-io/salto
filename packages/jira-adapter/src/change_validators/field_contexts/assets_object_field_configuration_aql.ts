/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import { ChangeValidator, getChangeData, isAdditionOrModificationChange, isInstanceChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { getParent, hasValidParent } from '@salto-io/adapter-utils'
import JiraClient from '../../client/client'
import { FIELD_CONTEXT_TYPE_NAME } from '../../filters/fields/constants'
import { removeCustomFieldPrefix } from '../../filters/jql/template_expression_generator'

const PLACEHOLDER_PATTERN = /\$\{(.*)\}/

const isAqlHasPlaceholder = (aql: string): boolean => {
  const matches = aql.match(PLACEHOLDER_PATTERN)
  return matches !== null && matches.length > 0
}

const getFieldContextsUrl = (id: string, client: JiraClient): URL => {
  const customFieldId = removeCustomFieldPrefix(id)
  const fieldContextsUrlSuffix = `secure/admin/ConfigureCustomField!default.jspa?customFieldId=${customFieldId}`
  return new URL(fieldContextsUrlSuffix, client.baseUrl)
}

export const assetsObjectFieldConfigurationAqlValidator: (client: JiraClient) => ChangeValidator =
  client => async changes =>
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
      .filter(instance => _.isString(instance.value.assetsObjectFieldConfiguration?.issueScopeFilterQuery))
      .filter(instance => isAqlHasPlaceholder(instance.value.assetsObjectFieldConfiguration.issueScopeFilterQuery))
      .filter(hasValidParent)
      .map(instance => {
        const fieldParent = getParent(instance)
        return {
          elemID: instance.elemID.createNestedID('assetsObjectFieldConfiguration', 'issueScopeFilterQuery'),
          severity: 'Warning',
          message: 'AQL placeholders are not supported.',
          detailedMessage:
            'This AQL expression will be deployed as is. You may need to manually edit the ids later to match the target environment.',
          deployActions: {
            postAction: {
              title: 'Edit AQL placeholders manually',
              subActions: [
                fieldParent.value.id
                  ? `Go to ${getFieldContextsUrl(fieldParent.value.id, client)}`
                  : `Go to ${fieldParent.value.name} field configuration`,
                `Under the context "${instance.value.name}", click on "Edit Assets object/s field configuration"`,
                'Inside "Filter issue scope" section, fix the placeholder with the correct value',
                'Click "Save"',
              ],
            },
          },
        }
      })
