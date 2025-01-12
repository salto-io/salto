/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Value } from '@salto-io/adapter-api'

export class FunctionExpression {
  constructor(
    public readonly funcName: string,
    public readonly parameters: Value[],
  ) {}
}

export const isFunctionExpression = (val: Value): val is FunctionExpression => val instanceof FunctionExpression
