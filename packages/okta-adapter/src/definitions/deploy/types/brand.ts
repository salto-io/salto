/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { definitions } from '@salto-io/adapter-components'
import { prepareTemplateForDeploy, validatePlainObject } from '@salto-io/adapter-utils'
import { getChangeData, isTemplateExpression } from '@salto-io/adapter-api'
import { BrandsCustomizationType, brandCustomizationsToContentField } from '../../../filters/brand_customizations'

/**
 * Resolve content of brand customizations type, which may be a template expression
 */
export const adjustBrandCustomizationContent: definitions.AdjustFunction<
  definitions.deploy.ChangeAndExtendedContext
> = async ({ value, context }) => {
  const { change } = context
  const { typeName } = getChangeData(change).elemID
  validatePlainObject(value, typeName)
  const { fieldName } = brandCustomizationsToContentField[typeName as BrandsCustomizationType]
  const content = _.get(value, fieldName)
  if (!isTemplateExpression(content)) {
    return { value }
  }
  const resolvedValue = prepareTemplateForDeploy(content, ref => ref.value.value.domain)
  return {
    value: {
      ...value,
      [fieldName]: resolvedValue,
    },
  }
}
