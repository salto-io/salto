/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { DynamoDbInstances } from '../../../../src/lib/dynamodb/dynamodb_repo'

export type DynamoEnvironment = {
  dynamo: DynamoDbInstances
  tableName: string
  serviceOpts: Record<string, unknown>
}
