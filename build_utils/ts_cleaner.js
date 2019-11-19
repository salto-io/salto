#!/usr/bin/env node

// Copied from the ts-cleaner package - where it's not working due to DOS CR-LF newlines

const Args = require("args");
const Path = require("path");
const tsCleaner = require("ts-cleaner");

// Define the arguments
Args.options([
    {
        name: "src",
        description: "The source folder with ts files",
        defaultValue: "src",
    },
    {
        name: "dist",
        description: "The distribution folder with js files",
        defaultValue: "dist",
    },
    {
        name: "ifDeclared",
        description:
            "If set to true, js files in dist will only be removed if a file with the same name and a .d.ts extension is also present",
        defaultValue: false,
    },
    {
        name: "watch",
        description: "Whether to watch for files being deleted",
        defaultValue: false,
    },
    {
        name: "verbose",
        description: "Whether to show messages for files being deleted",
        defaultValue: false,
    },
]);
const args = Args.parse(process.argv);

// Get the source and distribution folders
const src = Path.resolve(process.cwd(), args.src);
const dist = Path.resolve(process.cwd(), args.dist);

// Clean the directory
tsCleaner.clean(src, dist, args.ifDeclared, args.verbose);

// Check whether we should continue checking for chnages
if (args.watch) tsCleaner.watch(src, dist, args.verbose);
