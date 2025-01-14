/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { definitions } from '@salto-io/adapter-components'
import { prepareTemplateForDeploy, validatePlainObject } from '@salto-io/adapter-utils'
import { ReferenceExpression, TemplatePart, getChangeData, isTemplateExpression } from '@salto-io/adapter-api'
import { BrandCustomizationType, brandCustomizationsToContentField } from '../../../filters/brand_customizations'
import { DOMAIN_TYPE_NAME } from '../../../constants'

const log = logger(module)

const resolveDomainReference: (ref: ReferenceExpression) => TemplatePart = ref => {
  if (ref.elemID.typeName === DOMAIN_TYPE_NAME) {
    return ref.value.value.domain
  }
  log.error('found unexpected reference for type %s, not resolving reference', ref.elemID.typeName)
  return ref
}

/**
 * Resolve content of brand customizations type, which may be a template expression
 */
export const adjustBrandCustomizationContent: definitions.AdjustFunction<
  definitions.deploy.ChangeAndExtendedContext
> = async ({ value, context }) => {
  const { change } = context
  const { typeName } = getChangeData(change).elemID
  validatePlainObject(value, typeName)
  const fieldName = brandCustomizationsToContentField[typeName as BrandCustomizationType]
  const content = _.get(value, fieldName)
  if (!isTemplateExpression(content)) {
    return { value }
  }
  const { value: resolvedValue } = prepareTemplateForDeploy(content, resolveDomainReference)
  return {
    value: {
      ...value,
      [fieldName]: resolvedValue,
    },
  }
}
