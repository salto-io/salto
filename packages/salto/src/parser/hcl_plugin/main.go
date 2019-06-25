package main

import (
	"fmt"
	"syscall/js"

	"github.com/hashicorp/hcl2/hcl"
	"github.com/hashicorp/hcl2/hcl/hclsyntax"
)

func parseHCL(src []byte, filename string) (*hcl.File, hcl.Diagnostics) {
	return hclsyntax.ParseConfig(src, filename, hcl.InitialPos)
}

func formatErr(err *hcl.Diagnostic) string {
	return fmt.Sprintf(
		"%s: %s: %s",
		err.Subject.String(),
		err.Summary,
		err.Detail,
	)
}

// main communicates with javascript by looking at a global object
// we use this method because go does not support exporting functions in web assembly yet
// see: https://github.com/golang/go/issues/25612
func main() {
	args := js.Global().Get("hclParserArgs")

	// Get input parameters
	src := []byte(args.Get("src").String())
	filename := args.Get("filename").String()

	// Parse
	body, parseErrs := parseHCL(src, filename)

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

	// Set return value
	js.Global().Set("hclParserReturn", map[string]interface{}{
		"value":  jsMaker.JSValue,
		"errors": errors,
	})
}
