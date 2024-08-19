/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
module.exports = {
    rules: {
        'no-restricted-syntax': [
            'warn',
            {
                selector: "CallExpression[callee.object.name='JSON'][callee.property.name='stringify'][arguments.length=1]",
                message: 'JSON.stringify usage without a replacer is disallowed. Use inspectValue (or safeJsonStringify for small objects) instead',
            }
        ]
    }
}
