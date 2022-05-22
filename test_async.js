const async_hooks = require('async_hooks');

const createTree = (d, w) => {
    if (d === 0) {
        return {}
    }
    const base = {}
    for (let i = 0; i < w; i++){
        base[Math.random().toString()] = createTree(d - 1, w)
    }
    return base
}

const dfs = (base) => {
    for (v of Object.values(base)) {
        dfs(v)
    }
}

const adfs = async (base) => {
    for (v of Object.values(base)) {
        await adfs(v)
    }
}

const foo = async (base) => {
    const sSync = new Date()
    dfs(base)
    const eSync = new Date()
    
    const sAsync = new Date()
    await adfs(base)
    const eAsync = new Date()

    console.log("Sync time:", eSync.getTime() - sSync.getTime())
    console.log("Async time:", eAsync.getTime() - sAsync.getTime())
}

const d =  parseInt(process.argv[2], 10)
const w = parseInt(process.argv[3], 10)
const useHooks = process.argv[4]
console.log(d, w, useHooks)
const base = createTree(d, w)
if (useHooks) {
    const h = async_hooks.createHook({
        before: () => {}     
    })
    h.enable()
}

foo(base).then(() => {
    console.log("DONE")
})



