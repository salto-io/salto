import {
  parentPort, workerData, MessagePort, Worker, MessageChannel,
} from 'worker_threads'
import { DumpedHclBlock, AsyncHclParser, HclParseReturn, HclDumpReturn } from './types'
import { createInlineParser, wasmModule as getWasmModule } from './go_parser'

export const createParserWorker = async (timeout = 10000): Promise<AsyncHclParser> => {
  const worker = new Worker(__filename, {
    workerData: { wasmModule: await getWasmModule() },
  })

  const callWorker = <
    TArgs extends unknown[], TResult
  >(name: string, ...args: TArgs): Promise<TResult> => new Promise((resolve, reject) => {
      const { port1, port2 } = new MessageChannel()

      const exitHandler = (code: number): void => {
        reject(new Error(`worker has exited with code ${code}`))
      }

      worker.on('error', reject)
      worker.on('exit', exitHandler)

      let timeoutId: NodeJS.Timeout

      const cleanup = (): void => {
        worker.off('error', reject)
        worker.off('exit', exitHandler)
        clearTimeout(timeoutId)
      }

      timeoutId = setTimeout(() => {
        cleanup()
        reject(new Error(`call to ${name} had timed out after ${timeout} ms`))
      }, timeout)

      port1.on('message', ([err, result]: [unknown, TResult]): void => {
        cleanup()

        if (err !== undefined && err !== null) {
          reject(err)
        } else {
          resolve(result)
        }
      })

      worker.postMessage({
        port: port2,
        call: name,
        args,
      }, [port2])
    })

  return {
    parse: (
      content: string, filename: string,
    ): Promise<HclParseReturn> => callWorker('parse', content, filename),
    dump: (
      body: DumpedHclBlock,
    ): Promise<HclDumpReturn> => callWorker('dump', body),
    stop: (): Promise<void> => callWorker('stop'),
  }
}

const workerMain = async (
  parent: MessagePort,
  { wasmModule }: { wasmModule: WebAssembly.Module },
): Promise<void> => {
  const parser = await createInlineParser(wasmModule)

  const handleCall = async (
    { port, call, args }: {
      port: MessagePort
      call: 'stop' | 'parse' | 'dump'
      args: unknown[]
    }
  ): Promise<void> => {
    const returnResult = <T>(result: T): void => port.postMessage([null, result])
    const returnError = <T>(error: T): void => port.postMessage([error])

    if (call === 'stop') {
      await parser.stop()
      returnResult('stopping') // trigger the parent message handler before exiting
      process.exit(0)
    } else if (call === 'parse') {
      returnResult(parser.parse(args[0] as string, args[1] as string))
    } else if (call === 'dump') {
      returnResult(parser.dump(args[0] as DumpedHclBlock))
    } else {
      returnError(new Error(`Invalid call ${call}`))
    }
  }

  parent.on('message', handleCall)
  parent.on('close', () => process.exit(0))
}

if (parentPort) {
  const parent = parentPort
  workerMain(parent, workerData).catch(err => {
    parent.emit('error', err)
    process.exit(2)
  })
}
