# Salto Logging

## Features

- Simple API (compared to other logging libraries)
- Configuration via env vars or API:
  - JSON or text format
  - Outputs to stdout or file
  - Filter specific loggers or pattern
- Testable log calls
- `util.inspect`-like formatting: `log.info('hello %o', world)`
- Logs JS `Error`s with stack

## Installing

```yarn add @salto/logging```

or

```npm install @salto/logging```

## Logging

### Getting a logger instance

```typescript
import { logger } from '@salto/logging'

const log = logger(module)           // namespace taken from module filename
const log = logger('my.namespace')   // namespace set explicitly
```

## Using the logger

```typescript
// Use explicit levels

log.debug('My debug message')
log.info('My object: %o', { hello: 'world' }) // uses util.inspect to format
log.warn(new Error('oops')) // logs the stack trace
log.error('This message has extra', { extra: true }) // Extra object will be included if format is JSON

// Specify a level at runtime

import { LogLevel } from '@salto/logging'
const level: LogLevel = 'info'
log.log(level, 'My object %o', { hello: 'world' })
```

## Configuring

All the loggers share a single configuration.

The default configuration is:

- minLevel: info
- filename: undefined (log to stdout)
- format: text
- enabledForNamespace: * (all)
- colorize: enabled when logging to a stdout stream which supports color

### Using environment variables

The initial configuration can be changed via env vars.

One or more of the following can be specified

```bash
SALTO_LOG_LEVEL=info           # minimum level to be logged
SALTO_LOG_FILE=path/to/myfile  # if undefined, will output to stdout
SALTO_LOG_FORMAT=text          # or "json"
SALTO_LOG_NS=myns.*            # glob for filtering logger namespaces
SALTO_LOG_COLOR=true           # override colorization when outputing to stdout; anything other than [true, 1, yes] evaluates to false
```

### Using the programmatic API

`logger.configure` accepts a `Partial<Config>` object to change the configuration - all the properties are optional.

```typescript
const filter = (namespace: string): boolean => namespace.startsWith('myNS')

logger.configure({
  minLevel: 'info',             // minimum level to be logged
  filename: 'path/to/myfile',   // if undefined, will output to stdout
  format: 'text',               // or 'json'
  enabledForNamespace: filter,  // enable logging only for specific namespaces
  colorize: false,              // override colorization when outputing to stdout
})


```

## Testing for log calls

Logger creations are memoized using the specified namespace: Multiple `logger(namespace)` calls result the same logger. So the logger can be initialized statically in the code, and retrieved in the test using the same namespace.

### Example using jest

Tested module:

```typescript
import { logger } from '@salto/logging'

const log = logger('my.module')

const f = () => log.info('hello')
```

Test:

```typescript
import { logger } from '@salto/logging'

describe('log calls', () => {
  let log: jest.SpyInstance

  beforeEach(() => {
    log = jest.spyOn(logger('my.module'), 'log')
  })

  it('calls logger correctly', () => {
    expect(log).toHaveBeenCalledWith('info', 'hello')
  })
})
```
