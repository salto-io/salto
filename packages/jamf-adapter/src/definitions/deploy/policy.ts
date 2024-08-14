/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { definitions } from '@salto-io/adapter-components'
import { values } from '@salto-io/lowerdash'

/*
 * change scripts array to object with size and script fields, so when converting to xml it will be in the correct format
 */
const adjustScriptStructureBeforeDeploy = (value: Record<string, unknown>): void => {
  const { scripts: currentScripts } = value
  if (Array.isArray(currentScripts)) {
    value.scripts = {
      size: currentScripts?.length ?? 0,
      script: currentScripts,
    }
  }
}

export const adjustPolicyOnDeploy: definitions.AdjustFunction<definitions.deploy.ChangeAndContext> = async ({
  value,
}) => {
  if (!values.isPlainRecord(value)) {
    throw new Error('Expected value to be a record')
  }
  ;[adjustScriptStructureBeforeDeploy].forEach(fn => fn(value))
  return { value }
}
