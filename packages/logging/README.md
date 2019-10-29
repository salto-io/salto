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

### Using the logger

#### Explicit log levels

```typescript
log.debug('My debug message')
log.info('My object: %o', { hello: 'world' })
log.warn(new Error('oops'))
log.error('This message has extra', { extra: true })
```

#### Dynamic log level

```typescript
import { LogLevel } from '@salto/logging'
const level: LogLevel = howVerboseShouldItBe()
log.log(level, 'My object %o', { hello: 'world' })
```

#### Formatting messages

All the log methods accept a `printf`-like format string, formatted using [util.inspect](https://nodejs.org/api/util.html#util_util_format_format_args):

```typescript
log.info('My object: %o', { hello: 'world' })
```

#### Logging `Error` objects

If a JavaScript `Error` object is specified as the message, its `stack` property will be logged (which includes the `Error`'s message).

```typescript
log.warn(new Error('oops')) // logs "Error: oops" along with the stack trace
```

#### Logging extra properties

Object specified after formatting arguments will be included in the log's JSON output.

```typescript
log.error('This message has extra', { extra: true })
```

## Configuring the loggers

All the loggers share a single configuration with the following properties:

### `minLevel: 'info' | 'debug' | 'warn' | 'error' | 'none'`

Log calls below the specified level will be ignored.

If `'none'` is specified, all calls will be ignored.

Default: `none`

### `filename: string | null`

Write the logs to the specified file.

If `null` is specified, logs will be written to stdout.

Default: `null` (write to stdout)

### `format: 'text' | 'json'`

`'text'`: Write logs as text lines.

`'json'`: Write logs as JSON objects, separated by newlines. In this mode the log will include any extra properties:

```typescript
log.info('Example for extra props written in JSON mode', { extra: ['x', 'y'] })
```

Default: `'text'`

### `namespaceFilter: string | () => boolean`

If a string is specified, it is parsed as a [glob](https://en.wikipedia.org/wiki/Glob_%28programming%29) - only logs having matching namespaces will be written.

When configuring the logger using the [`.configure` API call](#configure_API), a function accepting the string namespace and returning boolean may be specified.

Default: `undefined` (no filtering)

### `colorize: boolean | null`

Override colorization in output.

Default: `null` - colorize if writing to stdout and the stream supports color.

## Configuration using environment variables

The initial configuration can be changed via env vars.

One or more of the following can be specified:

```bash
SALTO_LOG_LEVEL=info
SALTO_LOG_FILE=path/to/myfile
SALTO_LOG_FORMAT=text
SALTO_LOG_NS=myns*
SALTO_LOG_COLOR=true
```

Variables containing empty string values are treated as undefined.

## <a name="configure_API"></a>Configuration using the programmatic API

`logger.configure` accepts a `Partial<Config>` object to change the configuration.

All the properties are optional. Undefined properties will not change the configuration.

To remove an existing definition (e.g, `namespaceFilter` or `filename`), specify a `null` value.

```typescript
logger.configure({
  minLevel: 'info',
  filename: 'path/to/myfile',
  format: 'text',
  namespaceFilter: ns => ns.startsWith('myNS') // or 'myNS*'
  colorize: false,
})
```

## Testing for log calls

Logger creations are memoized using the specified namespace: Multiple `logger(namespace)` calls result the same logger. So the logger can be initialized statically in the code, and retrieved in the test by specifying the same namespace.

### Example using [jest](https://jestjs.io)

myModule.ts:

```typescript
import { logger } from '@salto/logging'

const log = logger('my.module')

export const f = () => log.info('hello')
```

myModule.test.ts:

```typescript
import { logger } from '@salto/logging'
import { f } from './myModule'

describe('log calls', () => {
  let log: jest.SpyInstance

  beforeEach(() => {
    const logger = logger('my.module') // same namespace
    log = jest.spyOn(logger, 'log')
    f()
  })

  it('calls logger correctly', () => {
    expect(log).toHaveBeenCalledWith('info', 'hello')
  })
})
```
