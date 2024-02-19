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

`yarn add @salto/logging`

or

`npm install @salto/logging`

## Logging

### Getting a logger instance

```typescript
import { logger } from '@salto/logging'

const log = logger(module) // namespace taken from module filename
const log = logger('my.namespace') // namespace set explicitly
```

### Using the logger

#### Explicit log levels

```typescript
log.trace('Detailed message')
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

#### Assigning log tags per namespace logger

Assigning tags to future log message from any logger with the same namespace. In order to empty assigned tags,
simply run the function with undefined. Tags can be boolean, strings, objects or callback functions that return the latter.

```typescript
log.assignTags({ requestId: '5', contextData: 4, calcAtRuntime: () => 'caclulated at runtime' })
log.assignTags(undefined) // Empties all assigned tags
```

#### Assigning log tags globally

Assigning tags to future log message from all loggers. In order to empty assigned tags, simply run the function with undefined. Tags can be boolean, strings, objects or callback functions that return the latter.

```typescript
log.globalAssignTags({ requestId: '5', contextData: 4, calcAtRuntime: () => 'caclulated at runtime' })
log.globalAssignTags(undefined) // Empties all assigned tags
```

#### Assigning logTime decorator globally

Assigning logTime decorator will allow to add a custom hook to all logTime calls.

```typescript
log.assignGlobalLogTimeDecorator((timedFunc, description) => {
  // some tracing logic
  return timedFunc
})
```

## Configuring the loggers

The configuration can be changed via env vars.

Variables containing empty string values are treated as undefined.

All the loggers share a single configuration with the following properties:

### `minLevel: 'info' | 'debug' | 'trace' | 'warn' | 'error' | 'none'`

Environment variable:

```bash
SALTO_LOG_LEVEL=info
```

Log calls below the specified level will be ignored.

If `'none'` is specified, all calls will be ignored.

Default: `none`

### `filename: string | null`

Environment variable:

```bash
SALTO_LOG_FILE=/tmp/my-package.log
```

Write the logs to the specified file.

If an empty value is specified, logs will be written to stdout.

Default: `''` (write to stdout)

### `format: 'text' | 'json'`

Environment variable:

```bash
SALTO_LOG_FORMAT=json
```

`'text'`: Write logs as text lines.

`'json'`: Write logs as JSON objects, separated by newlines. In this mode the log will include any extra properties:

```typescript
log.info('Example for extra props written in JSON mode', { extra: ['x', 'y'] })
```

Default: `'text'`

### `namespaceFilter: string | () => boolean`

Environment variable:

```bash
SALTO_LOG_NS='mypackage*'
```

If a string is specified, it is parsed as a [glob](https://en.wikipedia.org/wiki/Glob_%28programming%29) - only logs having matching namespaces will be written.

When configuring the logger using the [`.configure` API call](#configure_API), a function accepting the string namespace and returning boolean may be specified.

Default: `''` (no filtering)

### `colorize: boolean | null`

Environment variable:

```bash
SALTO_LOG_COLOR=true
```

Override colorization in output.

Default: `''` - colorize if writing to stdout and the stream supports color.

### `globalTags: LogTags | null`

Environment variable:

```bash
SALTO_LOG_GLOBAL_TAGS='{"requestId":20}'
```

Add tags to all log messages. When configuring this variable via the CLI, make sure this variable is a JSON.

Default: {} - Doesn't add any tags to log messages.

### `maxJsonLogChunkSize: number | null`

Environment variable:

```bash
SALTO_LOG_MAX_JSON_LOG_CHUNK_SIZE=3072 # 3K
```

Configure the max chunk size for the formatted json log message.

Default: 200 \* 1024 - 200K

Supported formatting: Receives only number which signifies the allowed bytes amount

### `maxTagsPerLogMessage: number | null`

Environment variable:

```bash
SALTO_LOG_MAX_TAGS_PER_LOG_MESSAGE=100
```

Configure the max amount of tags per message.

Default: 100

Supported formatting: Receives only number which signifies the allowed amount of tags per log line

## <a name="configure_API"></a>setting the logging from the programmatic API

```typescript
logger.setMinLevel('info')
```

## Testing for log calls

Logger creations are memoized using the specified namespace: Multiple `logger(namespace)` calls result the same logger. So the logger can be initialized statically in the code, and retrieved in the test by specifying the same namespace.

### Example using [jest](https://jestjs.io)

myModule.ts:

```typescript
import { logger } from '@salto/logging'

const log = logger('my.module')

export const hello = () => log.info('hello')
```

myModule.test.ts:

```typescript
import { logger } from '@salto/logging'
import { hello } from './myModule'

describe('log calls', () => {
  let spyLogger: jest.SpyInstance

  beforeEach(() => {
    const testLogger = logger('my.module') // same namespace
    spyLogger = jest.spyOn(testLogger, 'info')
    hello()
  })

  it('calls logger correctly', () => {
    expect(spyLogger).toHaveBeenCalledWith('hello')
  })
})
```
