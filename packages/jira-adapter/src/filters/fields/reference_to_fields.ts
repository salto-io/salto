/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { InstanceElement, ReferenceExpression, TemplateExpression, Value } from '@salto-io/adapter-api'
import { extractTemplate } from '@salto-io/adapter-utils'
import { referenceFunc } from '../script_runner/walk_on_scripts'

const CUSTOM_FIELD_PATTERN = /(customfield_\d+)/

const referenceCustomFields = (
  text: string,
  fieldInstancesById: Map<string, InstanceElement>,
): TemplateExpression | string =>
  extractTemplate(text, [CUSTOM_FIELD_PATTERN], expression => {
    const instance = fieldInstancesById.get(expression)
    if (!expression.match(CUSTOM_FIELD_PATTERN) || instance === undefined) {
      return expression
    }
    return new ReferenceExpression(instance.elemID, instance)
  })

export const addFieldsTemplateReferences =
  (fieldInstancesById: Map<string, InstanceElement>): referenceFunc =>
  (value: Value, fieldName: string): void => {
    if (typeof value[fieldName] === 'string') {
      value[fieldName] = referenceCustomFields(value[fieldName], fieldInstancesById)
    }
  }
