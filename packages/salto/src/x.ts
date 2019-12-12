import {readTextFile } from './file'
import { parse } from './parser/parse'

const foo = async (): Promise<void> => {
    const data = await readTextFile('../test.bp')
    const pres = await parse(Buffer.from(data), 'who_cares')
    console.log(pres.elements[0].annotations)
    console.log(pres.errors)
}

Promise.all([foo()])