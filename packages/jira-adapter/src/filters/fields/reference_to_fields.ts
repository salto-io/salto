/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, ReferenceExpression, TemplateExpression, Value } from '@salto-io/adapter-api'
import { references as referenceUtils } from '@salto-io/adapter-components'
import { extractTemplate } from '@salto-io/adapter-utils'
import { referenceFunc } from '../script_runner/walk_on_scripts'
import { JIRA } from '../../constants'
import { FIELD_TYPE_NAME } from './constants'

const CUSTOM_FIELD_PATTERN = /(customfield_\d+)/

const referenceCustomFields = ({
  text,
  fieldInstancesById,
  enableMissingReferences,
}: {
  text: string
  fieldInstancesById: Map<string, InstanceElement>
  enableMissingReferences: boolean
}): TemplateExpression | string =>
  extractTemplate(text, [CUSTOM_FIELD_PATTERN], expression => {
    if (!expression.match(CUSTOM_FIELD_PATTERN)) {
      return expression
    }
    const instance = fieldInstancesById.get(expression)
    if (instance !== undefined) {
      return new ReferenceExpression(instance.elemID, instance)
    }
    return enableMissingReferences
      ? referenceUtils.createMissingValueReference(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance'), expression)
      : expression
  })

export const addFieldsTemplateReferences =
  (fieldInstancesById: Map<string, InstanceElement>, enableMissingReferences: boolean): referenceFunc =>
  (value: Value, fieldName: string): void => {
    if (typeof value[fieldName] === 'string') {
      value[fieldName] = referenceCustomFields({ text: value[fieldName], fieldInstancesById, enableMissingReferences })
    }
  }
