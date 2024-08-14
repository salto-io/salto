/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { GeneratorParams, defaultParams } from '../src/generator'

const testParams: GeneratorParams = {
  ...defaultParams,
  numOfObjs: 10,
  numOfPrimitiveTypes: 10,
  numOfProfiles: 10,
  numOfRecords: 10,
  numOfTypes: 10,
  fieldsToOmitOnDeploy: ['fieldToOmit'],
}

export default testParams
