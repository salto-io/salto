/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { definitions as definitionsUtils } from '@salto-io/adapter-components'
import { e2eUtils } from '@salto-io/microsoft-security-adapter'
import { InstanceElement } from '@salto-io/adapter-api'
import './jest_matchers'

type FetchDefinitions = definitionsUtils.fetch.FetchApiDefinitions<e2eUtils.MicrosoftSecurityAdapterOptions>

const getHiddenFieldsToOmit = (fetchDefinitions: FetchDefinitions, typeName: string): string[] => {
  const customizations = definitionsUtils.queryWithDefault(fetchDefinitions.instances).query(typeName)
    ?.element?.fieldCustomizations
  return Object.entries(customizations ?? {})
    .filter(([, customization]) => customization.hide === true)
    .map(([fieldName]) => fieldName)
}

// Omit hidden fields that are not written to nacl after deployment
export const verifyInstanceValues = ({
  fetchDefinitions,
  fetchedInstance,
  originalInstance,
}: {
  fetchDefinitions: FetchDefinitions
  fetchedInstance: InstanceElement | undefined
  originalInstance: InstanceElement
}): void => {
  expect(fetchedInstance).toBeDefinedWithElemID(originalInstance.elemID)
  const deployedInstance = fetchedInstance as InstanceElement
  const fieldsToOmit = getHiddenFieldsToOmit(fetchDefinitions, deployedInstance.elemID.typeName)
  const originalValue = _.omit(originalInstance?.value, fieldsToOmit)
  deployedInstance.value = _.omit(deployedInstance.value, fieldsToOmit)
  expect(originalValue).toHaveEqualValues(deployedInstance)
}
