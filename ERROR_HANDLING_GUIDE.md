# Error Handling Test Suite Guide

## Overview
This project now includes a comprehensive error handling test suite that validates all critical error cases before marking work as complete.

## Test File Location
**[ERROR_HANDLING_TESTS.js](./ERROR_HANDLING_TESTS.js)** - Located at project root

## Running the Tests

```bash
# From project root
node ERROR_HANDLING_TESTS.js
```

## Workflow: Run Tests Before Finishing

**BEFORE marking any work as complete:**
1. Make all code changes
2. Test locally in browser/app
3. **Run the test suite**: `node ERROR_HANDLING_TESTS.js`
4. If any tests fail, fix code and re-run tests
5. Only when all tests pass, mark work as complete

## Test Coverage

The test suite covers 11 critical error scenarios:

### 1. JSON Parsing
- ✓ Handling already-parsed objects (no double-parsing)
- ✓ Parsing valid JSON strings
- ✓ Graceful handling of invalid JSON (returns null)

### 2. Data Validation
- ✓ Detecting missing required fields (target_dates, prices, scores)
- ✓ Safe array access (prevents index out of bounds)

### 3. Type Safety
- ✓ Type checking before calling methods (toFixed() only on numbers)
- ✓ Null-safe property access using optional chaining (?.)

### 4. Error Boundaries
- ✓ Error cards render even when prediction rendering fails
- ✓ Fallback UI displays error message to user

### 5. Network/API Errors
- ✓ Non-200 HTTP responses caught
- ✓ CORS errors detected ("Failed to fetch")
- ✓ Network errors differentiated from other errors

### 6. State Management
- ✓ localStorage serialization/deserialization safe

## Test Results Format

```
✓ PASS - Test Name
✗ FAIL - Test Name
  └─ Specific error message

RESULTS: 11 passed, 0 failed
```

## Errors Prevented

This test suite prevents the following errors that occurred during development:

| Error | Test Case |
|-------|-----------|
| `SyntaxError: Unexpected token 'o', "[object Obj"... is not valid JSON` | JSON Parse: Invalid JSON returns null |
| CORS policy blocked errors | CORS Error: Failed to fetch detected |
| `.toFixed() is not a function` | Type Checking: toFixed() only called on numbers |
| Cannot read properties of null | Null Safety: Optional chaining prevents crashes |
| Array index out of bounds | Array Access: Safe access to array elements |
| Missing catch/finally clause | Error Boundary: Error card renders even on error |

## Adding New Tests

When you encounter a new error:

1. **Create a new test method** in ERROR_HANDLING_TESTS.js:
```javascript
testYourErrorName() {
  // Test logic here
  return {
    name: 'Your Error: Description',
    passed: /* boolean */,
    error: /* null or error message */
  };
}
```

2. **Add test to run list** in the `run()` method:
```javascript
const testMethods = [
  // ... existing tests ...
  'testYourErrorName'
];
```

3. **Run tests** to verify new test works:
```bash
node ERROR_HANDLING_TESTS.js
```

## Integration with CI/CD

Future: These tests can be run automatically before deployment:

```json
{
  "scripts": {
    "test:errors": "node ERROR_HANDLING_TESTS.js",
    "build": "npm run test:errors && npm run build-app"
  }
}
```

## Notes

- Tests run synchronously
- No external dependencies required
- Tests take < 100ms to run
- Tests are self-contained (no database/API calls)
- Safe to run repeatedly

---

**Last Updated:** March 26, 2026  
**Total Tests:** 11  
**Pass Rate:** 100%
