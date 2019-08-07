package main

import (
	"fmt"
	"os"
	"syscall/js"

	"github.com/hashicorp/hcl2/hcl"
	"github.com/hashicorp/hcl2/hcl/hclsyntax"
	"github.com/hashicorp/hcl2/hclwrite"
)

func formatErr(err *hcl.Diagnostic) string {
	return fmt.Sprintf(
		"%s: %s: %s",
		err.Subject.String(),
		err.Summary,
		err.Detail,
	)
}

// ParseHCL parses a buffer with HCL data and returns the structure
// Args:
// 	args: a js object that contains the following fields
//		src: buffer with data to parse
// 		filename: the filename to include in error messages
//
// Returns:
// 	a js object that contains the following fields
//	  body: The parsed body
// 		errors: a list of error strings
func ParseHCL(args js.Value) interface{} {
	// Get input parameters
	src := []byte(args.Get("src").String())
	filename := args.Get("filename").String()

	// Parse
	body, parseErrs := hclsyntax.ParseConfig(src, filename, hcl.InitialPos)

	// Serialize the body to a javascript compatible object
	jsMaker := newHclConverter("#")
	convErrs := hclsyntax.Walk(body.Body.(*hclsyntax.Body), jsMaker)

	// Extract meaningful errors to report back
	errors := make([]interface{}, len(parseErrs)+len(convErrs))
	for i, err := range parseErrs {
		errors[i] = formatErr(err)
	}
	for i, err := range convErrs {
		errors[len(parseErrs)+i] = formatErr(err)
	}

	return map[string]interface{}{
		"body":   jsMaker.JSValue,
		"errors": errors,
	}
}

// DumpHCL formats blocks to HCL syntax
// Args:
//  args: a js object that contains the following fields
//    body: an object to be serialized to HCL
//
// Returns:
//  A buffer with the serialized HCL
func DumpHCL(args js.Value) interface{} {
	file := hclwrite.NewEmptyFile()

	fillBody(file.Body(), args.Get("body"))

	return string(file.Bytes())
}

var exportedFuncs = map[string]func(js.Value) interface{}{
	"parse": ParseHCL,
	"dump":  DumpHCL,
}

// main communicates with javascript by looking at a global object
// we use this method because go does not support exporting functions in web assembly yet
// see: https://github.com/golang/go/issues/25612
func main() {
	callContext := js.Global().Get("hclParserCall").Get(os.Args[0])

	funcName := callContext.Get("func").String()
	args := callContext.Get("args")

	op, exists := exportedFuncs[funcName]
	var ret interface{}
	if !exists {
		ret = map[string]interface{}{
			"errors": []interface{}{"Unknown function name " + funcName},
		}
	} else {
		ret = op(args)
	}
	callContext.Set("return", ret)
	// Signal JS that we finished
	callback := callContext.Get("callback")
	callback.Invoke()
}
