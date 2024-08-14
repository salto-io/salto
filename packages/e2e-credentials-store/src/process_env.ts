/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default (env: NodeJS.ProcessEnv) => ({
  required: (name: string): string => {
    if (!(name in env)) {
      throw new Error(`required env var ${name} missing`)
    }
    return env[name] ?? ''
  },
  bool: (k: string): boolean => ['1', 'true', 'yes'].includes(env[k] ?? ''),
})
